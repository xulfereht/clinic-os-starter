# SPEC-CORE-001: 인수 조건

---
spec_id: SPEC-CORE-001
version: "1.0.0"
created: "2025-01-30"
---

## 1. Pre-flight 스키마 검증

### AC-001: 스키마 해시 계산

```gherkin
Feature: 스키마 해시 계산
  스키마 상태를 해시로 요약하여 비교할 수 있어야 한다

  Scenario: 동일 스키마에서 동일 해시 생성
    Given 로컬 D1 데이터베이스가 초기화되어 있음
    And migrations/0000_initial_schema.sql이 적용됨
    When calculateSchemaHash()를 두 번 호출하면
    Then 두 해시 값은 동일해야 함

  Scenario: 스키마 변경 시 해시 변경
    Given 로컬 D1 데이터베이스에 기존 스키마가 있음
    And 현재 스키마 해시가 "abc123"임
    When 새 테이블이 추가되면
    Then 새 스키마 해시는 "abc123"과 달라야 함
```

### AC-002: Bootstrap 검증

```gherkin
Feature: Bootstrap 마이그레이션 검증
  d1_migrations 테이블이 비어있을 때 기존 스키마 상태를 검증해야 한다

  Scenario: 빈 d1_migrations + 빈 DB = 정상 Bootstrap
    Given d1_migrations 테이블이 비어있음
    And 실제 데이터베이스에 테이블이 없음
    When core:pull을 실행하면
    Then 모든 마이그레이션이 순서대로 적용됨
    And d1_migrations에 적용된 파일 목록이 기록됨

  Scenario: 빈 d1_migrations + 기존 스키마 존재 = 경고
    Given d1_migrations 테이블이 비어있음
    And 실제 데이터베이스에 테이블이 존재함 (예: patients, clinics)
    When core:pull을 실행하면
    Then 경고 메시지가 출력됨: "스키마가 존재하지만 d1_migrations가 비어있습니다"
    And 사용자에게 확인을 요청함
    And --force 옵션 없이는 마이그레이션이 중단됨

  Scenario: --force 옵션으로 강제 Bootstrap
    Given d1_migrations 테이블이 비어있음
    And 실제 데이터베이스에 테이블이 존재함
    When core:pull --force를 실행하면
    Then 기존 마이그레이션을 "적용됨"으로 등록함
    And 새 마이그레이션만 실행함
```

---

## 2. 재시도 메커니즘

### AC-003: SQLITE_BUSY 재시도

```gherkin
Feature: SQLITE_BUSY 오류 자동 재시도
  데이터베이스 락 충돌 시 자동으로 재시도해야 한다

  Scenario: 1회 SQLITE_BUSY 후 성공
    Given 마이그레이션 실행 중 첫 번째 시도에서 SQLITE_BUSY 발생
    When 200ms 후 재시도하면
    Then 마이그레이션이 성공함
    And 로그에 "⏳ SQLITE_BUSY - 200ms 후 재시도 (1/3)" 출력됨

  Scenario: 3회 SQLITE_BUSY 후 실패
    Given 마이그레이션 실행 중 3회 연속 SQLITE_BUSY 발생
    When 최대 재시도 횟수(3)에 도달하면
    Then 마이그레이션이 실패로 처리됨
    And 에러 메시지에 "최대 재시도 횟수 초과" 포함됨
    And 후속 마이그레이션은 실행되지 않음

  Scenario: Exponential Backoff 지연 시간
    Given 재시도 설정이 baseDelay=200ms임
    When SQLITE_BUSY로 재시도가 발생하면
    Then 1차 재시도는 200ms 후 실행됨
    And 2차 재시도는 400ms 후 실행됨
    And 3차 재시도는 800ms 후 실행됨
```

---

## 3. 의존성 그래프

### AC-004: 의존성 순서 적용

