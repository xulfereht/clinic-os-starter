---
spec_id: SPEC-PERF-001
version: "1.0.0"
created: "2026-01-29"
updated: "2026-01-29"
---

# SPEC-PERF-001 구현 계획: 쿼리 병렬화 최적화

## 1. 마일스톤 개요

### Milestone 1: 인증 및 유틸리티 함수 병렬화 (Priority: High)

자주 호출되는 인증 함수의 쿼리를 병렬화합니다.

### Milestone 2: 통계 및 페이지 렌더링 함수 병렬화 (Priority: High)

무거운 통계 조회 및 페이지 렌더링 함수를 최적화합니다.

### Milestone 3: 성능 모니터링 및 검증 (Priority: Medium)

최적화 효과를 측정하고 CPU 시간 제한을 검증합니다.

---

## 2. 상세 구현 계획

### Milestone 1: 인증 및 유틸리티 함수 병렬화

**M1-T1: 병렬화 유틸리티 함수 작성**

- 파일: `core/utils/parallel.ts`
- 내용:
  - `parallelQueries<T>(queries: Promise<T>[]): Promise<T[]>` - 기본 병렬
  - `parallelQueriesSettled<T>(queries: Promise<T>[])` - 실패 허용 병렬
  - `phasedQueries(phases: Phase[])` - 의존성 기반 단계적 병렬
- 관련 요구사항: REQ-PERF-001, REQ-PERF-005

**M1-T2: verifyAnyAuth 함수 리팩토링**

- 파일: `core/auth/verify.ts`
- 변경 전:
  ```typescript
  const admin = await db.prepare(...).first();
  const superadmin = await db.prepare(...).first();
  ```
- 변경 후:
  ```typescript
  const [admin, superadmin] = await Promise.all([
    db.prepare(...).first(),
    db.prepare(...).first()
  ]);
  ```
- 관련 요구사항: REQ-PERF-002

**M1-T3: 기타 인증 관련 함수 검토 및 최적화**

- 대상: `verifyAdmin`, `verifyClinicAccess`, `checkPermissions`
- 내용: 독립 쿼리 식별 및 병렬화
- 관련 요구사항: REQ-PERF-001

### Milestone 2: 통계 및 페이지 렌더링 함수 병렬화

**M2-T1: handleGetStats 함수 리팩토링**

- 파일: `routes/stats/handler.ts`
- 분석 결과:
  - 독립 쿼리 (병렬 가능): 10개
  - 의존 쿼리 (순차 필요): 5개
- 변경 내용:
  ```typescript
  // Phase 1: 독립 쿼리 병렬
  const [q1, q2, q3, q4, q5, q6, q7, q8, q9, q10] = await Promise.all([
    getTotalPatients(clinicId),
    getTotalAppointments(clinicId),
    getTotalRevenue(clinicId),
    // ... 7개 더
  ]);

  // Phase 2: 의존 쿼리 순차
  const derived1 = await calculateDerived(q1, q2);
  // ...
  ```
- 관련 요구사항: REQ-PERF-003, REQ-PERF-005

**M2-T2: servePluginStorePage 함수 리팩토링**

- 파일: `routes/plugins/store.ts`
- 분석 결과: 7개 쿼리 모두 독립
- 변경 내용:
  ```typescript
  const [
    plugins,
    categories,
    userInstalls,
    popular,
    latest,
    reviews,
    favorites
  ] = await Promise.all([
    getPlugins(),
    getCategories(),
    getUserInstalls(userId),
    getPopularPlugins(),
    getLatestPlugins(),
    getReviewStats(),
    getUserFavorites(userId)
  ]);
  ```
- 관련 요구사항: REQ-PERF-004

**M2-T3: 기타 무거운 함수 식별 및 최적화**

- 대상 함수 식별 기준:
  - 3개 이상의 독립 쿼리 포함
  - 평균 응답 시간 > 100ms
- 내용: 코드베이스 스캔 및 후보 식별
- 관련 요구사항: REQ-PERF-001

### Milestone 3: 성능 모니터링 및 검증

**M3-T1: CPU 시간 측정 및 검증**

- 파일: `core/utils/performance.ts`
- 내용:
  - `measureCpuTime(fn: () => Promise<any>)`: CPU 시간 측정 유틸
  - 프로덕션에서 샘플링 기반 로깅
- Workers API: `performance.now()` 활용
- 관련 요구사항: REQ-PERF-006

**M3-T2: 성능 테스트 작성**

- 파일: `tests/performance/parallel-queries.test.ts`
- 테스트 케이스:
  - verifyAnyAuth: 최적화 전후 비교
  - handleGetStats: 최적화 전후 비교
  - servePluginStorePage: 최적화 전후 비교
