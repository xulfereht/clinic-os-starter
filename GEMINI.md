# Clinic-OS 프로젝트 가이드

> ⚠️ **Antigravity**: 이 파일과 함께 `.client/CONTEXT.md`도 읽어주세요.

---

## 🧭 현재 상태: Starter Kit

이 프로젝트는 아직 초기화되지 않았습니다.
`npm install` 후 `node scripts/setup-clinic.js`를 실행하여 설정을 시작하세요.

---

## 📂 프로젝트 구조

```
clinic-os/
├── .docking/              # 도킹 엔진 (업데이트 안됨)
│   └── engine/            # fetch.js 등
├── .client/               # 클라이언트 컨텍스트 (업데이트 안됨)
│   ├── CONTEXT.md         # 이 환경에 대한 정보
│   └── customizations/    # 커스텀 파일 보관
├── .agent/workflows/      # Antigravity 워크플로우
├── core/                  # 앱 소스코드 (Git Sync로 업데이트됨)
├── data/                  # 설정 및 데이터 (업데이트 안됨)
└── GEMINI.md              # 이 파일
```

---

## 🎯 주요 워크플로우

| 명령 | 용도 |
|------|------|
| `npm run setup` | 초기 설정 및 최신 코드 동기화 |
| `npm run core:pull` | 최신 코어 업데이트 (Git Sync) |
| `npm run dev` | 로컬 개발 서버 실행 |
| `npm run deploy` | Cloudflare 배포 |
| `/help` | 도움 요청 |

---

## 💡 시작하기 (Local-First Workflow)

1. **필수 설치**: Node.js (v18+) 및 **Git** 설치 (필수)
2. **패키지 설치**: 터미널에서 `npm install` 실행
3. **시스템 초기화**: `node scripts/setup-clinic.js` 실행
   - 최신 코드를 Git을 통해 가져오고, 로컬 DB를 설정합니다.
4. **로컬 실행**: `npm run dev` 실행 후 브라우저 확인
