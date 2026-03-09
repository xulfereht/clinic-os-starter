# Clinic-OS Windows 가이드 (WSL + Agent-First)

Windows에서는 반드시 WSL 안에서 Clinic-OS를 다루세요. 핵심 목적은 두 가지입니다.

- 경로/권한/성능 문제를 줄이기
- 에이전트가 macOS/Linux와 비슷한 전제를 갖고 안정적으로 작업하게 하기

## 요약

1. Windows에 WSL 설치
2. WSL 안에 Node.js 20+, Git 설치
3. 프로젝트를 `~/clinic-os` 같은 WSL 경로에 배치
4. 선호하는 에이전트 CLI 실행
5. 이후 작업은 에이전트와의 대화로 진행

## 1. WSL 설치

관리자 권한 PowerShell 또는 Windows Terminal에서 실행:

```powershell
wsl --install
```

설치 후 재부팅하고 Ubuntu 초기 설정을 마칩니다.

## 2. WSL 안에 기본 도구 설치

Ubuntu 터미널에서 실행:

```bash
sudo apt update
sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

확인:

```bash
node -v
git --version
```

## 3. 프로젝트 위치

프로젝트는 반드시 WSL 파일 시스템 안에 두세요.

```bash
mkdir -p ~/projects
cd ~/projects
```

좋은 위치:

- `~/clinic-os`
- `~/projects/clinic-os`

좋지 않은 위치:

- `/mnt/c/...`
- 바탕화면/다운로드 폴더를 그대로 연결한 Windows 경로

## 4. 스타터킷 설치 후 에이전트 실행

프로젝트 폴더로 이동한 뒤 에이전트 CLI를 실행합니다.

```bash
cd ~/clinic-os
```

그 다음에는 아래처럼 요청하면 됩니다.

```text
이 레포를 읽고 현재 상태를 진단해줘.
AGENTS.md와 .agent/README.md를 먼저 읽고,
설치 또는 이관이 필요하면 안전한 순서로 진행해줘.
```

## 5. Windows에서 특히 중요한 원칙

### 1. 사람은 직접 명령어를 많이 치지 않습니다

정상적인 흐름이면 에이전트가 아래를 스스로 판단해야 합니다.

- `agent:doctor`
- `agent:lifecycle`
- `agent:snapshot`
- `agent:restore`
- `setup:step`

### 2. `sudo npm run ...` 는 거의 항상 잘못된 신호입니다

권한 문제를 `sudo` 로 덮으면 나중에 파일 소유권이 꼬여서 더 큰 문제가 생깁니다.

### 3. 로컬 경로와 배포 대상을 헷갈리지 않게 해야 합니다

Windows 사용자는 특히 여러 터미널/여러 경로를 넘나들다가 프로젝트 폴더를 잘못 여는 경우가 많습니다.
에이전트는 항상 현재 경로와 대상 설치본 상태를 먼저 확인해야 합니다.

## 자주 묻는 질문

### 여러 PC에 설치해도 되나요?

가능은 하지만 권장하지 않습니다. 특히 원장님이 직접 여러 설치본을 관리하기는 어렵습니다.
여러 설치본이 필요하면 에이전트가 어느 설치본이 최신인지 먼저 진단하도록 하세요.

### WSL 설치가 기존 프로그램과 충돌하나요?

보통은 그렇지 않습니다. WSL은 격리된 리눅스 공간입니다.

### 작업은 어디까지 사람이 하나요?

보통은 여기까지입니다.

1. WSL 설치
2. Node/Git 준비
3. 스타터킷 설치
4. 에이전트 CLI 실행

그 다음부터는 에이전트와 대화로 진행합니다.

## 트러블슈팅

### WSL 설치가 안 됨

- Windows 기능에서 `Linux용 Windows 하위 시스템`과 `가상 머신 플랫폼`이 활성화되어 있는지 확인
- BIOS 가상화 설정이 꺼져 있지 않은지 확인

### `EACCES` 또는 권한 오류

프로젝트 소유권을 현재 사용자로 맞추세요.

```bash
sudo chown -R "$USER:$USER" ~/clinic-os
```

그 후 에이전트에게 다시 진단을 요청하세요.

### `npm run dev` 또는 빌드가 느림

프로젝트가 `/mnt/c/...` 아래에 있지 않은지 먼저 확인하세요.

### 에이전트가 이상한 명령을 제안함

예:

- `sudo npm run dev`
- `npm run setup` 바로 실행
- `core:pull` 먼저 해보라는 안내

이 경우 아래처럼 되돌려 주세요.

```text
먼저 doctor와 lifecycle로 현재 상태를 진단하고,
대화형이 아닌 안전 경로로 진행해줘.
```

## 다음 문서

- [AI 에이전트 CLI 설정 가이드](./GEMINI_CLI_SETUP.md)
- [온보딩 가이드](./ONBOARDING.md)
- [터미널 꾸미기](./TERMINAL_BEAUTIFY.md)
