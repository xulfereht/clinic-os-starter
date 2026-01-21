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

### 방법 1: npm 전역 설치 (권장)

```bash
npm install -g @google/gemini-cli
```

### 방법 2: 설치 없이 바로 실행

```bash
npx @google/gemini-cli
```

### 방법 3: Homebrew (macOS/Linux)

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

---

## 4단계: 프로젝트에서 사용

### 기본 사용

```bash
# 프로젝트 디렉토리로 이동
cd ~/clinic-os

# Gemini CLI 실행
gemini
```

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

```bash
# npm 전역 경로를 PATH에 추가
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

> 최종 업데이트: 2026-01-21
