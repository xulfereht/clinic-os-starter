---
description: Clinic-OS 트러블슈팅 및 복구 가이드 (에이전트용)
---

# Clinic-OS 트러블슈팅 & 복구

클라이언트 환경에서 발생하는 주요 문제와 복구 절차를 정리합니다.

---

## 에이전트 자동 진입

> **`.agent/last-error.json`이 존재하면 이 워크플로우에 자동 진입하세요.**

`core:pull`, `db:init`, `db:migrate` 등의 명령에서 에러가 발생하면 `.agent/last-error.json`에 구조화된 에러 보고서가 자동 저장됩니다.

### 자동 복구 절차

1. `.agent/last-error.json` 읽기
2. `phase` 필드로 에러 단계 파악
3. `recovery.section`으로 아래 시나리오 번호 매칭
4. `recovery.commands`를 순서대로 실행
5. 성공 시 `.agent/last-error.json` 삭제
6. **실패 시 반드시 사용자에게 보고** (에러 내용 + 시도한 복구 + 추천 조치)

### Phase별 매핑

| phase | 의미 | 관련 시나리오 |
|-------|------|--------------|
| `git-fetch` | upstream fetch 실패 | 시나리오 1, 4 |
| `migration` | DB 마이그레이션 실패 | 시나리오 6 |
| `precondition` | 전제 조건 미충족 | 시나리오 3 (wrangler.toml 등) |
| `unknown` | 분류 불가 에러 | `npm run health`부터 시작 |

---

## 진단 우선순위

문제 발생 시 아래 순서로 접근합니다:

1. **`npm run health`** — 환경 건강 점수 (0-100) 확인
2. **`npm run core:status`** — 현재 코어 버전, 백업 상태 확인
3. **`npm run doctor`** — DB 스키마 검증
4. **`npm run agent:doctor -- --json`** — 버전/에러/자동 조치 우선순위 확인
5. 위 결과로 원인 파악 → 아래 시나리오별 대응

---

## 복구 명령어 레퍼런스

### 🆕 Agent-First Error Recovery (v1.0+)

| 명령어 | 용도 | 파괴적? |
|--------|------|---------|
| `npm run agent:doctor -- --json` | 설치/버전/에러/권장 조치 진단 | 아니오 |
| `npm run agent:lifecycle -- --json` | 신규 설치/업데이트/재설치 시나리오 판별 | 아니오 |
| `npm run agent:snapshot -- --reason=...` | 보호 스냅샷 생성 | 아니오 |
| `npm run agent:restore -- --dry-run --json` | 자동 백업/형제 폴더 기준 복원 계획 확인 | 아니오 |
| `npm run agent:sync -- --dry-run` | 자동 조치 후보 미리보기 | 아니오 |
| `npm run agent:sync` | 안전한 자동 조치 실행 | 부분적 |
| `npm run status` | **통합 상태 확인** (설치+온볼딩+건강도+Lock) | 아니오 |
| `npm run error:status` | 에러 복구 상태 확인 | 아니오 |
| `npm run error:recover` | 자동 복구 시도 (autoRecoverable 단계만) | 부분적 |
| `npm run error:recover -- --force` | 강제 복구 (수동 단계도 시도) | 부분적 |
| `npm run error:resolve` | 에러 수동 해결 표시 | 아니오 |
| `npm run tx:rollback` | 마지막 체크포인트로 롤백 | 예 |
| `npm run tx:list` | 체크포인트 목록 | 아니오 |

### 기존 명령어

| 명령어 | 용도 | 파괴적? |
|--------|------|---------|
| `npm run health` | 환경 진단 (점수 산출) | 아니오 |
| `npm run health:fix` | 진단 + 자동 수정 | 부분적 |
| `npm run core:status` | 코어 버전/백업 상태 | 아니오 |
| `npm run core:repair` | core/ 서브모듈 깨짐 복구 | 부분적 |
| `npm run core:rollback` | 이전 코어 버전으로 복원 | 예 |
| `npm run core:rollback --list` | 복원 가능한 백업 목록 | 아니오 |
| `npm run update:starter` | 인프라 파일만 HQ에서 재다운로드 | 아니오 |
| `npm run doctor` | DB 스키마 검증 + 자동 복구 | 부분적 |
| `npm run db:migrate` | 마이그레이션 재실행 (멱등) | 아니오 |
| `npm run db:backup --list` | DB 백업 목록 | 아니오 |
| `npm run db:restore` | 최신 DB 백업에서 복원 | 예 |
| `npm run setup` | 전체 12단계 재초기화 (레거시, 대화형) | 부분적 |
| `npm run setup:fast` | 고성능 macOS/WSL Ubuntu 환경용 빠른 일괄 setup | 부분적 |
| `npm run setup:step -- --next` | 다음 단계 설치 (Agent-First) | 부분적 |

