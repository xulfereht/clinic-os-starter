# Clinic-OS Starter Kit

## 로컬 우선 시작 가이드 (Local-First)

**복잡한 설정 없이 로컬에서 바로 개발을 시작하세요.**

1. **설치**: 이 폴더에서 터미널을 열고 `npm install` 을 실행합니다. (Node.js 18+ 및 **Git** 필수)
2. **초기화**: 에이전트가 있다면 `npm run setup:agent` 를 우선 사용하세요.
   - 브라우저 인증, 코어 다운로드, 의존성 설치, 단계별 setup을 자동으로 진행합니다.
   - 설치 도중 멈추면 같은 명령을 다시 실행하면 이어서 진행합니다.
3. **문제 진단**: 설치/업데이트가 꼬이면 `npm run agent:doctor -- --json` 으로 현재 상태를 먼저 확인합니다.
   - 너무 구형 설치본이면 `npm run agent:lifecycle -- --json` 이 신규 설치 + 마이그레이션 권장을 알려줍니다.
   - 새 스타터킷을 다시 받으면서 예전 폴더가 통째로 남았다면 `npm run agent:restore -- --dry-run --json` 으로 추출 가능한 복원 계획을 먼저 확인합니다.
4. **실행**: `npm run dev` 를 입력하면 즉시 로컬 서버가 실행됩니다.

에이전트를 쓰지 않는 수동 환경에서는 `npm run setup:step -- --next` 로 단계별 설치를 진행하세요.

## 업데이트 (Update)

새로운 기능이 출시되면 다음 명령어로 코어만 업데이트할 수 있습니다:
```bash
npm run core:pull -- --auto
```

업데이트 전에 무엇을 해야 할지 모르겠다면:
```bash
npm run agent:doctor -- --json
npm run agent:lifecycle -- --json
npm run agent:restore -- --dry-run --json
npm run agent:sync -- --dry-run
```

## 배포하기 (Production)

로컬 개발이 완료되어 실제 서버(Cloudflare)에 올리고 싶다면:

1. `node scripts/setup-clinic.js`를 다시 실행하여 마지막 단계에서 **Cloudflare 설정**을 진행합니다.
2. 또는 `npm run deploy` 명령어를 통해 배포 가이드를 따릅니다.

## 요구사항

- **Node.js 18+** (공식 설치 기준: macOS 또는 WSL Ubuntu)
- **Git** (코드 동기화를 위해 필수)
- **Antigravity** 솔루션
- Cloudflare 계정 (배포 시에만 필요)

## 도움이 필요하면

Antigravity에게 "/help" 입력 또는 [온라인 가이드](https://clinic-os-hq.pages.dev/guide/setup) 확인
