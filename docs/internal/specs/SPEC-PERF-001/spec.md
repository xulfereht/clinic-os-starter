---
id: SPEC-PERF-001
version: "1.0.0"
status: draft
created: "2026-01-29"
updated: "2026-01-29"
author: "Claude"
priority: P1
tags: [performance, optimization, parallel, query, promise]
---

## HISTORY

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0.0 | 2026-01-29 | Claude | 초기 버전 생성 |

---

# SPEC-PERF-001: 쿼리 병렬화 최적화

## 1. 개요

### 1.1 배경

현재 시스템의 여러 핵심 함수에서 독립적인 데이터베이스 쿼리가 순차적으로 실행되어 불필요한 지연이 발생하고 있습니다:

1. **verifyAnyAuth**: 2개 쿼리 순차 실행 (admin + superadmin 검증)
2. **handleGetStats**: 15개 통계 쿼리 순차 실행
3. **servePluginStorePage**: 7개 쿼리 순차 실행 (플러그인 정보 조회)

### 1.2 현재 성능 문제

| 함수 | 쿼리 수 | 평균 쿼리 시간 | 현재 총 시간 | 예상 최적화 시간 |
|------|---------|---------------|-------------|-----------------|
| verifyAnyAuth | 2 | 10ms | ~20ms | ~10ms |
| handleGetStats | 15 | 15ms | ~225ms | ~45ms |
| servePluginStorePage | 7 | 12ms | ~84ms | ~24ms |

### 1.3 목표

- 독립적인 쿼리를 `Promise.all()`로 병렬 실행
- 전체 응답 시간 단축 (60-80% 개선 목표)
- Cloudflare Workers CPU 시간 제한(50ms) 준수

### 1.4 비목표

- 데이터베이스 스키마 변경
- 쿼리 자체의 최적화 (인덱스, 쿼리 재작성)
- 캐싱 레이어 도입 (별도 SPEC으로 분리)

---

## 2. 요구사항 (EARS Format)

### 2.1 Ubiquitous Requirements (항상 적용)

**REQ-PERF-001: 독립 쿼리 병렬화 원칙**

> 시스템은 **항상** 서로 의존성이 없는 쿼리들을 `Promise.all()` 또는 `Promise.allSettled()`로 병렬 실행해야 한다.

병렬화 판단 기준:
- 쿼리 A의 결과가 쿼리 B의 입력으로 사용되지 않음
- 쿼리 간에 트랜잭션 격리가 필요하지 않음

### 2.2 Event-Driven Requirements (이벤트 기반)

**REQ-PERF-002: verifyAnyAuth 병렬화**

> **WHEN** verifyAnyAuth 함수가 호출되면 **THEN** admin과 superadmin 검증 쿼리를 병렬로 실행해야 한다.

현재 코드 (순차):
```typescript
const admin = await db.prepare('SELECT * FROM admins WHERE id = ?').bind(id).first();
const superadmin = await db.prepare('SELECT * FROM superadmins WHERE id = ?').bind(id).first();
```

목표 코드 (병렬):
```typescript
const [admin, superadmin] = await Promise.all([
  db.prepare('SELECT * FROM admins WHERE id = ?').bind(id).first(),
  db.prepare('SELECT * FROM superadmins WHERE id = ?').bind(id).first()
]);
```

**REQ-PERF-003: handleGetStats 병렬화**

> **WHEN** handleGetStats 함수가 호출되면 **THEN** 독립적인 통계 쿼리들을 병렬로 실행해야 한다.

병렬화 대상 쿼리 그룹:
- 그룹 1 (독립): 총 환자 수, 총 예약 수, 총 수익
- 그룹 2 (독립): 일별 통계, 주별 통계, 월별 통계
- 그룹 3 (의존): 그룹 1 결과 기반 파생 계산

**REQ-PERF-004: servePluginStorePage 병렬화**

> **WHEN** servePluginStorePage 함수가 호출되면 **THEN** 플러그인 관련 쿼리들을 병렬로 실행해야 한다.

병렬화 대상:
- 플러그인 목록 조회
- 카테고리 목록 조회
- 사용자 설치 현황 조회
- 인기 플러그인 조회
- 최신 플러그인 조회
- 플러그인 리뷰 통계
- 사용자 즐겨찾기 조회

### 2.3 State-Driven Requirements (조건 기반)

**REQ-PERF-005: 의존성 있는 쿼리 순서 유지**

> **IF** 쿼리 B가 쿼리 A의 결과에 의존하면 **THEN** 시스템은 해당 쿼리들을 순차적으로 실행해야 한다.

의존성 패턴 예시:
```typescript
// 순차 실행 필수
const clinic = await getClinic(clinicId);
const doctors = await getDoctorsByClinic(clinic.id); // clinic.id 의존
```

### 2.4 Unwanted Requirements (금지 사항)

**REQ-PERF-006: CPU 시간 초과 금지**

> 시스템은 단일 요청에서 50ms CPU 시간을 초과**하지 않아야 한다**.

