# Clinic-OS 온보딩 가이드 (Agent-First)

> 이 문서는 레거시 링크 호환을 위해 같은 경로를 유지합니다.
> 현재 기준 권장 흐름은 "사람이 스타터킷을 설치하고, 그 이후는 에이전트와의 대화로 진행"입니다.

## 한눈에 보기

- 사람: 스타터킷 설치, 에이전트 CLI 실행, 필요한 정보 제공, 결과 승인
- 에이전트: 레포 읽기, 상태 진단, 설치/복구/이관/배포 진행
- 기본 권장 에이전트: `Claude Code`
- 사용 가능 대안: `Codex 계열 (GPT-5.4+)`, `OpenClaw 계열`, `Kimi 2.5+ 등 프론티어 모델을 연결한 에이전트`

## 시작 전 준비

### macOS / WSL Ubuntu

1. Node.js 20 이상 설치
2. Git 설치
3. 스타터킷 다운로드 또는 설치 스크립트 실행
4. 프로젝트 폴더 진입

### Windows

네이티브 Windows 설치는 지원하지 않습니다. Windows에서는 반드시 **WSL Ubuntu** 안에서 작업하세요.

- 먼저 [Windows 가이드](./WINDOWS_GUIDE.md)를 따르세요.
- 프로젝트는 `C:\...`가 아니라 `~/clinic-os` 같은 WSL 경로에 두는 것이 안전합니다.

## 사람이 처음 하는 일

사람이 직접 해야 하는 것은 보통 여기까지입니다.

1. 스타터킷을 설치하거나 압축을 풉니다.
2. 프로젝트 폴더로 이동합니다.
3. 선호하는 에이전트 CLI를 실행합니다.

그 다음부터는 에이전트에게 대화로 요청하세요.

## 첫 대화 예시

처음 열었을 때는 아래처럼 요청하면 됩니다.

```text
이 레포를 읽고 현재 상태를 진단해줘.
AGENTS.md와 .agent/README.md를 먼저 읽고,
필요하면 설치/복구/이관 플로우를 제안하고 실행해줘.
```

## 에이전트가 먼저 해야 하는 일

정상적인 에이전트라면 아래 순서로 진행해야 합니다.

1. `AGENTS.md`
2. `.agent/README.md`
3. `.agent/workflows/first-contact.md`
4. `npm run agent:doctor -- --json`
5. `npm run agent:lifecycle -- --json`

그 다음 분기는 아래처럼 나뉩니다.

### 신규 설치로 판단되면

에이전트는 `npm run setup:step -- --next` 를 반복 실행해 설치를 완료해야 합니다.

### 구형 설치본 또는 백업이 감지되면

에이전트는 바로 덮어쓰지 말고 아래 순서로 가야 합니다.

1. `npm run agent:snapshot -- --reason=legacy-migration`
2. `npm run agent:restore -- --dry-run --json`
3. 복원 계획 제안
4. 새 스타터킷 기준 이관 실행

## 중요한 원칙

### 1. 사람은 명령어를 외울 필요가 없습니다

정상적인 흐름이라면 사용자는 아래처럼 말하면 됩니다.

- "설치 계속 진행해줘"
- "예전 작업물 살려서 새 버전으로 옮겨줘"
- "배포 전에 위험한 점 먼저 점검해줘"
- "관리자에서 바꾼 내용이 퍼블릭에 반영되는지 확인해줘"

### 2. 에이전트는 수동 명령 입력을 최소화해야 합니다

에이전트가 단순히 이런 식으로 말하면 좋지 않습니다.

- "`npm run setup` 쳐보세요"
- "`npm run core:pull` 먼저 해보세요"
- "자동 리빌드나 비대화형 안전 경로로 먼저 처리하겠습니다."

대신 이런 식이어야 합니다.

- "현재 상태를 먼저 진단하겠습니다."
- "이 설치본은 구형이라 인플레이스 업데이트보다 재설치 이관이 안전합니다."
- "이 명령은 대화형이라 실패할 수 있으니 비대화형 안전 경로로 진행하겠습니다."

### 3. 설치와 업데이트는 분리해서 생각해야 합니다

- 신규 설치: `setup:step`
- 상태 진단: `agent:doctor`
- 설치본 시나리오 판별: `agent:lifecycle`
- 보호 스냅샷: `agent:snapshot`
- 기존 작업물 이관: `agent:restore`

## 온보딩 진행 방식

설치가 끝나면 에이전트는 병원별 온보딩을 대화로 이어서 진행해야 합니다.

예:

- 병원명, 연락처, 주소, 진료시간 수집
- 대표 문구와 SEO/AEO 문구 정리
- 로고/사진/원장 소개 반영
- 관리자 설정과 퍼블릭 반영 여부 검증

관련 문서:

- [운영 가이드](./OPERATIONS_GUIDE.md)
- [안전한 작업 흐름](./WORKFLOW_GUIDE.md)
- [플러그인 개발 가이드](./PLUGIN_DEVELOPMENT_GUIDE.md)

## 빠른 문제 해결

| 상황 | 에이전트의 우선 행동 |
|------|----------------------|
| 설치가 중간에 멈춤 | `npm run agent:doctor -- --json` |
| 구형 설치본으로 보임 | `npm run agent:lifecycle -- --json` |
| 작업물이 사라질까 걱정됨 | `npm run agent:snapshot -- --reason=manual` |
| 새 스타터로 옮겨야 함 | `npm run agent:restore -- --dry-run --json` |
| 업데이트 후 이상함 | `npm run agent:doctor -- --json` 후 `core`/starter 상태 점검 |

## 다음 문서

- [AI 에이전트 CLI 설정 가이드](./GEMINI_CLI_SETUP.md)
- [Windows 가이드](./WINDOWS_GUIDE.md)
- [안전한 작업 흐름 가이드](./WORKFLOW_GUIDE.md)
- [플러그인 개발 가이드](./PLUGIN_DEVELOPMENT_GUIDE.md)