---

## 시나리오별 대응

### 1. core:pull "깃 저장소가 아닙니다"

**원인**: 루트에 `.git`이 없음 (스타터킷 초기 구조 또는 삭제됨)

```bash
git init
npm run core:pull -- --auto
```

> v1.24.0부터 `fetch.js`와 `update:starter`가 자동으로 `git init` 실행

---

### 2. core/ 서브모듈 깨짐 (core/.git 존재)

**증상**: core:pull 실패, git 오류, "embedded git repository" 경고

```bash
npm run core:repair
# → .git/modules/core 제거
# → core/.git 제거
# → .gitmodules에서 core 엔트리 제거
npm run core:pull
```

---

### 3. 스타터킷 인프라 손상 (fetch.js, 스크립트 깨짐)

**증상**: `npm run core:pull` 자체가 실행 안 됨, 스크립트 에러

> **⚠️ 닭과 달걀 문제**: fetch.js의 버그 수정은 **다음** core:pull부터 적용됩니다.
> core:pull 실행 중인 fetch.js는 이미 메모리에 로드된 구 버전이므로, 새 버전의
> 수정사항이 현재 세션에서는 적용되지 않습니다.
> **긴급 수정이 필요하면**: `npm run update:starter` 후 core:pull을 **다시** 실행하세요.

```bash
npm run update:starter
# → HQ R2에서 최신 인프라 파일 재다운로드:
#   .docking/engine/fetch.js, migrate.js, schema-validator.js
#   scripts/setup-clinic.js, update-starter.js, deploy-guard.js 등
```

**update:starter도 안 되면** (update-starter.js 자체가 손상):
```bash
# 독립 실행 가능한 단일 파일 버전 사용
node scripts/update-starter-standalone.cjs
```

**standalone도 안 되면** (HQ에서 직접 다운로드):
```bash
curl -o scripts/update-starter-standalone.cjs \
  "https://clinic-os-hq.pages.dev/api/v1/starter-files/update-starter-standalone.cjs"
node scripts/update-starter-standalone.cjs
```

---

### 4. core:pull 중간에 실패 (네트워크 끊김, 디스크 부족)

**증상**: 일부 파일만 업데이트됨, 빌드 깨짐

```bash
# 백업 확인
npm run core:rollback --list

# 이전 버전으로 복원
npm run core:rollback

# 네트워크 복구 후 재시도
npm run core:pull
```

---

### 5. .core/version 손상 또는 잘못된 태그

**증상**: core:pull이 버전 비교에 실패, 무한 로딩

```bash
# 현재 상태 확인
npm run core:status

# .core/version 수동 수정 (현재 설치된 실제 버전으로)
echo "v1.24.0" > .core/version

# 또는 완전 재동기화
npm run core:pull --force
```

---

### 6. core:pull 시 DB 마이그레이션/시드 전부 실패

**증상**: 0000_initial_schema.sql 실패, seeds 12건 전부 실패

**원인**: 로컬 D1 DB가 초기화되지 않은 상태 (`.wrangler/` 없음) 또는 wrangler.toml 누락

> **v1.24.3 변경사항**:
> - `db:init`/`db:migrate`는 root의 `.docking/engine/migrate.js`를 직접 실행 (이중 엔진 문제 해결)
> - wrangler.toml 존재를 먼저 확인 → 없으면 명확한 에러 + `.agent/last-error.json` 자동 생성
> - `findProjectRoot()`가 `core/package.json`도 감지하여 스타터킷에서 root를 정확히 탐지
> - 마이그레이션 실패 시 seeds 실행을 자동으로 건너뜀 (연쇄 에러 방지)
> - 에러 보고서에 `recovery.commands`가 포함되어 에이전트가 자동 복구 가능
>
> **v1.24.4 변경사항**:
> - DB 바인딩 기본 이름을 `clinic-os-db`로 통일 (이전: `local-clinic-db`/`clinic-os-db` 혼재)
> - wrangler.toml이 있으면 거기서 실제 이름을 읽고, 없으면 전부 동일한 fallback 사용

> v1.24.2부터 fetch.js가 자동으로 DB 상태를 감지합니다:
> 1. wrangler.toml 유효 DB ID → 자동 접근 시도
> 2. DB ID 변경으로 고아 DB 존재 → 데이터 자동 복구 후 스키마 마이그레이션
> 3. DB 없음 → 빈 DB 자동 생성
> 4. placeholder ID → 안내 메시지 (npm run setup 필요)

