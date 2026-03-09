# Clinic-OS 에이전트 인스톨러 가이드

> 이 문서는 에이전트가 스타터킷을 자동으로 설치하는 방법을 설명합니다.

## 🚀 빠른 시작

사용자가 스타터킷을 다운로드하고 에이전트에게 "설치해줘"라고 하면:

```bash
# 완전 자동 모드
npm run setup:agent
```

에이전트가 알아서:
1. ✅ 현재 상태 감지
2. ✅ HQ 인증 (브라우저 열림)
3. ✅ 스타터킷 다운로드
4. ✅ 의존성 설치
5. ✅ 16단계 설치 자동 진행

---

## 📋 자동 감지 프로토콜 (First Contact)

에이전트가 프로젝트를 열었을 때, 이 파일(`.agent/AGENT_INSTALLER.md`)의 존재를 확인하면 **스타터킷 초기 상태**임을 인식합니다.

### 진입점 판별 트리

```
에이전트가 clinic-os 폴터 열기
    ↓
[체크] .agent/setup-progress.json 존재?
    ├── 있음 → 기존 설치 → Phase S (셋업 계속)
    └── 없음 → 신규 설치
        ↓
    [체크] .agent/AGENT_INSTALLER.md 존재?
        ├── 있음 → 스타터킷 초기 상태
        │           → npm run setup:agent 권장
        └── 없음 → 레거시 모드
```

---

## 🔧 명령어 레퍼런스

### `npm run setup:agent`
완전 자동 설치 모드
- 브라우저 인증 포함
- 16단계 설치 자동 진행
- 중단 시 재실행하면 이어서 진행

### `npm run setup:agent -- --token=xxx`
미리 발급받은 토큰으로 인증 우회
- CI/CD 환경에 적합
- 브라우저 없이 진행

### `npm run setup:agent -- --skip-auth`
인증 없이 로컬만 설정
- 오프라인/로컬 개발용
- 코어 다운로드 없음

### `npm run setup:agent -- --status`
현재 설치 상태 확인
- 어디까지 진행되었는지 표시
- 다음 단계 안내

### `npm run agent:doctor -- --json`
설치/업데이트/마이그레이션/버전 상태 진단
- 스타터/코어/HQ 버전 비교
- 최근 에러, setup 진행도, health score 요약
- 자동 실행 가능한 후속 명령 추천

### `npm run agent:sync -- --dry-run`
자동 실행 가능한 조치 미리보기
- 실제 변경 없이 어떤 명령이 순서대로 실행될지 확인
- 프롬프트가 없는 안전 경로만 대상

### `npm run agent:lifecycle -- --json`
현재 설치본 시나리오 판별
- 신규 설치 / 설치 재개 / 인플레이스 업데이트 / 신규 재설치 마이그레이션 / 배포 연결 드리프트를 구분
- 너무 구형이면 무리한 업데이트 대신 신규 설치 + 이관을 권장

### `npm run agent:snapshot -- --reason=legacy-migration`
보호 스냅샷 생성
- wrangler.toml, clinic.json, local 디렉토리, 온보딩 상태를 보존
- 로컬 DB 백업도 함께 생성

### `npm run agent:restore -- --dry-run --json`
자동 백업 기반 복원 계획 미리보기
- `.agent/protection-snapshots`, `.core-backup`, `archive/backups`, 형제 폴더 백업을 함께 탐색
- `data/`, `public/local/`, `.wrangler/state/v3/r2/`, agent 상태 파일도 함께 복원 후보로 탐색
- 전체 폴더 백업은 그대로 덮지 않고 local/custom/config 경로만 추출
- legacy core 수정 후보는 `--include-mapped-core`를 줄 때만 복원 대상에 포함

### 실행 원칙
- 에이전트는 안전한 비대화형 명령을 직접 실행
- 파괴적이거나 외부 상태를 바꾸는 명령은 이유와 영향 설명 후 제안
- 사람이 터미널에 명령을 직접 입력하도록 떠넘기지 않음

---

## 📁 상태 파일 구조

### `.agent/agent-context.json`
에이전트 인스톨러의 상태 저장
```json
{
  "version": "1.1",
  "stage": "detect|setup|complete|error",
  "mode": "default|skip-auth",
  "setup": {
    "step": 0,
    "total": 16,
    "completed": 0,
    "status": "pending|in_progress|complete|error"
  }
}
```

### `.agent/runtime-context.json`
설치 후/업데이트 후 생성되는 워크스페이스 요약
```json
{
  "stage": "setup_in_progress|onboarding|operational",
  "repo": {
    "is_starter_kit": true,
    "core_version": "v1.26.1"
  },
  "manifests": {
    "change_strategy": ".agent/manifests/change-strategy.json",
    "local_workspaces": ".agent/manifests/local-workspaces.json",
    "admin_public_bindings": ".agent/manifests/admin-public-bindings.json",
    "command_safety": ".agent/manifests/command-safety.json"
  }
}
```

