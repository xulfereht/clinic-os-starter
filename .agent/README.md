# Clinic-OS Agent Documentation Index

> AI 에이전트가 이 프로젝트에서 작업할 때 참조하는 문서 네비게이션 맵입니다.
> 어떤 문서를 먼저 읽어야 하는지, 특정 작업에 필요한 문서가 무엇인지 정리합니다.

---

## 진입점 (Entry Points)

에이전트 종류에 따라 자동 로드되는 진입점이 다릅니다:

| 에이전트 | 진입점 | 자동 로드? |
|----------|--------|-----------|
| Claude Code | `CLAUDE.md` + `.claude/rules/*.md` | 자동 |

> 모든 진입점은 **자동 감지 프로토콜**을 포함합니다.
> 상세 절차: `.agent/workflows/first-contact.md`

---

## 작업별 문서 맵 (What → Where)

### 최초 접촉 (에이전트 자동 시작)

```
1. 진입점 (CLAUDE.md 등)                  — 자동 감지 프로토콜
2. .agent/workflows/first-contact.md      — Phase 판별 + 행동 위임
3. .agent/runtime-context.json            — 현재 워크스페이스/앱 루트/로컬 오버라이드 요약
4. .agent/manifests/change-strategy.json  — 로컬 수정 vs 중앙 패치 분류
5. .agent/manifests/local-workspaces.json — safe workspace 선택 기준
6. .agent/manifests/admin-public-bindings.json — 관리자 ↔ 퍼블릭 반영 계약
7. .agent/manifests/command-safety.json   — 비대화형 안전 명령 우선순위
8. .agent/manifests/lifecycle-scenarios.json — 신규 설치 vs 업데이트 vs 재설치 마이그레이션 판별
   → Phase E: .agent/last-error.json 감지 → 자동 복구 (최우선!)
   → Phase 0: npm install
   → Phase 1: npm run setup:step -- --next (기본) / npm run setup:fast (고성능) / setup:agent fast 자동 선택
   → Phase 2: softgate.md (소프트게이트)
   → Phase 3: onboarding.md (온보딩)
   → Phase 4: 운영 모드
```

### 초기 설정 (수동 진행 시)

```
1. CLAUDE.md                             — 프로젝트 이해
2. .agent/workflows/setup-clinic.md       — setup:step / setup:fast / setup:agent fast 자동 선택 가이드
3. .agent/workflows/softgate.md           — 안전망 설정 (GitHub, 백업)
4. .agent/workflows/onboarding.md         — 병원 개별화 (Tier 1→5)
```

### 온보딩 (병원 개별화 설정)

```
1. .agent/onboarding-registry.json        — 전체 기능 목록 + 스펙 (SOT)
2. .agent/onboarding-state.json           — 현재 진행 상태
3. .agent/workflows/onboarding.md         — 대화 흐름 + 실행 패턴
```

### 코어 업데이트 (core:pull)

```
1. .agent/workflows/upgrade-version.md    — 업데이트 절차 (Phase 1→7)
2. .claude/rules/clinic-os-safety.md      — 보호 규칙 (어떤 파일이 덮어써지는지)
3. .agent/workflows/troubleshooting.md    — 문제 발생 시 복구
```

### 운영 상태 진단 / 자동 동기화

```
1. npm run agent:doctor -- --json         — 설치/버전/에러/권장 조치 진단
2. .agent/support-status.json             — 최근 진단 결과
3. npm run agent:sync -- --dry-run        — 자동 실행 가능 조치 미리보기
4. npm run agent:sync                     — 안전한 자동 조치 실행
```

### 에이전트 실행 원칙

```
1. 안전한 비대화형 명령은 에이전트가 직접 실행
2. 배포/복원/외부 상태 변경 명령은 이유와 영향 설명 후 제안
3. 사람이 대신 터미널에 명령을 붙여넣게 하지 않음
4. 사용자가 잘못된 명령을 요청하면 더 안전한 대안을 설명하고 제시
```

### 수명주기 / 마이그레이션 시나리오

```
1. .agent/manifests/lifecycle-scenarios.json — 시나리오 분기 규칙
2. npm run agent:lifecycle -- --json         — 현재 설치본 시나리오 판별
3. .agent/lifecycle-status.json              — 최근 판별 결과
4. npm run agent:snapshot -- --reason=...    — 보호 스냅샷 생성
5. npm run agent:restore -- --dry-run --json — 자동 백업/형제 폴더 기준 복원 계획 미리보기
```

