# Gemini CLI 설치 가이드

> Starter Kit 클라이언트를 위한 AI 어시스턴트 설정 가이드

---

## 개요

Gemini CLI는 Google의 Gemini AI를 터미널에서 직접 사용할 수 있는 오픈소스 CLI 도구입니다.

**장점:**
- 가볍고 빠른 실행
- 터미널 기반으로 WSL과 완벽 호환
- **Google 로그인만으로 사용** (API 키 관리 불필요)
- 무료 티어: 60 요청/분, 1,000 요청/일
- Gemini 2.5 Pro + 1M 토큰 컨텍스트 윈도우

---

## 1단계: Node.js 확인

Gemini CLI는 Node.js v20 이상이 필요합니다.

```bash
node -v
# v20.x.x 이상이어야 함
```

Node.js가 없다면 [WINDOWS_GUIDE.md](./WINDOWS_GUIDE.md)를 먼저 참고하세요.

---

## 2단계: Gemini CLI 설치

### 방법 1: npm 전역 경로를 유저 홈으로 설정 (⭐ 권장)

> sudo 없이, 환경도 깔끔하게 유지됩니다. Claude Code CLI, Gemini CLI 등 AI CLI 도구들을 함께 쓰기에 가장 안정적입니다.

**1️⃣ 전역 설치 경로 생성**
```bash
mkdir -p ~/.npm-global
```

**2️⃣ npm 설정 변경**
```bash
npm config set prefix '~/.npm-global'
```

**3️⃣ PATH에 추가**

macOS/Linux (zsh):
```bash
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Linux (bash) / WSL:
```bash
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**4️⃣ Gemini CLI 설치**
```bash
npm install -g @google/gemini-cli
```

**5️⃣ 설치 확인**
```bash
which gemini
# → ~/.npm-global/bin/gemini 나오면 정상
```

---

### 방법 2: 일반 npm 전역 설치

```bash
npm install -g @google/gemini-cli
```

> ⚠️ 권한 오류 시 "방법 1"을 사용하세요. `sudo`로 설치하면 나중에 문제가 생길 수 있습니다.

### 방법 3: 설치 없이 바로 실행

```bash
npx @google/gemini-cli
```

### 방법 4: Homebrew (macOS/Linux)

```bash
brew install gemini-cli
```

### 설치 확인

```bash
gemini --version
```

---

## 3단계: Google 로그인 인증

**API 키가 필요 없습니다!** Google 계정으로 로그인하면 됩니다.

```bash
# Gemini CLI 실행
gemini
```

처음 실행 시:
1. **"Login with Google"** 선택
2. 브라우저가 열리면 Google 계정으로 로그인
3. 인증 완료 후 터미널로 돌아오면 바로 사용 가능

### Google One AI Premium (Pro) 연동

Google One AI Premium 구독자는 자동으로 향상된 기능을 사용할 수 있습니다:
- 더 높은 요청 제한
- 우선순위 응답
- 최신 모델 접근

Pro 구독이 연결된 Google 계정으로 로그인하면 자동 적용됩니다.

### Preview Features 활성화 (⭐ 권장)

최신 기능을 사용하려면 Preview Features를 켜세요:

1. Gemini CLI 실행 후 `/settings` 입력
2. **Preview Features** 항목 찾기
3. `false` → `true`로 변경
4. 저장 후 종료

```
> /settings
# Preview Features 항목에서 false → true 변경
```

이렇게 하면 최신 실험적 기능들을 먼저 사용할 수 있습니다.

---

## 4단계: 프로젝트에서 사용

### 기본 사용

```bash
# 프로젝트 디렉토리로 이동
cd ~/clinic-os

# Gemini CLI 실행
gemini
```

### 첫 실행 시 프로젝트 인식시키기 (⭐ 중요)

Gemini CLI를 처음 실행하면 AI가 프로젝트 구조를 모릅니다. **첫 프롬프트로 프로젝트를 파악하게 해주세요:**

```
> 이 폴더의 구조와 주요 파일들을 읽고 프로젝트를 파악해. GEMINI.md를 먼저 읽어봐.
```

또는 더 직접적으로:

```
> 프로젝트 전체를 분석해서 어떤 시스템인지 장악해.
> GEMINI.md, package.json, src/ 폴더 구조를 확인하고 정리해줘.
```

이렇게 하면 AI가:
1. `GEMINI.md`를 읽어 프로젝트 맥락 파악
2. 폴더 구조 스캔
3. 주요 설정 파일 확인
4. 이후 질문에 더 정확하게 응답

### GEMINI.md 컨텍스트 활용

Gemini CLI는 프로젝트 루트의 `GEMINI.md` 파일을 자동으로 인식합니다. Clinic-OS 프로젝트에는 이미 AI가 프로젝트를 이해할 수 있도록 작성된 `GEMINI.md`가 포함되어 있습니다.

```bash
# GEMINI.md가 있는 디렉토리에서 실행
cd ~/clinic-os
gemini

# AI가 프로젝트 맥락을 이해하고 응답
```

---

## 유용한 사용 예시

### 프로젝트 질문

```
> 이 프로젝트의 플러그인 시스템이 어떻게 동작해?
> 새 검사도구를 추가하려면 어떻게 해야 해?
> DB 마이그레이션 파일은 어디에 있어?
```

### 코드 작업

```
> src/plugins/custom-homepage/pages/index.astro 파일 분석해줘
> 홈페이지에 새로운 섹션 추가하고 싶어
> 에러가 나는데 도와줘: [에러 메시지]
```

### 운영 명령어

```
> npm run dev 실행해줘
> 배포하려면 어떻게 해야 해?
> core:pull 후 충돌이 발생했어
```

---

## 트러블슈팅

### "command not found: gemini"

**해결책 1: "2단계 방법 1"로 재설치 (권장)**

위 "방법 1: npm 전역 경로를 유저 홈으로 설정" 섹션을 따라 `~/.npm-global` 경로로 재설치하세요.

**해결책 2: 기존 설치 경로를 PATH에 추가**

```bash
# 현재 npm prefix 확인
npm config get prefix
# → /usr/local 또는 다른 경로가 나옴

# 해당 경로의 bin을 PATH에 추가 (zsh)
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# bash/WSL의 경우
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 로그인이 안 됨

- 브라우저 팝업 차단 확인
- WSL에서 실행 시 Windows 기본 브라우저가 열림
- VPN 사용 중이면 일시적으로 해제

### 느린 응답

- 네트워크 상태 확인
- 대용량 파일을 직접 붙여넣기보다 파일 경로 참조
- `--model gemini-2.0-flash` 옵션으로 빠른 모델 사용

### 인증 초기화

```bash
# 기존 인증 정보 삭제 후 재로그인
rm -rf ~/.gemini
gemini
```

---

## 다음 단계

- [터미널 꾸미기 가이드](./TERMINAL_BEAUTIFY.md) - 더 나은 터미널 UX
- [GEMINI.md](../GEMINI.md) - 프로젝트 컨텍스트 이해
- [플러그인 개발 가이드](./PLUGIN_DEVELOPMENT_GUIDE.md) - 플러그인 커스터마이징

---

> 최종 업데이트: 2026-01-22
