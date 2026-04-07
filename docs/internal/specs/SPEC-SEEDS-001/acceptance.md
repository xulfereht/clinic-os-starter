# SPEC-SEEDS-001: 인수 조건

---
spec_id: SPEC-SEEDS-001
version: "1.0.0"
created: "2025-01-30"
---

## 1. Seeds Manifest 시스템

### AC-001: Manifest 로딩

```gherkin
Feature: Seeds Manifest 로딩
  seeds.manifest.json을 통해 Seeds 메타데이터를 관리한다

  Scenario: 유효한 Manifest 로딩
    Given seeds/seeds.manifest.json이 존재함
    And JSON 형식이 유효함
    When db:seed를 실행하면
    Then manifest의 seeds 목록을 기준으로 실행됨
    And 카테고리 순서대로 실행됨

  Scenario: Manifest 없을 때 기존 동작
    Given seeds/seeds.manifest.json이 존재하지 않음
    When db:seed를 실행하면
    Then seeds/ 폴더의 모든 .sql 파일이 실행됨
    And 파일명 알파벳 순으로 실행됨
    And 경고 없이 정상 완료됨

  Scenario: Manifest 파싱 오류
    Given seeds/seeds.manifest.json이 잘못된 JSON 형식임
    When db:seed를 실행하면
    Then 경고 메시지가 출력됨: "seeds.manifest.json 파싱 실패"
    And 기존 동작 (전체 SQL 실행)으로 Fallback됨
```

### AC-002: 카테고리 기반 실행

```gherkin
Feature: 카테고리 기반 Seeds 실행
  Seeds를 카테고리별로 분류하여 관리한다

  Scenario: 카테고리 순서대로 실행
    Given manifest에 categories 순서가 정의됨:
      | category    | order |
      | system      | 1     |
      | translation | 2     |
      | sample      | 3     |
      | plugin      | 4     |
    When db:seed를 실행하면
    Then system 카테고리 Seeds가 먼저 실행됨
    And translation이 그 다음 실행됨
    And sample이 그 다음 실행됨
    And plugin이 마지막에 실행됨

  Scenario: 특정 카테고리만 실행
    Given manifest에 system, sample Seeds가 정의됨
    When db:seed --category=sample을 실행하면
    Then sample 카테고리 Seeds만 실행됨
    And system Seeds는 실행되지 않음
```

---

## 2. Idempotency 처리

### AC-003: UNIQUE 오류 처리

```gherkin
Feature: UNIQUE constraint 오류 처리
  중복 데이터 삽입 시도를 안전하게 처리한다

  Scenario: UNIQUE 오류 시 스킵하고 계속 진행
    Given sample_patients.sql이 이미 적용됨
    And 해당 데이터가 DB에 존재함
    When sample_patients.sql을 다시 실행하면
    Then UNIQUE constraint 오류가 발생함
    And 해당 Seed는 "이미 존재" 메시지와 함께 스킵됨
    And d1_seeds 테이블에 기록됨
    And 후속 Seeds는 계속 실행됨

  Scenario: 중복 실행해도 오류 없음
    Given db:seed가 한 번 완료됨
    When db:seed를 다시 실행하면
    Then 오류 없이 완료됨
    And 로그에 "이미 적용됨" 또는 스킵 메시지가 출력됨
```

### AC-004: INSERT OR IGNORE 패턴

```gherkin
Feature: Idempotent SQL 패턴
  Seeds 파일은 멱등성을 보장하는 패턴을 사용해야 한다

  Scenario: 올바른 패턴 사용
    Given seed_templates.sql에 INSERT OR IGNORE 패턴이 사용됨
    When 동일 데이터로 두 번 실행하면
    Then 첫 번째 실행: 데이터 삽입됨
    And 두 번째 실행: 조용히 스킵됨 (오류 없음)

  Scenario: UPSERT 패턴 지원
    Given settings Seed에 ON CONFLICT DO UPDATE 패턴 사용됨
    When 동일 key로 두 번 실행하면
    Then 첫 번째 실행: 데이터 삽입됨
    And 두 번째 실행: 데이터 업데이트됨 (오류 없음)
```

---

## 3. 환경별 적용 제어

### AC-005: Production 환경에서 Sample 스킵

```gherkin
Feature: Production 환경 보호
  운영 환경에서 샘플 데이터가 자동 적용되지 않아야 한다

  Scenario: Production에서 sample 자동 스킵
    Given ENVIRONMENT=production 환경 변수가 설정됨
    When db:seed를 실행하면
    Then category=system Seeds가 실행됨
    And category=translation Seeds가 실행됨
    And category=sample Seeds는 스킵됨
    And 로그에 "production 환경: sample 카테고리 스킵" 출력됨

  Scenario: Production에서 sample 강제 실행
    Given ENVIRONMENT=production 환경 변수가 설정됨
    When db:seed --category=sample --force를 실행하면
    Then 경고 메시지 출력: "Production 환경에서 sample Seeds 실행"
    And sample Seeds가 실행됨

  Scenario: Development에서 모든 Seeds 실행
    Given ENVIRONMENT=development 환경 변수가 설정됨
    When db:seed를 실행하면
    Then 모든 카테고리 Seeds가 실행됨 (sample 포함)
```

