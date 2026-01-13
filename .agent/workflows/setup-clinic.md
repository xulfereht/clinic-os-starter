---
description: 새 한의원 프로젝트 초기 설정 및 로컬 실행 (Zero-Touch)
---

# 초기 설정 워크플로우 (Zero-Touch)

이 워크플로우는 클라이언트가 Starter Kit을 다운로드한 후, 프로젝트를 초기화하고 개발 환경을 구축할 때 사용됩니다.

## 1단계: 환경 자동 도킹 및 시작

클라이언트가 Starter Kit을 다운로드하면 이미 `clinic.json`에 인증 정보가 포함되어 있습니다. Antigravity는 이를 감지하고 자동화를 시작합니다.

// turbo
```bash
npm install
```

## 2단계: 자동 설정 마법사 실행

다음 명령어를 실행하여 지능형 셋업 마법사를 시작합니다. 이 스크립트는 다음을 자동으로 처리합니다:
1. 시스템 건전성 체크 (Node, Git, Wrangler, WSL 등) 및 필요시 자동 설치 제안
2. `clinic.json`을 통한 HQ 서버 자동 연결 및 디바이스 등록
3. D1 데이터베이스 및 R2 버킷 자동 생성 (Wrangler 로그인 필요)
4. `.docking/config.yaml` 및 `wrangler.toml` 자동 생성

// turbo
```bash
node scripts/setup-clinic.js
```

## 3단계: 애플리케이션 패키지 적용

셋업 마법사가 완료되면, 최신 앱 패키지를 가져와서 적용합니다.

// turbo
```bash
node .docking/engine/fetch.js
```

## 4단계: 로컬 개발 서버 시작

모든 설정이 완료되었습니다. 로컬 개발 서버를 실행하여 작동을 확인합니다.

// turbo
```bash
npm run dev
```

## 5단계: 완료 안내

사용자에게 다음 정보를 요약하여 안내합니다:
- **접속 주소**: http://localhost:4321 (로컬)
- **배포 경로**: `npm run deploy` 실행 시 Cloudflare Pages로 배포 및 가드레일 작동
- **관리 가이드**: `/help` 입력 또는 `docs/` 폴더 참조

> [!NOTE]
> 만약 `clinic.json`이 누락된 경우, 마법사가 자동으로 수동 입력 또는 브라우저 인증 모드로 전환합니다.