없으면 다음 명령어로 생성:
```bash
npm run agent:context
```

로컬 수정 요청이면 `.agent/manifests/local-workspaces.json` 과
`.agent/workflows/local-customization-agentic.md` 를 먼저 보고
`_local`, `local plugin`, `survey-tools/local`, `public/local`, `docs/internal`
중 어디가 맞는지 먼저 분류합니다.

### `.agent/support-status.json`
`agent:doctor`가 기록하는 진단 결과
```json
{
  "versions": {
    "preferred_channel": "stable",
    "starter_version": "v1.26.1",
    "core_version": "v1.26.1"
  },
  "health": {
    "score": 92
  },
  "actions": [
    {
      "id": "update_core",
      "command": "npm run core:pull -- --auto --stable"
    }
  ]
}
```

### `.agent/lifecycle-status.json`
`agent:lifecycle`가 기록하는 시나리오 판별 결과
```json
{
  "scenario": "legacy_reinstall_migration",
  "strategy": "fresh_reinstall_migrate",
  "recommended_commands": [
    "npm run agent:snapshot -- --reason=legacy-migration",
    "npm run agent:restore -- --dry-run --json"
  ]
}
```

### `.agent/restore-status.json`
`agent:restore`가 기록하는 복원 적용 결과
- 어떤 백업 소스를 골랐는지
- pre-restore 보호 스냅샷이 어디에 생성됐는지
- 실제로 어떤 파일이 복원됐는지

### `.agent/deployment-target.json`
마지막으로 검증/배포한 project/database/bucket 연결 기록
- 다음 배포 때 값이 바뀌면 드리프트 경고 또는 차단에 사용

### `.agent/setup-progress.json`
setup:step의 상세 상태
```json
{
  "steps": [
    { "id": "check-system", "status": "done" },
    { "id": "device-register", "status": "pending" }
  ]
}
```

---

## 🔄 복구 절차

### 설치 중단 후 재시작
```bash
npm run setup:agent
```
자동으로 마지막 단계부터 이어서 진행

### 컨텍스트 재생성
```bash
npm run agent:context
```
현재 워크스페이스 구조, local override, app root를 다시 스캔

### 설치/업데이트 문제 선진단
```bash
npm run agent:doctor -- --json
```
버전 불일치, 최근 에러, 안전한 자동 복구 후보를 먼저 확인

### 구형 설치본 판별
```bash
npm run agent:lifecycle -- --json
```
구형 스타터/코어라면 신규 설치 + 마이그레이션 경로를 먼저 선택

### 처음부터 다시 시작
```bash
rm .agent/agent-context.json
rm .agent/setup-progress.json
npm run setup:agent -- --reset
```

### 인증 재시도
```bash
npm run setup:agent -- --reauth
```

---

## ⚠️ 주의사항

1. **브라우저 인증**: `--token` 없이 실행하면 브라우저가 열립니다
2. **시간**: 전체 설치는 5-15분 소요
3. **네트워크**: HQ 서버와 통신 필요 (인증/코어 다운로드)
4. **Node.js**: v18+ 필요

---

## 🆘 문제 해결

| 문제 | 해결책 |
|------|--------|
| 인증 실패 | `npm run setup:agent -- --reauth` |
| 다운로드 실패 | 네트워크 확인 후 재시도 |
| 설치 중단 | 그대로 `npm run setup:agent` 재실행 |
| 권한 오류 | `sudo` 없이 실행 (권장) |
| 설치/업데이트가 계속 꼬임 | `npm run agent:doctor -- --json` 후 `npm run agent:sync -- --dry-run` |
| 너무 구형이라 계속 깨짐 | `npm run agent:lifecycle -- --json` → `npm run agent:snapshot -- --reason=legacy-migration` |
| 신형 설치 후 예전 폴더에서 설정을 가져와야 함 | `npm run agent:restore -- --dry-run --json` 으로 복원 계획 확인 |

---

## 📝 사용자 대화 템플릿

### 사용자: "설치해줘"
> Clinic-OS 자동 설치를 시작하겠습니다. 브라우저가 열리면 인증 코드를 입력해주세요.
> ```bash
> npm run setup:agent
> ```

### 사용자: "어디까지 했지?"
> 현재 설치 상태를 확인하겠습니다.
> ```bash
> npm run setup:agent -- --status
> ```

### 사용자: "토큰 있어"
> 제공된 토큰으로 인증을 진행하겠습니다.
> ```bash
> npm run setup:agent -- --token=사용자가_제공한_토큰
> ```
