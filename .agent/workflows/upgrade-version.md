---
description: Clinic-OS 버전 업그레이드 (Core/Starter 업데이트)
---

# Clinic-OS 버전 업그레이드

새 버전의 기능을 기존 시스템에 안전하게 적용합니다.

---

## 업데이트 유형

### 1. Core 업데이트 (앱 기능)
HQ 서버에서 최신 앱 패키지를 가져옵니다.
- 새로운 페이지/컴포넌트
- 버그 수정
- 기능 개선

### 2. Starter 업데이트 (인프라)
Starter Kit 저장소에서 최신 설정을 가져옵니다.
- 빌드 설정 변경
- 스크립트 업데이트
- 의존성 변경

## 시작 전 시나리오 판별

먼저 현재 설치본이 안전한 인플레이스 업데이트 대상인지 확인합니다.

```bash
npm run agent:lifecycle -- --json
```

- `safe_update_in_place` → snapshot 후 일반 업데이트
- `legacy_reinstall_migration` → 신규 starter-kit 설치 + snapshot 이관 우선
- `production_binding_drift` → wrangler 연결 변경 검토 전까지 업데이트/배포 보류

---

## Phase 1: 백업 생성

// turbo
1. Git 상태 확인 및 현재 상태 저장
```bash
npm run agent:snapshot -- --reason=pre-update
git status
git add -A && git commit -m "Backup before upgrade"
git branch backup-$(date +%Y%m%d)
```

---

## Phase 2: Core 업데이트

HQ에서 최신 앱 패키지를 가져옵니다.

// turbo
```bash
npm run core:pull -- --auto
```

또는

```bash
npm run fetch
```

이 명령은:
- HQ 서버에서 최신 버전 확인
- 앱 패키지 다운로드
- `.docking/staging/`에 압축 해제
- 자동 적용

---

## Phase 3: Starter 업데이트 (필요시)

Starter Kit 인프라 변경이 있을 때 실행합니다.

// turbo
```bash
npm run update:starter
```

이 명령은:
- Git에서 최신 변경사항 pull
- npm install 자동 실행

---

## Phase 4: 도킹 패키지 적용 (수동 패키지)

외부에서 받은 `.zip` 패키지를 적용할 때:

// turbo
```bash
npm run upgrade
```

---

## Phase 5: DB 마이그레이션

core:pull이 **로컬 DB에 DDL 마이그레이션을 자동 적용**합니다 (v1.29.7~).

```bash
npm run db:migrate   # 수동 실행 시 (로컬)
```

> **v1.29.7 — DDL/DML 분리:**
> - `migrations/` = DDL만 (스키마). 로컬 + 리모트 자동 적용 대상.
> - `seeds/` = DML만 (데이터). 초기 설치 시 1회만 실행. 프로덕션 데이터 보호.
> - **리모트(프로덕션) DB**: 배포 시 `deploy-guard`가 갭을 감지하고 자동 적용.
>   core:pull 단계에서는 리모트를 건드리지 않음.
>
> v1.24.3부터:
> - `db:migrate`는 root의 `.docking/engine/migrate.js`를 직접 실행 (core:pull로 항상 최신 유지)
> - wrangler.toml 존재를 먼저 확인하며, 없으면 `npm run setup` 안내
> - `findProjectRoot()`가 `core/package.json`도 감지하여 스타터킷 구조 자동 지원
> - 마이그레이션 실패 시 seeds 실행을 자동으로 건너뜀
> - 에러 발생 시 `.agent/last-error.json`에 구조화된 보고서 저장
>
> ⚠️ fetch.js 수정사항은 **다음** core:pull부터 적용됩니다.
> 긴급 수정: `npm run update:starter && npm run core:pull`

---

## Phase 6: 테스트

// turbo
```bash
npm run dev
```

주요 기능 테스트:
- [ ] 홈페이지 로드
- [ ] 관리자 로그인
- [ ] 기존 커스터마이징 유지 확인
- [ ] 새 기능 작동 확인

---

## Phase 6.5: 업그레이드 후 자동 점검

core:pull 완료 후 아래 항목을 자동으로 점검합니다.

### 커스텀 홈페이지 데이터 오염 복구 (v1.31.4)

v1.31.3 이전 버전에서 core:pull 시 마스터의 바로한의원 전용 데이터가 커스텀 홈페이지에 혼입된 사례가 보고되었습니다.
`PROTECTED_PREFIXES`로 보호되기 때문에 core:pull만으로는 자동 교체되지 않으므로, 로컬에서 직접 확인하고 복구해야 합니다.

