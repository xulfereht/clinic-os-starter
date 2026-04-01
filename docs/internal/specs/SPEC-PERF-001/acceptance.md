---
spec_id: SPEC-PERF-001
version: "1.0.0"
created: "2026-01-29"
updated: "2026-01-29"
---

# SPEC-PERF-001 수락 기준: 쿼리 병렬화 최적화

## 1. 수락 기준 개요

이 문서는 SPEC-PERF-001의 모든 요구사항에 대한 수락 기준을 Given-When-Then 형식으로 정의합니다.

---

## 2. 수락 기준 상세

### AC-PERF-001: 독립 쿼리 병렬화 원칙

**관련 요구사항:** REQ-PERF-001

```gherkin
Feature: 독립 쿼리 병렬화 원칙

  Scenario: 서로 독립적인 쿼리가 병렬로 실행됨
    Given 2개의 독립적인 데이터베이스 쿼리가 있음
    And 각 쿼리의 실행 시간이 약 10ms임
    When 병렬화된 코드가 두 쿼리를 실행함
    Then 총 실행 시간은 20ms 미만이어야 함
    And Promise.all() 또는 Promise.allSettled()가 사용되어야 함

  Scenario: 병렬 쿼리에서 한 쿼리가 실패해도 다른 쿼리 실행
    Given Promise.allSettled()를 사용하는 3개의 병렬 쿼리가 있음
    And 두 번째 쿼리가 실패하도록 설정됨
    When 병렬 쿼리를 실행함
    Then 첫 번째와 세 번째 쿼리의 결과는 정상적으로 반환되어야 함
    And 두 번째 쿼리의 상태는 'rejected'이어야 함

  Scenario: 코드베이스에서 병렬화 패턴 일관성 확인
    Given 프로젝트의 데이터베이스 쿼리 코드를 검사함
    When 3개 이상의 독립 쿼리가 있는 함수를 찾음
    Then 해당 함수들은 Promise.all() 패턴을 사용해야 함
```

### AC-PERF-002: verifyAnyAuth 병렬화

**관련 요구사항:** REQ-PERF-002

```gherkin
Feature: verifyAnyAuth 함수 병렬화

  Scenario: admin과 superadmin 검증이 병렬로 실행됨
    Given verifyAnyAuth 함수가 호출됨
    And admin 테이블 쿼리 시간이 10ms임
    And superadmin 테이블 쿼리 시간이 10ms임
    When 함수가 실행됨
    Then 총 실행 시간은 15ms 미만이어야 함 (병렬 실행)
    And 이전 순차 실행 대비 50% 이상 개선되어야 함

  Scenario: admin만 존재하는 경우 정상 동작
    Given admin 테이블에 해당 ID가 존재함
    And superadmin 테이블에 해당 ID가 없음
    When verifyAnyAuth 함수가 호출됨
    Then admin 정보가 반환되어야 함
    And superadmin 쿼리 실패가 전체 결과에 영향을 주지 않아야 함

  Scenario: 둘 다 존재하지 않는 경우 인증 실패
    Given admin 테이블에 해당 ID가 없음
    And superadmin 테이블에 해당 ID가 없음
    When verifyAnyAuth 함수가 호출됨
    Then 인증 실패 결과가 반환되어야 함
```

### AC-PERF-003: handleGetStats 병렬화

**관련 요구사항:** REQ-PERF-003

```gherkin
Feature: handleGetStats 함수 병렬화

  Scenario: 독립 통계 쿼리들이 병렬로 실행됨
    Given handleGetStats 함수가 호출됨
    And 15개의 통계 쿼리 중 10개가 독립적임
    And 각 쿼리의 평균 실행 시간이 15ms임
    When 함수가 실행됨
    Then Phase 1 (독립 쿼리)의 총 실행 시간은 50ms 미만이어야 함
    And 전체 실행 시간은 150ms 미만이어야 함

  Scenario: 통계 조회 결과의 정확성 유지
    Given handleGetStats 함수를 병렬화 전후로 실행함
    When 동일한 입력으로 두 버전을 실행함
    Then 두 결과의 통계 값이 동일해야 함

  Scenario: 일부 통계 쿼리 실패 시 기본값 반환
    Given handleGetStats가 Promise.allSettled()를 사용함
    And 선택적 통계 쿼리 중 하나가 실패함
    When 함수가 실행됨
    Then 필수 통계는 정상적으로 반환되어야 함
    And 실패한 선택적 통계는 null 또는 기본값이어야 함
```

### AC-PERF-004: servePluginStorePage 병렬화

**관련 요구사항:** REQ-PERF-004

```gherkin
Feature: servePluginStorePage 함수 병렬화

  Scenario: 7개 쿼리가 모두 병렬로 실행됨
    Given servePluginStorePage 함수가 호출됨
    And 7개의 독립 쿼리가 있음
    And 각 쿼리의 평균 실행 시간이 12ms임
    When 함수가 실행됨
    Then 총 실행 시간은 30ms 미만이어야 함
    And 이전 순차 실행 (84ms) 대비 75% 이상 개선되어야 함

  Scenario: 플러그인 스토어 페이지 데이터 완전성
    Given servePluginStorePage 함수가 실행됨
    When 결과를 확인함
    Then plugins 배열이 반환되어야 함
    And categories 배열이 반환되어야 함
    And popular 배열이 반환되어야 함
    And latest 배열이 반환되어야 함

  Scenario: 모든 쿼리 성공 시에만 페이지 렌더링
    Given Promise.all()을 사용하는 servePluginStorePage가 있음
    And 하나의 필수 쿼리가 실패함
    When 함수가 실행됨
    Then 에러가 발생해야 함
    And 부분적인 데이터로 페이지가 렌더링되지 않아야 함
```