### 트러블슈팅 (문제 해결)

```
1. .agent/workflows/troubleshooting.md    — 시나리오별 복구 (11개 시나리오)
   → 진단: npm run health / core:status / doctor
   → 복구: core:repair / core:rollback / update:starter
   → 최후의 수단: 완전 재설치 절차
```

### 파일 수정 (커스터마이징)

```
1. .agent/runtime-context.json            — starter/flat 구조에서 실제 app root 확인
2. .agent/manifests/change-strategy.json  — 로컬/중앙 패치 분기
3. .agent/manifests/local-workspaces.json — `_local` / plugin / survey tool / asset / internal docs 분류
4. .agent/manifests/admin-public-bindings.json — 관리자 값이 퍼블릭 어디로 흘러가는지 확인
5. .agent/manifests/command-safety.json   — 대화형 명령 대신 안전 경로 선택
6. .agent/manifests/lifecycle-scenarios.json — 신규 설치/업데이트/재설치 마이그레이션 분기
7. .claude/rules/clinic-os-safety.md      — 보호 규칙 (수정 가능/불가 경로)
8. .agent/workflows/local-customization-agentic.md — 페이지/자산/내부 문서 실행 규칙
9. .agent/workflows/survey-tools-agentic.md — 검사도구 실행 규칙
10. docs/LOCAL_WORKSPACES_GUIDE.md        — 로컬 작업 공간 선택 가이드
11. docs/CUSTOMIZATION_GUIDE.md           — 홈페이지/페이지 오버라이드 상세 가이드
12. docs/PLUGIN_DEVELOPMENT_GUIDE.md      — 플러그인 개발
```

### 플러그인 개발

```
1. docs/PLUGIN_DEVELOPMENT_GUIDE.md       — 플러그인 구조 + 만들기
2. npm run plugin:create -- --id=...      — 로컬 플러그인 스캐폴드 생성
3. src/plugins/local/                     — 클라이언트 플러그인 디렉토리
```

### 로컬 작업 공간 선택

```
1. .agent/manifests/local-workspaces.json — 어떤 safe workspace를 써야 하는지 먼저 분류
2. .agent/workflows/local-customization-agentic.md — _local/lib/public/docs/internal
3. .agent/workflows/survey-tools-agentic.md — survey-tools/local
4. docs/LOCAL_WORKSPACES_GUIDE.md         — 사용자/에이전트 공통 설명
```

### 배포

```
1. scripts/deploy-guard.js                — 배포 전 안전 체크 (자동)
2. .agent/workflows/softgate.md           — 배포 전 게이트 확인
```

### 도움 요청 / FAQ

```
1. .agent/workflows/help.md               — FAQ + 명령어 모음
2. ./scripts/cos-ask "에러 메시지"         — 서포트 에이전트 에스컬레이션
```

---

## 핵심 파일 레퍼런스

### 보호 규칙 (SOT 체인)

```
.docking/protection-manifest.yaml         — 원본 (SOT)
  ↓ scripts/generate-protection-docs.js    — 생성기
  ↓ .claude/rules/clinic-os-safety.md      — Claude Code용 (자동 로드)
  ↓ CLAUDE.md                              — 실행 가이드
```

### 상태 파일 (에이전트가 읽고 쓰는 파일)