**감지 방법:**
```bash
# 커스텀 홈페이지에 바로한의원 데이터가 있는지 확인
grep -l "안태석\|문지현\|RDMS\|RMSK\|lystKvO0_q8\|국가대표 진료" \
  src/plugins/custom-homepage/pages/index.astro \
  src/plugins/local/custom-homepage/pages/index.astro 2>/dev/null
```

결과가 출력되면 오염된 것입니다.

**복구 방법:**

1. **프리셋 기반 초기화** (커스터마이징 전이라면):
```bash
cp src/plugins/custom-homepage/presets/editorial.astro \
   src/plugins/custom-homepage/pages/index.astro
```

2. **이미 커스터마이징한 경우** (원장님이 직접 수정한 내용이 있다면):
파일을 열어서 아래 바로한의원 전용 데이터만 제거하거나 해당 한의원 정보로 교체:
- `안태석`, `문지현` → 해당 한의원 원장 이름
- `RDMS`, `RMSK`, `ARDMS` 자격증 → 해당 한의원 자격증 또는 빈 배열 `[]`
- 논문 3편 (초음파 유도 약침 등) → 해당 한의원 논문 또는 빈 배열 `[]`
- YouTube URL `lystKvO0_q8` → 해당 한의원 영상 또는 빈 문자열 `""`
- 강점 배지 "국가대표 진료", "학술대회 강연" → 해당 한의원 강점

3. **local/ 경로 권장**: 복구 후 커스터마이징 내용은 `src/plugins/local/custom-homepage/`로 이동하면 향후 core:pull에서 완전히 보호됩니다:
```bash
mkdir -p src/plugins/local/custom-homepage/pages
cp src/plugins/custom-homepage/pages/index.astro \
   src/plugins/local/custom-homepage/pages/index.astro
cp src/plugins/custom-homepage/manifest.json \
   src/plugins/local/custom-homepage/manifest.json
# 이후 local/ 쪽을 수정
```

> **원칙**: 코어 custom-homepage에는 범용 템플릿만 존재. 클리닉별 데이터는 반드시 `local/custom-homepage/`에 배치.

---

## Phase 7: 완료 처리

// turbo
```bash
git add -A && git commit -m "Upgrade to v[VERSION]"
```

배포가 필요하면:
```bash
npm run deploy
```

---

## 롤백 (문제 발생 시)

```bash
git checkout backup-[날짜]
git checkout -b main --force
```

---

## 명령어 요약

| 명령어 | 용도 |
|--------|------|
| `npm run core:pull` | HQ에서 앱 패키지 업데이트 |
| `npm run update:starter` | Starter Kit 업데이트 |
| `npm run upgrade` | 수동 도킹 패키지 적용 |
| `npm run setup` | 초기 설정 재실행 |
| `npm run db:init` | DB 스키마 마이그레이션 (root 엔진) |
| `npm run db:seed` | 샘플 데이터 삽입 |
| `npm run doctor` | DB 스키마 검증 + 자동 복구 |
| `npm run health` | 환경 건강 점수 (0-100) |

---

## 트러블슈팅

> 에러 발생 시 `.agent/last-error.json`이 자동 생성됩니다.
> 에이전트는 이 파일을 감지하면 `.agent/workflows/troubleshooting.md`를 참조하여 자동 복구하세요.

### core:pull 시 "깃 저장소가 아닙니다" 오류
스타터킷 구조에서 루트에 `.git`이 없을 때 발생합니다.
```bash
git init          # 루트에 .git 생성
npm run core:pull # 다시 시도
```
> v1.24.0부터 `update:starter`와 `fetch.js`가 자동으로 `git init`을 실행합니다.
> v1.24.3부터 git fetch 에러 메시지가 원인별로 구분됩니다 (not a git repo / No such remote / 네트워크).

### 디바이스 등록 한도 초과
v1.24.0부터 클라이언트당 최대 5대까지 등록 가능합니다.
기존 3대 제한에 걸렸다면 HQ에서 자동 상향되었습니다.

---

## 주의사항

- 업그레이드 전 **반드시 백업**
- 프로덕션 배포 전 **로컬 테스트 필수**
- 충돌 발생 시 **사용자에게 설명 후 결정**

---

## 관련 문서

| 상황 | 다음 문서 |
|------|-----------|
| 업데이트 중 오류 발생 | `.agent/workflows/troubleshooting.md` |
| 보호 규칙 확인 | `.claude/rules/clinic-os-safety.md` |
| 전체 문서 인덱스 | `.agent/README.md` |