### AC-PERF-005: 의존성 있는 쿼리 순서 유지

**관련 요구사항:** REQ-PERF-005

```gherkin
Feature: 의존 쿼리의 순차 실행

  Scenario: 의존성 있는 쿼리가 순서대로 실행됨
    Given 쿼리 B가 쿼리 A의 결과에 의존함
    When 코드가 실행됨
    Then 쿼리 A가 먼저 완료되어야 함
    And 그 후에 쿼리 B가 실행되어야 함
    And 데이터 무결성이 유지되어야 함

  Scenario: 단계별 병렬 실행 (Phase 패턴)
    Given Phase 1에 3개의 독립 쿼리가 있음
    And Phase 2에 Phase 1 결과를 사용하는 2개의 쿼리가 있음
    When 함수가 실행됨
    Then Phase 1의 3개 쿼리가 병렬로 실행되어야 함
    And Phase 1 완료 후 Phase 2가 시작되어야 함
    And Phase 2의 2개 쿼리가 병렬로 실행되어야 함

  Scenario: 의존성 그래프 분석 정확성
    Given handleGetStats의 쿼리 의존성 분석 결과가 있음
    When 독립 쿼리와 의존 쿼리를 분류함
    Then calculateGrowthRate는 의존 쿼리로 분류되어야 함
    And getTotalPatients는 독립 쿼리로 분류되어야 함
```

### AC-PERF-006: CPU 시간 초과 금지

**관련 요구사항:** REQ-PERF-006

```gherkin
Feature: Cloudflare Workers CPU 시간 제한 준수

  Scenario: 단일 요청의 CPU 시간이 50ms 이하
    Given 최적화된 함수가 실행됨
    When CPU 시간을 측정함
    Then CPU 시간이 50ms를 초과하지 않아야 함

  Scenario: 가장 무거운 엔드포인트의 CPU 시간 확인
    Given handleGetStats 엔드포인트에 요청을 보냄
    When 응답을 받고 CPU 시간을 확인함
    Then CPU 시간이 50ms를 초과하지 않아야 함
    And 벽시계 시간과 CPU 시간의 차이가 로깅되어야 함

  Scenario: CPU 시간 초과 시 경고 로깅
    Given CPU 시간이 40ms를 초과하는 요청이 있음
    When 해당 요청이 처리됨
    Then 경고 로그가 생성되어야 함
    And 로그에 함수명과 CPU 시간이 포함되어야 함

  Scenario: 배치 처리 시 CPU 시간 분산
    Given 대량의 데이터를 처리하는 요청이 있음
    When CPU 시간이 50ms에 근접함
    Then 처리를 중단하고 다음 요청으로 분할해야 함
    Or 에러를 반환하고 클라이언트가 재시도하도록 해야 함
```

---

## 3. Quality Gate 기준

### 3.1 성능 기준

| 함수 | 최적화 전 | 최적화 후 목표 | 최소 개선율 |
|------|----------|--------------|------------|
| verifyAnyAuth | ~20ms | <15ms | 25% |
| handleGetStats | ~225ms | <150ms | 33% |
| servePluginStorePage | ~84ms | <30ms | 64% |

### 3.2 테스트 커버리지

- 병렬화 유틸리티 함수: 100% 커버리지
- 최적화된 함수들: 90% 이상 커버리지
- 성능 회귀 테스트: 모든 대상 함수 포함

### 3.3 안정성 기준

- CPU 시간 50ms 초과 요청: 0%
- 병렬화로 인한 에러율 증가: 0%
- 결과 정확성 100% 유지

---

## 4. Definition of Done

- [ ] 모든 수락 기준 테스트 통과
- [ ] verifyAnyAuth 응답 시간 50% 개선
- [ ] handleGetStats 응답 시간 55% 이상 개선
- [ ] servePluginStorePage 응답 시간 75% 이상 개선
- [ ] CPU 시간 50ms 초과 요청 0건
- [ ] 성능 테스트 결과 문서화
- [ ] 코드 리뷰 완료
- [ ] 프로덕션 배포 및 모니터링 설정

---

## 5. 성능 테스트 시나리오

### 5.1 부하 테스트

```yaml
# k6 테스트 시나리오
scenarios:
  baseline:
    executor: 'constant-vus'
    vus: 10
    duration: '1m'

  stress:
    executor: 'ramping-vus'
    startVUs: 0
    stages:
      - duration: '30s', target: 50
      - duration: '1m', target: 50
      - duration: '30s', target: 0
```

### 5.2 측정 메트릭

- P50 응답 시간
- P95 응답 시간
- P99 응답 시간
- CPU 시간 분포
- 에러율

---

## 6. Traceability

| 수락 기준 ID | 요구사항 ID | plan.md Task |
|-------------|------------|--------------|
| AC-PERF-001 | REQ-PERF-001 | M1-T1 |
| AC-PERF-002 | REQ-PERF-002 | M1-T2 |
| AC-PERF-003 | REQ-PERF-003 | M2-T1 |
| AC-PERF-004 | REQ-PERF-004 | M2-T2 |
| AC-PERF-005 | REQ-PERF-005 | M1-T1, M2-T1 |
| AC-PERF-006 | REQ-PERF-006 | M3-T1 |