**wrangler.toml이 없는 경우** (두 가지 원인):
- **A) setup 미완료**: 처음 설치했는데 setup을 끝내지 않음 → 기본은 `npm run setup:step -- --next`
- **B) 삭제됨**: 기존 클라이언트가 실수로 삭제 → `npm run setup:step -- --next` 또는 고성능 macOS/WSL Ubuntu 환경이면 `npm run setup:fast -- --auto`
```bash
# 삭제 여부 확인
git log --diff-filter=D -- wrangler.toml

# 생성 또는 복구
npm run setup:step -- --next
# 또는 고성능 macOS/WSL Ubuntu 환경:
npm run setup:fast -- --auto
```

**wrangler.toml은 있지만 DB가 없는 경우**:
```bash
npm run db:init      # 스키마 마이그레이션 (root 엔진 직접 실행)
npm run db:seed      # 샘플 데이터 (마이그레이션 성공 시에만)
```

> 기존 DB가 있으면 마이그레이션은 증분만 적용됩니다.
> 기존 데이터는 절대 삭제되지 않습니다 (모든 DDL이 IF NOT EXISTS).

**`database_id = "local-db-placeholder"` 인 경우**:
- 로컬 개발용 기본값입니다. Cloudflare D1이 아직 연결되지 않았다는 뜻이지, 설치 실패 자체를 의미하지는 않습니다.
- 다만 로컬 D1 마이그레이션이 끝나지 않았다면 `npm run health:fix` 또는 `npm run db:migrate`로 복구해야 합니다.

---

### 6-1. DB ID 변경 후 기존 데이터가 보이지 않음 (고아 DB)

**증상**: wrangler.toml의 `database_id`를 변경했더니 기존 데이터가 사라짐

**원인**: miniflare는 DB ID를 해시하여 `.wrangler/state/v3/d1/` 안에 SQLite 파일명을 결정.
ID가 바뀌면 새 파일이 생성되고, 기존 파일은 고아 상태로 남음.

> v1.24.2부터 `ensureLocalDb()`가 자동으로 고아 DB를 탐지하고 복구합니다.
> 현재 DB가 비어있고 고아 DB에 데이터가 있으면 자동 복사 후 마이그레이션 적용.

**자동 복구가 되지 않은 경우 (수동)**:
```bash
# 1. 고아 DB 파일 확인
ls -la .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite

# 2. 가장 큰 파일이 기존 데이터일 가능성 높음
# 3. update:starter로 최신 fetch.js 받기
npm run update:starter

# 4. core:pull 재실행 (자동 복구 시도)
npm run core:pull
```

---

### 7. DB 마이그레이션 실패 (테이블/컬럼 오류)

**증상**: "no such column", "table already exists" 등

```bash
# 스키마 진단
npm run doctor

# 마이그레이션 재실행 (멱등성 — 안전)
npm run db:migrate

# 그래도 실패하면 DB 백업에서 복원
npm run db:backup --list
npm run db:restore
npm run db:migrate
```

---

### 7. 코어 파일을 실수로 수정한 경우

**증상**: core:pull 시 변경사항 덮어써짐

**예방**:
```bash
# 수정 전 _local/ 복사본 만들기
mkdir -p src/pages/_local/doctors
cp src/pages/doctors/index.astro src/pages/_local/doctors/index.astro
# _local/ 복사본 수정 → core:pull에 안전
```

**이미 수정한 경우**:
```bash
# 1. 수정 내용을 _local/로 옮기기
git diff src/pages/modified-file.astro > /tmp/my-changes.patch
git checkout src/pages/modified-file.astro

# 2. _local/ 에 적용
mkdir -p src/pages/_local/$(dirname modified-file.astro)
cp src/pages/modified-file.astro src/pages/_local/modified-file.astro
# _local/ 파일에 수정 내용 반영
```

---

### 8. _local/ 파일 import 경로 오류

**증상**: `Could not resolve "../../lib/clinic"` 빌드 에러

**원인**: Vite 로컬 오버라이드 플러그인이 `_local/` 파일을 가상 경로로 매핑

```
❌ src/pages/_local/ai-chat.astro → import '../../lib/clinic'  (물리적 경로)
✅ src/pages/_local/ai-chat.astro → import '../lib/clinic'     (가상 경로)
```

**규칙**: `_local/` 파일의 import는 원본 파일 위치(`src/pages/ai-chat.astro`) 기준으로 작성

---

### 9. HQ API 접속 불가

**증상**: core:pull, update:starter 타임아웃

**자동 폴백** (fetch.js 내장):
1. HQ API 실패 → Git 태그 폴백 (자동)
2. Git 태그도 실패 → 로컬 `.core/version` 사용

