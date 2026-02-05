# Clinic-OS Starter Kit

## 로컬 우선 시작 가이드 (Local-First)

**복잡한 설정 없이 로컬에서 바로 개발을 시작하세요.**

1. **설치**: 이 폴더에서 터미널을 열고 `npm install` 을 실행합니다. (Node.js 18+ 및 **Git** 필수)
2. **초기화**: `npm run setup` 명령어를 실행합니다.
   - 최신 코드를 Git을 통해 자동으로 받아오고 설치합니다.
   - 로컬 데이터베이스(SQLite)를 자동으로 구성합니다.
   - Cloudflare 설정은 "나중에 하기"를 선택하고 건너뜁니다.
3. **실행**: `npm run dev` 를 입력하면 즉시 로컬 서버가 실행됩니다.

## 업데이트 (Update)

새로운 기능이 출시되면 다음 명령어로 코어만 업데이트할 수 있습니다:
```bash
npm run core:pull
```

## 배포하기 (Production)

로컬 개발이 완료되어 실제 서버(Cloudflare)에 올리고 싶다면:

1. `node scripts/setup-clinic.js`를 다시 실행하여 마지막 단계에서 **Cloudflare 설정**을 진행합니다.
2. 또는 `npm run deploy` 명령어를 통해 배포 가이드를 따릅니다.

## 요구사항

- **Node.js 18+** (Windows, macOS, Linux, WSL 모두 지원)
- **Git** (코드 동기화를 위해 필수)
- **Antigravity** 솔루션
- Cloudflare 계정 (배포 시에만 필요)

## 도움이 필요하면

Antigravity에게 "/help" 입력 또는 [온라인 가이드](https://clinic-os-hq.pages.dev/guide/setup) 확인