---

## 4. 의존성 관리

### AC-006: Seeds 간 의존성

```gherkin
Feature: Seeds 의존성 순서
  depends_on으로 지정된 Seeds가 먼저 실행되어야 한다

  Scenario: 의존성 순서 적용
    Given manifest에 다음 의존성이 정의됨:
      | file                | depends_on        |
      | sample_patients.sql | sample_clinic.sql |
      | sample_ops_data.sql | sample_clinic.sql |
    When db:seed --category=sample을 실행하면
    Then sample_clinic.sql이 먼저 실행됨
    And 그 후 sample_patients.sql과 sample_ops_data.sql이 실행됨

  Scenario: 의존성 미충족 시 경고
    Given sample_patients.sql이 sample_clinic.sql에 의존함
    And sample_clinic.sql이 d1_seeds에 없음
    When db:seed --file=sample_patients.sql을 실행하면
    Then 경고 메시지: "의존성 sample_clinic.sql이 적용되지 않음"
    And 실행 여부를 사용자에게 확인함
```

---

## 5. 추적 및 리포팅

### AC-007: d1_seeds 테이블 기록

```gherkin
Feature: Seeds 적용 기록
  d1_seeds 테이블에 적용 상태를 정확히 기록한다

  Scenario: 성공한 Seed 기록
    Given seed_templates.sql이 성공적으로 실행됨
    When d1_seeds 테이블을 조회하면
    Then "seed_templates.sql" 레코드가 존재함
    And applied_at 필드에 실행 시간이 기록됨

  Scenario: 이미 적용된 Seed 스킵
    Given d1_seeds에 "seed_templates.sql"이 있음
    When db:seed를 실행하면
    Then seed_templates.sql은 실행되지 않음
    And 로그에 출력 없음 (조용히 스킵)

  Scenario: 실패한 Seed는 기록 안 됨
    Given invalid_seed.sql이 문법 오류로 실패함
    When d1_seeds 테이블을 조회하면
    Then "invalid_seed.sql" 레코드가 없음
```

### AC-008: 실행 리포트

```gherkin
Feature: Seeds 실행 리포트
  실행 결과를 명확하게 리포팅한다

  Scenario: 전체 실행 리포트
    Given 10개 Seeds 중 8개 적용, 2개 스킵 (이미 존재)
    When db:seed 완료 시
    Then 다음 형식의 리포트가 출력됨:
      """
      🌱 Seeds 적용 결과:
         - 적용: 8개
         - 스킵 (이미 존재): 2개
         - 실패: 0개
      """

  Scenario: Dry-run 리포트
    Given db:seed --dry-run을 실행함
    When 실행 계획이 출력되면
    Then 실제 SQL은 실행되지 않음
    And 출력에 다음 정보가 포함됨:
      | 순서 | 파일명 | 카테고리 | 상태 |
      | 1 | seed_templates.sql | system | 적용 예정 |
      | 2 | sample_patients.sql | sample | 이미 적용됨 |
```

---

## 6. CLI 옵션

### AC-009: CLI 인터페이스

```gherkin
Feature: Seeds CLI 옵션
  다양한 옵션으로 Seeds 실행을 제어한다

  Scenario Outline: CLI 옵션 동작
    When db:seed <options>을 실행하면
    Then <expected_behavior>

    Examples:
      | options | expected_behavior |
      | (없음) | 전체 Seeds 실행 |
      | --category=system | system Seeds만 실행 |
      | --category=sample | sample Seeds만 실행 |
      | --file=seed_templates.sql | 해당 파일만 실행 |
      | --dry-run | 실행 계획만 출력 |
      | --env=production | sample 스킵 |
      | --force | 경고 무시하고 실행 |
```

---

## 7. 하위 호환성

### AC-010: 기존 시스템 호환

```gherkin
Feature: 하위 호환성
  기존 클라이언트와 호환되어야 한다

  Scenario: Manifest 없는 기존 클라이언트
    Given seeds/ 폴더에 .sql 파일만 있음 (manifest 없음)
    When 새 fetch.js로 db:seed 실행하면
    Then 기존과 동일하게 동작함
    And 모든 .sql 파일이 알파벳 순으로 실행됨

  Scenario: d1_seeds 테이블 호환
    Given 기존 d1_seeds 테이블 스키마가 있음 (name, applied_at만)
    When 새 코드로 Seed를 실행하면
    Then 기존 스키마로 정상 동작함
    And 새 컬럼(category 등)은 선택적으로 사용됨
```

---

## 8. Seeds Lockfile

### AC-011: Lockfile 생성 및 갱신