- Cloudflare Workers 무료 플랜: 10ms CPU 제한
- Cloudflare Workers 유료 플랜: 50ms CPU 제한
- CPU 시간 ≠ 벽시계 시간 (I/O 대기 제외)

---

## 3. 기술 명세

### 3.1 병렬화 패턴

**패턴 1: 완전 병렬 (모든 쿼리 독립)**

```typescript
async function getCompleteStats(clinicId: string) {
  const [
    totalPatients,
    totalAppointments,
    totalRevenue,
    activeSubscriptions,
    pendingPayments
  ] = await Promise.all([
    getTotalPatients(clinicId),
    getTotalAppointments(clinicId),
    getTotalRevenue(clinicId),
    getActiveSubscriptions(clinicId),
    getPendingPayments(clinicId)
  ]);

  return { totalPatients, totalAppointments, totalRevenue, activeSubscriptions, pendingPayments };
}
```

**패턴 2: 부분 병렬 (일부 의존)**

```typescript
async function getClinicData(clinicId: string) {
  // Phase 1: 독립 쿼리 병렬
  const [clinic, settings] = await Promise.all([
    getClinic(clinicId),
    getClinicSettings(clinicId)
  ]);

  // Phase 2: clinic 의존 쿼리 병렬
  const [doctors, patients] = await Promise.all([
    getDoctorsByClinic(clinic.id),
    getPatientsByClinic(clinic.id)
  ]);

  return { clinic, settings, doctors, patients };
}
```

**패턴 3: allSettled (실패 허용)**

```typescript
async function getOptionalStats(clinicId: string) {
  const results = await Promise.allSettled([
    getCriticalStats(clinicId),      // 필수
    getAnalyticsData(clinicId),      // 선택 (외부 서비스)
    getRecommendations(clinicId)     // 선택 (ML 서비스)
  ]);

  return {
    stats: results[0].status === 'fulfilled' ? results[0].value : null,
    analytics: results[1].status === 'fulfilled' ? results[1].value : null,
    recommendations: results[2].status === 'fulfilled' ? results[2].value : null
  };
}
```

### 3.2 대상 함수 분석

**verifyAnyAuth 분석:**

```
현재 흐름:
┌─────────────────────────────┐
│ 1. SELECT FROM admins       │ → 10ms
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ 2. SELECT FROM superadmins  │ → 10ms
└──────────────┬──────────────┘
               ▼
           총: ~20ms

최적화 후:
┌─────────────────────────────┐
│ 1. SELECT FROM admins       │ ─┐
└─────────────────────────────┘  │ → 10ms (병렬)
┌─────────────────────────────┐  │
│ 2. SELECT FROM superadmins  │ ─┘
└─────────────────────────────┘
           총: ~10ms (50% 감소)
```

**handleGetStats 분석:**

```
현재 흐름: 15개 쿼리 순차 → ~225ms
최적화 후:
  - Phase 1 (독립 10개): 병렬 → ~30ms
  - Phase 2 (의존 5개): 순차 → ~75ms
  - 총: ~105ms (53% 감소)
```

**servePluginStorePage 분석:**

```
현재 흐름: 7개 쿼리 순차 → ~84ms
최적화 후: 7개 모두 독립 → 병렬 → ~12ms (85% 감소)
```

### 3.3 에러 처리 전략

| 시나리오 | 전략 | 구현 |
|---------|------|------|
| 모든 쿼리 필수 | Promise.all | 하나라도 실패 시 전체 실패 |
| 일부 쿼리 선택 | Promise.allSettled | 개별 실패 허용 |
| 부분 실패 복구 | try-catch + fallback | 실패 시 기본값 반환 |

---

## 4. 제약 조건

### 4.1 Cloudflare Workers 제약

- **CPU 시간 제한**: 50ms (유료), 10ms (무료)
- **메모리 제한**: 128MB
- **동시 연결 수**: 제한 없음 (D1의 경우)

### 4.2 D1 데이터베이스 제약

- **동시 쿼리**: D1은 단일 연결에서 병렬 쿼리 지원
- **트랜잭션**: 병렬 쿼리에서 트랜잭션 사용 주의

### 4.3 성능 목표

| 지표 | 현재 | 목표 | 최소 개선율 |
|------|------|------|------------|
| verifyAnyAuth | 20ms | 10ms | 50% |
| handleGetStats | 225ms | 100ms | 55% |
| servePluginStorePage | 84ms | 20ms | 75% |

---

## 5. Traceability

| 요구사항 ID | plan.md 참조 | acceptance.md 참조 |
|------------|--------------|-------------------|
| REQ-PERF-001 | M1-T1 | AC-PERF-001 |
| REQ-PERF-002 | M1-T2 | AC-PERF-002 |
| REQ-PERF-003 | M2-T1 | AC-PERF-003 |
| REQ-PERF-004 | M2-T2 | AC-PERF-004 |
| REQ-PERF-005 | M1-T1 | AC-PERF-005 |
| REQ-PERF-006 | M3-T1 | AC-PERF-006 |
