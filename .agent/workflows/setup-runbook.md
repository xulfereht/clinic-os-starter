---
description: 초기 설치 및 DB 초기화 절차의 SOT. 셋업 시 반드시 참조.
---

# 셋업 런북

> 이 문서는 초기 설치 시 에이전트와 사람이 참조하는 SOT입니다.
> `npm run setup:step` 또는 `npm run setup:agent`로 설치를 진행합니다.

---

## 설치 흐름

```
npm run setup:agent (자동) 또는 npm run setup:step -- --next (단계별)
  ↓
Phase 1: 환경 (cf-login, device-register)
Phase 2: 의존성 (npm install)
Phase 3: Git (upstream 설정)
Phase 4: 설정 (wrangler.toml, clinic.json)
Phase 5: DB (migrate → seed)
Phase 6: 온보딩 준비 (onboarding-state.json 생성)
  ↓
설치 완료 → 온보딩 시작 (.agent/workflows/onboarding.md)
```

---

## DB 초기화 정책 (SOT)

### DDL/DML 분리 (절대 규칙)

| 디렉토리 | 내용 | 적용 시점 |
|----------|------|----------|
| `migrations/` | DDL만 (CREATE, ALTER, INDEX, DROP) | 설치 + core:pull + deploy |
| `seeds/` | DML만 (INSERT OR IGNORE/REPLACE) | 설치 + core:pull (미적용만) |

**절대 금지:**
- migrations/에 INSERT/UPDATE/DELETE 넣지 않음
- seeds/에 DROP/ALTER 넣지 않음
- 프로덕션 데이터를 덮어쓰는 시드 작성 금지

### 로컬 vs 리모트 적용

| 시점 | 로컬 DB | 리모트 (프로덕션) DB |
|------|---------|-------------------|
| **초기 설치** | DDL ✅ + DML ✅ | DDL ✅ + DML ✅ |
| **core:pull** (업데이트) | 새 DDL ✅ + 미적용 시드 ✅ | ❌ (deploy 시 적용) |
| **deploy-guard** (배포) | ❌ | DDL ✅ (갭 자동 체크) |

### d1_seeds 추적 시스템

```sql
-- 이 테이블이 적용된 시드를 추적
CREATE TABLE IF NOT EXISTS d1_seeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  applied_at TEXT DEFAULT (datetime('now'))
);
```

- 초기 설치: 모든 시드 실행 후 d1_seeds에 기록
- core:pull: d1_seeds에 없는 시드만 실행 → 기존 데이터 보호
- 시드 SQL은 반드시 `INSERT OR IGNORE` 또는 `INSERT OR REPLACE` 사용

### 새 기능에 필수 데이터가 필요할 때

```
1. migrations/에 DDL 작성 (CREATE TABLE, ALTER TABLE)
2. seeds/에 DML 작성 (INSERT OR IGNORE)
3. core:push → 클라이언트에 배포
4. 클라이언트 core:pull → DDL 자동 적용 + 새 시드 자동 실행
```

---

## 주의사항

### CF 인증 실패 시

```bash
npm run setup:step -- --step=cf-login    # CF 로그인 재시도
npx wrangler login                        # 수동 로그인
```

- D1 database_id가 `local-db-placeholder`로 남아있으면 D1 생성 실패
- `wrangler.toml`에서 database_id를 확인하고 수동 설정 필요

### 마이그레이션 실패 시

```bash
npm run doctor                    # 스키마 검증
npm run db:migrate                # 로컬 마이그레이션 재시도
npm run db:migrate -- --remote    # 리모트 마이그레이션
```

- migrate.js는 PRAGMA로 컬럼 존재 확인 → 이미 적용된 DDL은 안전하게 스킵
- `d1_migrations` 테이블에서 적용 기록 확인 가능

### 시드 실패 시

```bash
npm run db:seed       # 시드 재실행 (d1_seeds 추적으로 중복 방지)
```

- 시드는 멱등 — 재실행해도 기존 데이터 덮어쓰지 않음
- d1_seeds 테이블로 이미 적용된 시드 확인 가능

### 설치 중단 후 재개

```bash
npm run setup:step -- --status    # 현재 진행 상태 확인
npm run setup:step -- --next      # 다음 단계 이어서 실행
```

- `setup-progress.json`이 각 단계 완료 상태를 기록
- 실패한 단계에서 자동 재시도 (exponential backoff)
- SQLITE_BUSY 에러: 다른 프로세스가 DB 사용 중 → 자동 재시도

### 데모 모드 (--demo-mode)

- operator CF 계정으로 설치 → 핸드오프 후 클라이언트 계정 전환
- device-register 스킵
- 리모트 시드 자동 적용 (cfTokenMode 활성)

---

## 설치 후 체크리스트

```
[ ] wrangler.toml의 database_id가 유효한 UUID인지 확인
[ ] npm run health → score >= 80
[ ] npm run doctor → 스키마 정상
[ ] /admin 로그인 가능
[ ] 로컬 서버 (npm run dev) 정상 동작
[ ] onboarding-state.json 생성됨
```

---

## 참조

- `scripts/setup-step.js` — 17단계 자동 설치 코드
- `scripts/setup-clinic.js` — 레거시 모놀리식 설치
- `.docking/engine/migrate.js` — 마이그레이션 엔진
- `.docking/engine/fetch.js` — core:pull 엔진 (runAllSeeds 포함)
- `.agent/workflows/onboarding.md` — 설치 후 온보딩 진행
