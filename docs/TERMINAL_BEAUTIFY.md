# 터미널 가독성 개선 가이드

터미널 꾸미기는 필수는 아닙니다. 다만 에이전트와 오래 협업할수록 아래 이점이 있습니다.

- 현재 경로를 덜 헷갈림
- Git 브랜치와 Node 버전을 바로 확인
- 로그와 에러를 읽기 쉬움

## 원칙

- 운영 안정성이 우선입니다.
- 쉘 설정을 망가뜨릴 정도의 과한 커스터마이징은 피하세요.
- 사람은 긴 스크립트를 직접 붙여넣기보다, 에이전트에게 preview 후 적용을 요청하는 편이 안전합니다.

## 추천 조합

- Windows: Windows Terminal + WSL
- macOS / Linux: 기본 터미널 + Starship
- 폰트: Nerd Font 계열

## 에이전트에게 이렇게 요청하세요

```text
터미널 가독성을 개선해줘.
현재 쉘 설정을 먼저 확인하고,
안전한 변경만 제안하거나 적용해줘.
```

좋은 에이전트라면 다음을 먼저 확인해야 합니다.

- 현재 쉘이 `bash` 인지 `zsh` 인지
- 이미 Starship이나 비슷한 프롬프트가 설정되어 있는지
- 중복 설정을 넣지 않는지

## 최소 설정 예시

### Starship 설치

```bash
curl -sS https://starship.rs/install.sh | sh -s -- -y
```

### zsh

```bash
mkdir -p ~/.config
grep -q 'starship init zsh' ~/.zshrc || echo 'eval "$(starship init zsh)"' >> ~/.zshrc
source ~/.zshrc
```

### bash / WSL

```bash
mkdir -p ~/.config
grep -q 'starship init bash' ~/.bashrc || echo 'eval "$(starship init bash)"' >> ~/.bashrc
source ~/.bashrc
```

## Windows에서 폰트가 깨지면

1. Nerd Font 설치
2. Windows Terminal 프로필의 글꼴을 해당 폰트로 변경

## 주의할 점

- `sudo` 로 쉘 설정 파일을 수정하지 마세요.
- 에이전트가 여러 줄짜리 `cat <<EOF` 스크립트를 무심코 덮어쓰지 않게 하세요.
- 터미널 꾸미기는 설치/복구/배포보다 우선순위가 낮습니다.

## 다음 문서

- [Windows 가이드](./WINDOWS_GUIDE.md)
- [온보딩 가이드](./ONBOARDING.md)
