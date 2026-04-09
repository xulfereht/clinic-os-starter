# SPEC-TEST-001 인수 조건

## 1. 핵심 시나리오

### Scenario 1: 테스트 환경 초기화

```gherkin
Given 프로젝트에 Playwright가 설치되어 있고
  And playwright.config.ts가 올바르게 설정되어 있을 때
When 개발자가 "bun run test:db:init" 명령을 실행하면
Then 테스트 전용 D1 데이터베이스가 생성되어야 하고
  And 스키마가 프로덕션과 동일하게 적용되어야 한다
```

### Scenario 2: 테스트 시드 데이터 삽입

```gherkin
Given 테스트 DB가 초기화되어 있을 때
When 개발자가 "bun run test:db:seed" 명령을 실행하면
Then 테스트용 관리자 계정이 생성되어야 하고
  And 테스트용 직원 데이터가 삽입되어야 하고
  And 테스트용 환자 데이터가 삽입되어야 한다
```

### Scenario 3: 전체 테스트 실행

```gherkin
Given 테스트 환경이 완전히 설정되어 있을 때
When 개발자가 "bun run test" 명령을 실행하면
Then 테스트 DB 초기화가 자동으로 실행되어야 하고
  And 시드 데이터가 삽입되어야 하고
  And 모든 E2E 테스트가 실행되어야 하고
  And 테스트 결과가 콘솔에 출력되어야 한다
```

---

## 2. 기능별 테스트 시나리오

### 2.1 로그인 테스트

```gherkin
Scenario: 올바른 자격증명으로 로그인
Given 관리자 로그인 페이지(/admin/login)에 있을 때
When 올바른 이메일과 비밀번호를 입력하고
  And 로그인 버튼을 클릭하면
Then 관리자 대시보드(/admin)로 리다이렉트되어야 한다

Scenario: 잘못된 비밀번호로 로그인 실패
Given 관리자 로그인 페이지에 있을 때
When 올바른 이메일과 잘못된 비밀번호를 입력하고
  And 로그인 버튼을 클릭하면
Then 오류 메시지가 표시되어야 하고
  And 로그인 페이지에 머물러야 한다
```

### 2.2 직원 관리 테스트 (HIGH PRIORITY - 버그 재발 방지)

```gherkin
Scenario: 직원 목록 조회
Given 관리자로 로그인한 상태에서
When 직원 관리 페이지(/admin/staff)로 이동하면
Then 등록된 직원 목록이 표시되어야 하고
  And 삭제된 직원은 목록에 표시되지 않아야 한다

Scenario: 새 직원 등록
Given 직원 관리 페이지에 있을 때
When 새 직원 등록 버튼을 클릭하고
  And 필수 정보(이름, 부서, 직군)를 입력하고
  And 저장 버튼을 클릭하면
Then 직원이 성공적으로 등록되어야 하고
  And 직원 목록에 새 직원이 표시되어야 한다

Scenario: 직원 삭제 후 목록에서 제거 확인 ← 핵심 테스트
Given 직원 수정 페이지(/admin/staff/[id])에 있을 때
  And 해당 직원의 이름을 기억해두고
When 삭제 버튼을 클릭하고
  And 확인 다이얼로그에서 삭제를 확인하면
Then 직원 목록 페이지로 리다이렉트되어야 하고
  And 삭제한 직원이 목록에 표시되지 않아야 한다
  And 삭제된 직원의 URL로 직접 접근 시 목록으로 리다이렉트되어야 한다
```

### 2.3 환자 관리 테스트

```gherkin
Scenario: 환자 목록 조회
Given 관리자로 로그인한 상태에서
When 환자 관리 페이지(/admin/patients)로 이동하면
Then 등록된 환자 목록이 표시되어야 한다

Scenario: 환자 상세 정보 확인
Given 환자 목록 페이지에 있을 때
When 특정 환자의 상세보기를 클릭하면
Then 해당 환자의 상세 정보가 표시되어야 한다
```

---

## 3. 엣지 케이스 테스트

```gherkin
Scenario: 권한 없는 페이지 접근
Given 로그인하지 않은 상태에서
When 관리자 페이지(/admin)에 직접 접근하면
Then 로그인 페이지로 리다이렉트되어야 한다

Scenario: 존재하지 않는 직원 접근
Given 관리자로 로그인한 상태에서
When 존재하지 않는 직원 ID로 직접 접근하면
Then 직원 목록 페이지로 리다이렉트되어야 한다

Scenario: 네트워크 오류 시 적절한 피드백
Given 관리자 페이지에 있을 때
When API 요청이 실패하면
Then 사용자에게 오류 메시지가 표시되어야 한다
```

---

## 4. 성능 기준

| 항목 | 기준 |
|-----|------|
| 전체 테스트 실행 시간 | < 60초 |
| 개별 테스트 타임아웃 | < 30초 |
| 병렬 실행 워커 수 | 1 (로컬 D1 동시성 제한) |

---

## 5. 품질 게이트

### 5.1 테스트 통과 기준
- [ ] 모든 E2E 테스트 통과
- [ ] 테스트 실행 중 프로덕션 DB 접근 없음
- [ ] 스크린샷/트레이스 정상 저장

### 5.2 코드 품질 기준
- [ ] playwright.config.ts 설정 완료
- [ ] 테스트 파일 TypeScript 타입 오류 없음
- [ ] 재사용 가능한 fixture 구현

### 5.3 문서화 기준
- [ ] package.json 스크립트 추가
- [ ] 테스트 실행 방법 문서화

---

## 6. 완료 정의 (Definition of Done)

SPEC-TEST-001은 다음 조건을 모두 충족할 때 완료됩니다:

1. **환경 설정 완료**
   - Playwright 설치됨
   - playwright.config.ts 생성됨
   - wrangler.toml 테스트 DB 설정됨

2. **테스트 인프라 완료**
   - seeds/test-data.sql 생성됨
   - global-setup.ts 동작함
   - auth fixture 구현됨

3. **핵심 테스트 완료**
   - 로그인 테스트 통과
   - 직원 CRUD 테스트 통과 (삭제 후 목록 확인 포함)
   - 환자 조회 테스트 통과

4. **실행 가능**
   - `bun run test` 명령으로 전체 테스트 실행 가능
   - 테스트 결과 리포트 생성됨