**수동 확인**:
```bash
# HQ 상태 확인
curl -s https://clinic-os-hq.pages.dev/api/health | head -5

# 로컬 캐시로 작업 (업데이트 없이)
npm run dev    # 기존 코드 그대로 개발 가능
npm run build  # 기존 코드 그대로 빌드 가능
```

---

### 10. 디바이스 등록 한도 초과

**증상**: setup 시 "디바이스 등록 한도 초과" 오류

- v1.24.0부터 클라이언트당 최대 5대
- 기존 3대 제한 클라이언트는 자동 상향됨

```bash
# 현재 등록된 디바이스 확인은 HQ 관리자에게 문의
# 또는 setup 재실행 시 자동 갱신
npm run setup
```

---

### 11. 스타터킷 완전 재설치 (최후의 수단)

모든 복구가 실패한 경우, 클라이언트 데이터를 보존하면서 재설치합니다.

시작 전에 먼저:

```bash
npm run agent:lifecycle -- --json
npm run agent:snapshot -- --reason=legacy-migration
npm run agent:restore -- --dry-run --json
```

가능하면 아래 수동 복사보다 `agent:restore` 계획을 먼저 확인하고, 데이터가 필요하면 `--restore-db-latest`를 명시적으로 선택합니다.

```bash
# 1. 클라이언트 데이터 백업
npm run db:backup
cp wrangler.toml /tmp/wrangler.toml.bak
cp clinic.json /tmp/clinic.json.bak
cp .docking/config.yaml /tmp/config.yaml.bak
cp -r src/pages/_local/ /tmp/_local-backup/
cp -r src/lib/local/ /tmp/lib-local-backup/
cp -r src/plugins/local/ /tmp/plugins-local-backup/
cp -r public/local/ /tmp/public-local-backup/

# 2. 인프라 재다운로드
npm run update:starter

# 3. 코어 재동기화
npm run core:pull

# 4. 클라이언트 데이터 복원
cp /tmp/wrangler.toml.bak wrangler.toml
cp /tmp/clinic.json.bak clinic.json
cp /tmp/config.yaml.bak .docking/config.yaml
cp -r /tmp/_local-backup/* src/pages/_local/
cp -r /tmp/lib-local-backup/* src/lib/local/
cp -r /tmp/plugins-local-backup/* src/plugins/local/
cp -r /tmp/public-local-backup/* public/local/

# 5. 의존성 + DB
npm install
npm run db:migrate

# 6. 검증
npm run health
npm run build
```

---

### 12. 배포 후 롤백 (프로덕션 문제 발생)

Cloudflare Pages는 이전 배포로 즉시 복원 가능합니다:

```bash
# 1. 이전 배포 목록 확인
npx wrangler pages deployment list

# 2. 이전 정상 배포로 롤백
npx wrangler pages deployment rollback

# 3. 확인
curl -s https://YOUR-SITE.pages.dev/api/health
```

대안: Cloudflare 대시보드 → Pages → 프로젝트 → Deployments → 이전 배포 "Rollback" 클릭

### 13. DB 마이그레이션 전 백업 누락으로 복구 불가

**예방**: 마이그레이션 실행 전 반드시 `npm run db:backup` 실행.

```bash
# 백업 생성
npm run db:backup

# 마이그레이션 실행
npm run db:migrate

# 실패 시 복원
npm run db:backup --list    # 백업 목록 확인
npm run db:restore           # 최근 백업 복원
```

---

## 에스컬레이션 기준

아래 상황에서는 사용자에게 상황을 설명하고 `/troubleshoot` 스킬로 재진단합니다:

- 위 시나리오의 해결책을 2회 이상 시도했지만 실패
- `.docking/config.yaml` 손상 (수동 복구 필요)
- HQ 인증 실패 (clinic.json/device 토큰 관련)
- Cloudflare D1/R2/Workers 바인딩 오류

---

## 빈번한 질문

**Q: update:starter와 core:pull의 차이는?**
- `update:starter`: 인프라 파일만 (scripts/, .docking/engine/) — HQ R2에서 다운로드
- `core:pull`: 앱 코드 (src/, migrations/) — 버전 태그 기반 업데이트
- 둘 다 실행해야 완전히 최신화됩니다

**Q: setup을 다시 실행해도 데이터가 날아가지 않나요?**
- `npm run setup`은 이미 존재하는 설정 파일을 건드리지 않습니다
- DB도 IF NOT EXISTS 기반이라 기존 데이터 보존
- 단, `--fresh` 플래그 사용 시 주의

**Q: core:pull 전에 꼭 백업해야 하나요?**
- core:pull은 `.core-backup/`에 자동 스냅샷 생성
- `npm run core:rollback`로 언제든 복원 가능
- 추가 안전을 원하면 `git commit` 후 진행
