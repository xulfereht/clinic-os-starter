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

---

## Support Agent

로컬에서 해결이 어려운 Clinic-OS 기술 문제가 발생하면 Support Agent를 사용하세요.

### API 호출 패턴

```javascript
const response = await fetch('https://clinic-os-support-agent.yeonseung-choe.workers.dev/support/chat', {
  method: 'POST',
  headers: {
    'X-License-Key': process.env.LICENSE_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    session_id: sessionId,
    message: {
      type: 'troubleshoot_request',
      human_request: question
    },
    mode: 'basic' // or 'deep' for detailed analysis
  })
});
```

### 에스컬레이션 트리거

다음 상황에서 Support Agent 사용을 권장합니다:

| 오류 패턴 | 권장 액션 |
|-----------|----------|
| `SQLITE_CONSTRAINT` | `pnpm support "D1 constraint error: [상세 내용]"` |
| `Worker exceeded CPU` | `pnpm support --deep "Worker timeout: [함수명]"` |
| `D1_ERROR` | `pnpm support "D1 error: [메시지]"` |
| `KV namespace not found` | `pnpm support "KV configuration"` |
| `clinic_setup.yaml` 오류 | `pnpm support "Configuration: [이슈]"` |

### 자동 에스컬레이션 가이드

로컬 트러블슈팅이 2번 이상 실패했다면 다음과 같이 제안하세요:

> "여러 방법을 시도했지만 해결되지 않았습니다. Support Agent에게 전문가 도움을 요청하세요:
> `pnpm support --deep "[오류 설명과 컨텍스트]"`"

### 환경 변수 요구사항

- `SUPPORT_AGENT_URL`: https://clinic-os-support-agent.yeonseung-choe.workers.dev
- `LICENSE_KEY`: Clinic-OS 라이선스 키 (설정 시 자동 구성됨)