- 관련 요구사항: 모든 REQ-PERF-*

**M3-T3: 프로덕션 모니터링 대시보드 설정**

- 도구: Cloudflare Analytics
- 메트릭:
  - CPU 시간 분포
  - 함수별 응답 시간
  - 50ms 초과 요청 비율

---

## 3. 기술적 접근 방식

### 3.1 아키텍처 설계

```
[요청 수신]
     │
     ▼
┌─────────────────────────────────────┐
│         병렬화 계획 수립             │
│  ┌─────────────────────────────────┐│
│  │ 1. 쿼리 의존성 분석              ││
│  │ 2. 독립 쿼리 그룹화              ││
│  │ 3. Phase 분리                   ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│            Phase 1 (병렬)            │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  │ Q1  │ │ Q2  │ │ Q3  │ │ Q4  │   │
│  └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘   │
│     └───────┴───────┴───────┘       │
│              Promise.all()          │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│            Phase 2 (순차)            │
│  의존성 있는 쿼리 순차 실행          │
└─────────────────────────────────────┘
     │
     ▼
[응답 반환]
```

### 3.2 의존성 분석 패턴

**코드 리뷰 체크리스트:**

1. 쿼리 결과가 다른 쿼리의 WHERE 절에 사용되는가?
2. 쿼리 간에 트랜잭션 격리가 필요한가?
3. 쿼리 실패 시 다른 쿼리도 중단해야 하는가?

**의존성 다이어그램 예시 (handleGetStats):**

```
┌───────────────────────────────────────────────────────┐
│                    Phase 1 (병렬)                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐         │
│  │totalPatient│ │totalAppoint│ │totalRevenue│ ...     │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘         │
└────────┼──────────────┼──────────────┼────────────────┘
         │              │              │
         ▼              ▼              ▼
┌───────────────────────────────────────────────────────┐
│                    Phase 2 (순차)                      │
│  ┌────────────────────────────────────────────────┐   │
│  │ calculateGrowthRate(totalPatient, prevPatient) │   │
│  └────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘
```

### 3.3 에러 처리 전략

| 함수 | 전략 | 이유 |
|------|------|------|
| verifyAnyAuth | Promise.all | 모든 검증 필수 |
| handleGetStats | Promise.allSettled | 일부 통계 실패 허용 |
| servePluginStorePage | Promise.all | 페이지 렌더링에 모든 데이터 필요 |

---

## 4. 리스크 및 대응 계획

### 4.1 기술적 리스크

**리스크 1: 병렬 실행으로 인한 리소스 경합**

- 설명: 동시 쿼리 증가로 D1 연결 풀 고갈 가능
- 대응: D1은 연결 풀 제한 없음 (서버리스 특성)
- 모니터링: 쿼리 실패율 관찰

**리스크 2: CPU 시간 제한 초과**

- 설명: 병렬 쿼리의 결과 처리 로직이 CPU 집약적일 경우
- 대응: 복잡한 계산은 별도 워커로 분리
- 모니터링: CPU 시간 로깅

### 4.2 비즈니스 리스크

**리스크 3: 기존 동작 변경으로 인한 버그**

- 설명: 순서 의존적인 숨겨진 로직이 있을 수 있음
- 대응: 단위 테스트 및 통합 테스트 강화
- 롤백: 기능 플래그로 원래 순차 실행으로 복구 가능

---

## 5. 검증 계획

### 5.1 단위 테스트

- 병렬화 유틸리티 함수
- 개별 쿼리 함수 (mock DB)

### 5.2 통합 테스트

- 실제 D1 연결 사용
- 최적화 전후 응답 시간 비교

### 5.3 성능 테스트

- k6 또는 Artillery로 부하 테스트
- P50, P95, P99 응답 시간 측정
- CPU 시간 분포 분석

### 5.4 A/B 테스트 (선택적)

- 기능 플래그로 일부 트래픽에만 적용
- 성능 지표 비교

---

## 6. Traceability Matrix

| Task ID | 관련 요구사항 | 검증 항목 |
|---------|--------------|----------|
| M1-T1 | REQ-PERF-001, REQ-PERF-005 | AC-PERF-001, AC-PERF-005 |
| M1-T2 | REQ-PERF-002 | AC-PERF-002 |
| M1-T3 | REQ-PERF-001 | AC-PERF-001 |
| M2-T1 | REQ-PERF-003, REQ-PERF-005 | AC-PERF-003, AC-PERF-005 |
| M2-T2 | REQ-PERF-004 | AC-PERF-004 |
| M2-T3 | REQ-PERF-001 | AC-PERF-001 |
| M3-T1 | REQ-PERF-006 | AC-PERF-006 |
| M3-T2 | 모든 REQ-PERF-* | 모든 AC-PERF-* |