| 파일 | 용도 | 수정 주체 |
|------|------|-----------|
| `.agent/runtime-context.json` | 현재 워크스페이스 상태 스냅샷 | 에이전트/스크립트 (`agent:context`) |
| `.agent/support-status.json` | 설치/버전/오류/권장 조치 진단 결과 | 에이전트/스크립트 (`agent:doctor`) |
| `.agent/lifecycle-status.json` | 신규 설치/업데이트/재설치 마이그레이션 판별 결과 | 에이전트/스크립트 (`agent:lifecycle`) |
| `.agent/restore-status.json` | 자동 백업 기준 복원 적용 결과와 수동 검토 목록 | 에이전트/스크립트 (`agent:restore`) |
| `.agent/deployment-target.json` | 마지막 배포 대상(project/database/bucket) 기록 | 에이전트/스크립트 (`deploy`) |
| `.agent/onboarding-state.json` | 온보딩 진행 상태 | 에이전트 |
| `.agent/manifests/change-strategy.json` | 변경 분류 규칙 (core 배포) | 코어 |
| `.agent/manifests/local-workspaces.json` | safe workspace 분류 규칙 (core 배포) | 코어 |
| `.agent/manifests/admin-public-bindings.json` | 관리자 ↔ 퍼블릭 계약 (core 배포) | 코어 |
| `.agent/manifests/command-safety.json` | 안전한 비대화형 명령 규칙 (core 배포) | 코어 |
| `.agent/manifests/lifecycle-scenarios.json` | 수명주기 시나리오 분기 규칙 (core 배포) | 코어 |
| `.agent/clinic-profile.json` | 병원 프로필 데이터 | 에이전트 (소프트게이트) |
| `.agent/softgate-state.json` | 소프트게이트 통과 상태 | 에이전트 |
| `.agent/release-modular-state.json` | 릴리스 파이프라인 상태 | release-conductor.sh / release-modular.js |
| `.agent/last-error.json` | 최근 에러 보고서 (자동 복구용) | core:pull / db:init / db:migrate |
| `.core/version` | 현재 설치된 코어 버전 | core:pull |
| `.docking/config.yaml` | 클라이언트 도킹 설정 | setup (수정 금지) |

### 워크플로우 파일

| 파일 | 트리거 | 설명 |
|------|--------|------|
| `first-contact.md` | 에이전트 자동 시작 | Phase 판별 + 워크플로우 위임 |
| `setup-clinic.md` | "설치", "setup" | 단계별 설치 + 빠른 setup 경로 |
| `softgate.md` | setup 완료 직후 | 안전망 (GitHub/백업/R2) |
| `onboarding.md` | "온보딩", "설정" | 병원 개별화 5-Tier |
| `upgrade-version.md` | "업데이트", "업그레이드" | 코어/스타터 업데이트 |
| `troubleshooting.md` | 오류 발생 시 | 11개 복구 시나리오 |
| `help.md` | "도움", "help" | FAQ + 명령어 모음 |
| `pack-docking.md` | 도킹 패키지 생성 | 마스터 전용 |
| `unpack-docking.md` | 도킹 패키지 적용 | 클라이언트 |

---

## 읽기 순서 가이드

### 에이전트가 처음 이 프로젝트를 만나면

```
Step 1: 진입점 읽기 (CLAUDE.md)
  → 프로젝트 개요, 기술 스택, 보호 규칙 이해

Step 2: 이 파일 읽기 (.agent/README.md)
  → 문서 맵 파악, 작업에 맞는 워크플로우 식별

Step 3: 작업에 맞는 워크플로우로 이동
  → 위 "작업별 문서 맵" 참조

Step 4: .agent/runtime-context.json 확인
  → app root가 root인지 core/인지 확인
  → local override/plugin 현황 확인
  → local workspace summary와 해당 workflow 확인
  → 없으면 npm run agent:context

Step 5: 설치/업데이트/복구 문제면 agent-doctor 실행
  → npm run agent:doctor -- --json
  → 자동 실행 후보만 보려면 npm run agent:sync -- --dry-run

Step 6: 구형 설치본/배포 전환/재설치 판단이 필요하면 lifecycle 실행
  → npm run agent:lifecycle -- --json
  → 재설치 이관 전에는 npm run agent:snapshot -- --reason=legacy-migration
  → 자동 백업/폴더 백업 기준 복원 계획은 npm run agent:restore -- --dry-run --json
```

### 에이전트가 오류를 만나면

```
Step 0: .agent/last-error.json 확인 (최우선)
  → core:pull/db:init/db:migrate 에러 시 자동 생성됨
  → recovery.commands를 순서대로 실행
  → 성공 시 last-error.json 삭제

Step 1: .agent/workflows/troubleshooting.md 읽기
  → 시나리오별 복구 절차 확인

Step 2: npm run health 실행
  → 환경 건강 점수로 문제 범위 파악

Step 3: 2회 실패 시 에스컬레이션
  → ./scripts/cos-ask "에러 메시지 + 시도한 내용"
```
