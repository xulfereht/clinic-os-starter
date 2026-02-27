---
description: Clinic-OS 트러블슈팅 및 복구 가이드 (에이전트용)
---

# Clinic-OS 트러블슈팅 & 복구

클라이언트 환경에서 발생하는 주요 문제와 복구 절차를 정리합니다.

---

## 진단 우선순위

문제 발생 시 아래 순서로 접근합니다:

1. **`npm run health`** — 환경 건강 점수 (0-100) 확인
2. **`npm run core:status`** — 현재 코어 버전, 백업 상태 확인
3. **`npm run doctor`** — DB 스키마 검증
4. 위 결과로 원인 파악 → 아래 시나리오별 대응

---

## 복구 명령어 레퍼런스

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
| `npm run setup` | 전체 12단계 재초기화 | 부분적 |

---

## 시나리오별 대응

### 1. core:pull "깃 저장소가 아닙니다"

**원인**: 루트에 `.git`이 없음 (스타터킷 초기 구조 또는 삭제됨)

```bash
git init
npm run core:pull
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

### 6. DB 마이그레이션 실패

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

## 에스컬레이션 기준

아래 상황에서는 서포트 에이전트에게 에스컬레이션합니다:

```bash
./scripts/cos-ask "에러 메시지 + 시도한 내용"
```

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
