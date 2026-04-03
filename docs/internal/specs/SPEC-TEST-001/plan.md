# SPEC-TEST-001 구현 계획

## 1. 작업 분해

### Phase 1: 환경 설정 (예상: 30분)

#### Task 1.1: Playwright 설치 및 설정
```bash
bun add -D @playwright/test
npx playwright install chromium
```

#### Task 1.2: playwright.config.ts 생성
- 테스트 디렉토리 설정
- 웹서버 자동 시작 설정
- 스크린샷/트레이스 설정
- 리포트 설정

#### Task 1.3: wrangler.toml 테스트 DB 추가
```toml
# 테스트용 D1 바인딩 추가
[[env.test.d1_databases]]
binding = "DB"
database_name = "clinic-os-test"
database_id = "local"
```

---

### Phase 2: 테스트 인프라 구축 (예상: 1시간)

#### Task 2.1: 테스트 시드 데이터 생성
- `seeds/test-data.sql` 생성
- 테스트용 관리자 계정
- 테스트용 직원 데이터
- 테스트용 환자 데이터

#### Task 2.2: Global Setup/Teardown 구현
- `tests/global-setup.ts`: DB 초기화 및 시드
- `tests/global-teardown.ts`: 테스트 후 정리

#### Task 2.3: 인증 Fixture 구현
- `tests/fixtures/auth.ts`
- 관리자 로그인 상태 유지
- 인증된 page 객체 제공

---

### Phase 3: 핵심 테스트 작성 (예상: 2시간)

#### Task 3.1: 로그인 테스트
```typescript
// tests/e2e/auth/login.spec.ts
- 올바른 자격증명으로 로그인 성공
- 잘못된 비밀번호로 로그인 실패
- 로그아웃 후 리다이렉트
```

#### Task 3.2: 직원 관리 테스트 (HIGH PRIORITY)
```typescript
// tests/e2e/admin/staff.spec.ts
- 직원 목록 조회
- 새 직원 등록
- 직원 정보 수정
- 직원 삭제 후 목록에서 제거 확인 ← 버그 재발 방지
```

#### Task 3.3: 환자 관리 테스트
```typescript
// tests/e2e/admin/patients.spec.ts
- 환자 목록 조회
- 환자 상세 정보 확인
```

---

### Phase 4: NPM 스크립트 및 문서화 (예상: 30분)

#### Task 4.1: package.json 스크립트 추가
```json
{
  "scripts": {
    "test:db:init": "wrangler d1 execute clinic-os-test --local --file=migrations/0000_initial_schema.sql",
    "test:db:seed": "wrangler d1 execute clinic-os-test --local --file=seeds/test-data.sql",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:ui": "playwright test --ui",
    "test": "bun run test:db:init && bun run test:db:seed && bun run test:e2e"
  }
}
```

#### Task 4.2: 테스트 실행 가이드 문서화
- README에 테스트 실행 방법 추가
- 새 테스트 작성 가이드

---

## 2. 구현 순서 및 의존성

```
┌─────────────────┐
│  Phase 1        │
│  환경 설정       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Phase 2        │
│  인프라 구축     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Phase 3        │
│  테스트 작성     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Phase 4        │
│  스크립트/문서   │
└─────────────────┘
```

---

## 3. 파일 생성 목록

| 파일 경로 | 설명 | Phase |
|----------|------|-------|
| `playwright.config.ts` | Playwright 설정 | 1 |
| `seeds/test-data.sql` | 테스트 시드 데이터 | 2 |
| `tests/global-setup.ts` | DB 초기화 | 2 |
| `tests/global-teardown.ts` | DB 정리 | 2 |
| `tests/fixtures/auth.ts` | 인증 fixture | 2 |
| `tests/e2e/auth/login.spec.ts` | 로그인 테스트 | 3 |
| `tests/e2e/admin/staff.spec.ts` | 직원 관리 테스트 | 3 |
| `tests/e2e/admin/patients.spec.ts` | 환자 관리 테스트 | 3 |

---

## 4. 검증 방법

### 4.1 단위 검증
각 Phase 완료 후 개별 검증:
- Phase 1: `npx playwright --version` 실행 확인
- Phase 2: `bun run test:db:init` 성공 확인
- Phase 3: 개별 테스트 파일 실행
- Phase 4: `bun run test` 전체 실행

### 4.2 통합 검증
```bash
# 전체 테스트 실행
bun run test

# 예상 결과:
# ✓ 3 passed (30s)
# - auth/login.spec.ts
# - admin/staff.spec.ts
# - admin/patients.spec.ts
```

---

## 5. 롤백 계획

### 5.1 실패 시 조치
- 설치된 패키지 제거: `bun remove @playwright/test`
- 생성된 파일 삭제: `rm -rf tests/ playwright.config.ts`
- wrangler.toml 테스트 DB 설정 제거

### 5.2 부분 롤백
- 특정 Phase만 실패 시 해당 Phase 파일만 제거 후 재시도