```gherkin
Feature: 마이그레이션 의존성 순서
  의존성 주석이 있는 마이그레이션은 올바른 순서로 실행되어야 한다

  Scenario: 의존성에 따른 실행 순서
    Given migrations/0100_create_users.sql에 "-- depends: 0000_initial_schema.sql"
    And migrations/0101_add_email.sql에 "-- depends: 0100_create_users.sql"
    When 마이그레이션을 실행하면
    Then 실행 순서는 0000 → 0100 → 0101 이어야 함

  Scenario: 의존성 없는 파일은 숫자 순서
    Given migrations/0200_standalone.sql에 의존성 주석 없음
    And migrations/0201_another.sql에 의존성 주석 없음
    When 마이그레이션을 실행하면
    Then 0200과 0201은 숫자 순서로 실행됨

  Scenario: 순환 의존성 감지
    Given migrations/A.sql에 "-- depends: B.sql"
    And migrations/B.sql에 "-- depends: A.sql"
    When 마이그레이션 순서를 계산하면
    Then 에러가 발생함: "Circular dependency detected"
    And 마이그레이션이 실행되지 않음
```

---

## 4. 상태 추적

### AC-005: d1_migrations 테이블 정확성

```gherkin
Feature: 마이그레이션 상태 추적
  d1_migrations 테이블은 실제 적용 상태를 정확히 반영해야 한다

  Scenario: 성공한 마이그레이션 기록
    Given 마이그레이션 파일 0100_create_users.sql이 있음
    When 마이그레이션이 성공적으로 실행되면
    Then d1_migrations 테이블에 "0100_create_users.sql" 레코드가 추가됨
    And applied_at 필드에 현재 시간이 기록됨

  Scenario: 실패한 마이그레이션은 기록되지 않음
    Given 마이그레이션 파일 0200_will_fail.sql에 문법 오류가 있음
    When 마이그레이션이 실패하면
    Then d1_migrations 테이블에 "0200_will_fail.sql" 레코드가 없음

  Scenario: 이미 적용된 마이그레이션 스킵
    Given d1_migrations에 "0100_create_users.sql"이 있음
    When core:pull을 실행하면
    Then 0100_create_users.sql은 실행되지 않음
    And 로그에 "이미 적용됨" 또는 스킵 메시지 없이 조용히 진행됨
```

---

## 5. 하위 호환성

### AC-006: 기존 클라이언트 호환

```gherkin
Feature: 기존 클라이언트 호환성
  업데이트 후에도 기존 클라이언트가 정상 동작해야 한다

  Scenario: 의존성 주석 없는 기존 마이그레이션
    Given 기존 클라이언트의 migrations/ 폴더에 의존성 주석이 없음
    When core:pull로 새 fetch.js가 적용되면
    Then 기존 마이그레이션은 숫자 순서로 정상 실행됨

  Scenario: 기존 d1_migrations 데이터 유지
    Given 기존 클라이언트에 d1_migrations 레코드가 100개 있음
    When core:pull을 실행하면
    Then 기존 레코드는 모두 유지됨
    And 새 마이그레이션만 추가로 기록됨

  Scenario: CLI 인터페이스 변경 없음
    Given 기존 명령어 "npm run core:pull"이 있음
    When fetch.js가 업데이트되면
    Then "npm run core:pull" 명령어는 동일하게 동작함
    And 새 옵션 --force, --dry-run만 추가됨
```

---

## 6. 에러 처리

### AC-007: 에러 리포팅

```gherkin
Feature: 마이그레이션 에러 리포팅
  실패 시 명확한 에러 메시지와 상태 리포트를 제공해야 한다

  Scenario: 마이그레이션 실패 리포트
    Given 마이그레이션 5개 중 3번째에서 실패함
    When 에러가 발생하면
    Then 출력에 다음 정보가 포함됨:
      | 항목 | 예시 |
      | 실패 파일 | 0102_audit_events.sql |
      | 에러 메시지 | SQLITE_ERROR: no such table: users |
      | 적용 성공 | 2개 (0000, 0100) |
      | 적용 실패 | 1개 (0102) |
      | 미적용 | 2개 (0103, 0104) |

  Scenario: 스키마 불일치 경고
    Given 스키마 해시 불일치가 감지됨
    When 경고가 출력되면
    Then 메시지에 다음 정보가 포함됨:
      | 항목 | 설명 |
      | 예상 해시 | d1_migrations 기준 |
      | 실제 해시 | sqlite_master 기준 |
      | 권장 액션 | --force 사용 또는 수동 확인 |
```