```gherkin
Feature: Seeds Lockfile 관리
  seeds.lock 파일로 적용 상태를 추적한다

  Scenario: 최초 Seeds 적용 시 Lockfile 생성
    Given seeds.lock 파일이 존재하지 않음
    When db:seed를 성공적으로 실행하면
    Then seeds/seeds.lock 파일이 생성됨
    And 적용된 모든 Seeds의 checksum이 기록됨
    And generated_at 타임스탬프가 기록됨

  Scenario: 추가 Seeds 적용 시 Lockfile 갱신
    Given seeds.lock에 5개 Seeds가 기록됨
    And 새로운 Seed 파일 2개가 추가됨
    When db:seed를 실행하면
    Then seeds.lock에 7개 Seeds가 기록됨
    And 기존 5개의 checksum은 유지됨
```

### AC-012: 변경 감지 및 재적용

```gherkin
Feature: Seeds 변경 감지
  Checksum 비교로 변경된 Seeds를 감지한다

  Scenario: 변경된 Seeds만 재적용
    Given seed_templates.sql이 수정됨 (checksum 변경)
    When db:seed --changed-only를 실행하면
    Then seed_templates.sql만 재적용됨
    And 변경되지 않은 Seeds는 스킵됨
    And seeds.lock의 checksum이 갱신됨

  Scenario: 변경 감지 경고
    Given seed_templates.sql이 수정됨
    When db:seed를 실행하면
    Then 경고 메시지: "1개 Seed 파일 변경 감지됨"
    And "재적용하려면 --changed-only 또는 --force 사용" 안내됨
```

---

## 9. Health Check

### AC-013: 필수 데이터 검증

```gherkin
Feature: Seeds Health Check
  Seeds 적용 후 데이터 무결성을 검증한다

  Scenario: Health Check 통과
    Given system Seeds가 모두 적용됨
    When db:seed --health-check를 실행하면
    Then 모든 필수 테이블에 최소 데이터 존재 확인됨
    And "Health Check PASSED" 메시지 출력됨
    And seeds.lock에 health_check 결과 기록됨

  Scenario: Health Check 실패
    Given message_templates 테이블이 비어있음
    When db:seed --health-check를 실행하면
    Then "Health Check FAILED" 메시지 출력됨
    And 실패한 테이블 목록이 출력됨:
      | table | expected | actual | status |
      | message_templates | 5 | 0 | FAIL |
    And 권장 조치 안내됨
```

---

## 10. Retry 메커니즘

### AC-014: SQLITE_BUSY 재시도

```gherkin
Feature: Seeds SQLITE_BUSY 재시도
  DB 락 충돌 시 자동으로 재시도한다

  Scenario: 1회 SQLITE_BUSY 후 성공
    Given Seeds 실행 중 첫 번째 시도에서 SQLITE_BUSY 발생
    When 200ms 후 재시도하면
    Then Seed가 성공적으로 적용됨
    And 로그에 "⏳ SQLITE_BUSY - 200ms 후 재시도 (1/3)" 출력됨

  Scenario: 3회 재시도 후 실패
    Given 3회 연속 SQLITE_BUSY 발생
    When 최대 재시도 횟수에 도달하면
    Then 해당 Seed는 실패로 처리됨
    And 후속 Seeds는 계속 실행됨 (개별 실패 허용)
    And 실패 요약에 포함됨
```

---

## 11. Seeds Reset

### AC-015: 샘플 데이터 초기화

```gherkin
Feature: Seeds Reset
  샘플 데이터를 안전하게 초기화한다

  Scenario: 개발 환경에서 sample 초기화
    Given ENVIRONMENT=development
    And is_sample=1인 데이터가 존재함
    When db:seed --reset --category=sample을 실행하면
    Then is_sample=1인 데이터가 삭제됨
    And d1_seeds에서 sample 카테고리 레코드 삭제됨
    And sample Seeds가 재적용됨

  Scenario: Production 환경 보호
    Given ENVIRONMENT=production
    When db:seed --reset을 실행하면
    Then 에러 메시지: "Production 환경에서 --reset은 --force 필수"
    And 데이터 삭제되지 않음

  Scenario: Production에서 강제 Reset
    Given ENVIRONMENT=production
    When db:seed --reset --force를 실행하면
    Then 경고 메시지 출력: "⚠️ Production 환경에서 샘플 데이터 초기화"
    And 확인 프롬프트 표시됨
    And 승인 시에만 Reset 실행됨
```

---

## 12. Definition of Done

### 필수 조건

- [ ] 모든 Acceptance Criteria 테스트 통과
- [ ] 기존 db:seed 명령어 정상 동작
- [ ] UNIQUE 오류 처리 동작 확인
- [ ] Production 환경에서 sample 스킵 동작 확인
- [ ] 코드 리뷰 완료

### 권장 조건

- [ ] seeds.manifest.json 생성 및 검증
- [ ] 기존 27개 Seeds 카테고리 분류 완료
- [ ] _README.md 가이드 문서 작성
- [ ] Idempotency 미준수 파일 목록 작성

### 품질 기준

- [ ] 중복 실행 시 오류 없음
- [ ] 기존 기능 회귀 없음
- [ ] 리포트 메시지가 명확함
