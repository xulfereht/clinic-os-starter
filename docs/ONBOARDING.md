# 🚀 Clinic-OS 시작 가이드 (End-to-End)

이 문서는 Clinic-OS를 처음 도입하는 병원을 위해 **개발 환경 설정부터 최종 배포까지**의 전체 흐름을 설명합니다.

---

## 🏗️ 1. 개발 환경 설정 (Environment Setup)

Clinic-OS는 최신 웹 기술(Node.js v20+, Cloudflare)을 기반으로 작동하므로, 적절한 개발 환경이 필요합니다.

### 🍎 macOS 사용자
1. **Node.js 설치**: [Node.js 공식 홈페이지](https://nodejs.org/)에서 **v20 (LTS)** 버전을 설치합니다.
2. **Git 설치**: 터미널에서 `git --version`을 입력해 확인하고, 없으면 설치합니다.
3. **Gemini CLI 설치**: `npm install -g @google/gemini-cli`

### 🪟 Windows 사용자 (필독!)
**WSL2 (Windows Subsystem for Linux)** 환경 사용이 **필수**입니다.

> 자세한 설정: [Windows 가이드](./WINDOWS_GUIDE.md)

---

## 📦 2. 스타터킷 다운로드 및 이동

**중요**: 다운로드 받은 압축 파일을 반드시 **WSL 파일 시스템** 내부로 옮겨야 합니다.

1. **다운로드**: HQ 대시보드에서 스타터킷(.zip) 다운로드.
2. **파일 이동**:
   - 윈도우 탐색기 주소창에 `\\wsl$` 입력.
   - `Ubuntu` -> `home` -> `(사용자명)` 폴더로 이동.
   - 여기에 압축 파일을 복사하고 풉니다.

---

## ⚙️ 3. Gemini CLI 연동 및 초기 설정

**Gemini CLI**를 통해 프로젝트를 제어합니다.

1. **터미널에서 프로젝트 열기**:
   ```bash
   cd ~/clinic-os
   ```

2. **Gemini CLI 실행**:
   ```bash
   gemini
   ```
   처음 실행 시 Google 계정 로그인이 필요합니다.

3. **초기 설정**:
   Gemini에게 요청: "npm run setup 실행해줘"

   또는 직접 실행:
   ```bash
   npm run setup
   ```

**자동 수행 작업:**
- **D1 데이터베이스 생성**: 로컬 SQLite DB 파일 생성.
- **스키마 적용 & 데이터 시딩**: 관리자 계정 생성.

> 자세한 설치: [Gemini CLI 설치 가이드](./GEMINI_CLI_SETUP.md)

---

## 🖥️ 4. 로컬 실행 및 검증 (Local Sandbox)

운영 서버에 영향을 주지 않고 안전하게 작업하는 단계입니다.

1. **실행**:
   ```bash
   npm run dev
   ```
2. **확인**: 브라우저에서 `http://localhost:4321` 접속.
3. **관리자 접속**: `http://localhost:4321/admin`

---

## ☁️ 5. 클라우드 배포 준비 (Cloudflare Setup)

실제 서버(Cloudflare)에 올리기 전, 한 번만 수행하면 됩니다.

### 5-1. Cloudflare 로그인
```bash
npx wrangler login
```

### 5-2. D1 데이터베이스 생성
```bash
npx wrangler d1 create clinic-os-prod
```
📌 **중요**: `database_id`를 `wrangler.toml` 파일에 붙여넣으세요.

### 5-3. R2 버킷 생성 (파일 저장소)
```bash
npx wrangler r2 bucket create clinic-os-uploads
```

---

## 🚀 6. 최종 배포 (Deployment)

테스트가 끝난 코드를 실제 서버로 보냅니다.

```bash
npm run deploy
```

이 명령어는 다음을 수행합니다:
1. 애플리케이션 빌드 (`astro build`)
2. Cloudflare Pages에 업로드 (환자들이 보는 화면 갱신)

---

## 💡 문제 해결 (Troubleshooting)

| 문제 | 해결 |
|------|------|
| "Permission denied" | 프로젝트가 WSL 내부(`~/clinic-os`)에 있는지 확인 |
| "DB 파일이 없다" | `npm run setup` 실행 |
| 업데이트 필요 | `npm run core:pull` 실행 |

---

## 📚 다음 단계

- [운영 가이드](./OPERATIONS_GUIDE.md) - 일상 운영 방법
- [터미널 꾸미기](./TERMINAL_BEAUTIFY.md) - 터미널 UX 개선
- [플러그인 개발](./PLUGIN_DEVELOPMENT_GUIDE.md) - 플러그인 시스템 이해
- [커스터마이징 가이드](./CUSTOMIZATION_GUIDE.md) - 홈페이지 커스터마이징 (AI 어시스턴트 활용)