---

## 7. Atomic Engine Update

### AC-008: 엔진 Atomic Swap

```gherkin
Feature: 엔진 Atomic Update
  엔진 파일 업데이트는 원자적으로 수행되어야 한다

  Scenario: 정상 Atomic Swap
    Given upstream에 새 버전의 fetch.js, migrate.js가 있음
    When core:pull로 엔진 업데이트가 실행되면
    Then .docking/.engine-staging/에 파일이 추출됨
    And .docking/engine/이 .docking/.engine-backup/으로 이동됨
    And .docking/.engine-staging/이 .docking/engine/으로 이동됨
    And .docking/.engine-backup/이 삭제됨
    And 로그에 "✅ 엔진 Atomic Update 완료" 출력됨

  Scenario: Staging 추출 실패 시 롤백
    Given upstream에서 파일 추출 중 네트워크 오류 발생
    When atomicEngineUpdate()가 실패하면
    Then .docking/.engine-staging/이 삭제됨
    And .docking/engine/은 변경되지 않음
    And 로그에 "⚠️ 엔진 업데이트 실패: Extract failed" 출력됨

  Scenario: Swap 중 실패 시 롤백
    Given Staging이 완료되고 Swap 중 오류 발생 (디스크 부족 등)
    When atomicSwap()이 실패하면
    Then .docking/.engine-backup/에서 .docking/engine/으로 복원됨
    And 로그에 "🔄 기존 엔진 복원 완료" 출력됨
    And 이전 버전의 엔진이 정상 동작함
```

### AC-009: 엔진 검증

```gherkin
Feature: 엔진 파일 검증
  Staging 단계에서 필수 파일 존재를 검증해야 한다

  Scenario: 필수 파일 존재 확인
    Given Staging 디렉토리에 파일이 추출됨
    When validateStaging()이 실행되면
    Then fetch.js 존재 여부 확인됨
    And migrate.js 존재 여부 확인됨

  Scenario: 필수 파일 누락 시 오류
    Given Staging 디렉토리에 migrate.js가 없음
    When validateStaging()이 실행되면
    Then 에러 발생: "Required file missing: migrate.js"
    And Swap이 진행되지 않음
    And 기존 엔진이 유지됨
```

### AC-010: 중간 중단 시 상태 일관성

```gherkin
Feature: 중간 중단 시 상태 일관성
  프로세스 중단 시에도 일관된 상태를 유지해야 한다

  Scenario: Staging 중 프로세스 종료
    Given Staging 추출 중 프로세스가 강제 종료됨
    When 다음 core:pull을 실행하면
    Then .docking/.engine-staging/이 있으면 삭제 후 진행
    And 기존 .docking/engine/은 정상 상태임
    And 엔진 업데이트가 다시 시도됨

  Scenario: Backup 존재 시 복구 확인
    Given .docking/.engine-backup/이 존재함 (이전 실패 잔여)
    And .docking/engine/이 비어있음
    When core:pull을 실행하면
    Then backup에서 engine으로 복원됨
    And 경고 메시지 출력: "이전 업데이트 실패 잔여 복구됨"
```

---

## 8. Definition of Done

### 필수 조건

- [ ] 모든 Acceptance Criteria 테스트 통과 (AC-001 ~ AC-010)
- [ ] 기존 core:pull 명령어 정상 동작
- [ ] SQLITE_BUSY 재시도 로직 동작 확인
- [ ] Pre-flight 검증 동작 확인
- [ ] Atomic Engine Update 동작 확인
- [ ] 엔진 롤백 메커니즘 테스트 통과
- [ ] 코드 리뷰 완료

### 권장 조건

- [ ] 의존성 그래프 기능 구현 (선택적)
- [ ] 문서 업데이트 (README, ARCHITECTURE.md)
- [ ] 스타터킷 테스트 클라이언트에서 검증
- [ ] 중간 중단 시나리오 테스트

### 품질 기준

- [ ] 에러 메시지가 명확하고 액션 가능함
- [ ] 기존 기능 회귀 없음
- [ ] 성능 저하 없음 (재시도 외)
- [ ] 엔진 업데이트 실패 시 항상 복구 가능
