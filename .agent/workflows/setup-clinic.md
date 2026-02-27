---
description: 새 한의원 프로젝트 초기 설정 및 로컬 실행 (Zero-Touch)
---

# 초기 설정 워크플로우 (Zero-Touch)

이 워크플로우는 클라이언트가 Starter Kit을 다운로드한 후, 프로젝트를 초기화하고 개발 환경을 구축할 때 사용됩니다.

---

## 사전 요구사항

- **Node.js**: v18 이상
- **Git**: 설치됨
- **Wrangler**: Cloudflare CLI (자동 설치 안내)

---

## 1단계: 의존성 설치

클라이언트가 Starter Kit을 다운로드하면 이미 `clinic.json`에 인증 정보가 포함되어 있습니다.

// turbo
```bash
npm install
```

---

## 2단계: 자동 설정 마법사 실행

다음 명령어를 실행하여 지능형 셋업 마법사를 시작합니다.

// turbo
```bash
npm run setup
```

이 스크립트는 다음을 자동으로 처리합니다:
1. 시스템 건전성 체크 (Node, Git, Wrangler, WSL 등) 및 필요시 자동 설치 제안
2. `clinic.json`을 통한 HQ 서버 자동 연결 및 디바이스 등록
3. D1 데이터베이스 및 R2 버킷 자동 생성 (Wrangler 로그인 필요)
4. `.docking/config.yaml` 및 `wrangler.toml` 자동 생성

---

## 3단계: 애플리케이션 패키지 적용

셋업 마법사가 완료되면, 최신 앱 패키지를 가져와서 적용합니다.

// turbo
```bash
npm run fetch
```

또는

```bash
npm run core:pull
```

---

## 4단계: 로컬 개발 서버 시작

모든 설정이 완료되었습니다. 로컬 개발 서버를 실행하여 작동을 확인합니다.

// turbo
```bash
npm run dev
```

---

## 5단계: 완료 안내

사용자에게 다음 정보를 요약하여 안내합니다:
- **접속 주소**: http://localhost:4321 (로컬)
- **관리자 로그인**: `/admin` 경로
- **배포 명령**: `npm run deploy` 실행 시 Cloudflare Pages로 배포
- **도움말**: `/help` 입력 또는 `docs/` 폴더 참조

---

## 문제 해결

### core:pull 실행 시 "깃 저장소가 아닙니다" 오류
스타터킷 구조에서 루트에 `.git`이 없으면 발생합니다.
```bash
git init          # 루트에 .git 생성
npm run core:pull # 다시 시도
```
> v1.24.0부터 `update:starter` 및 `fetch.js`가 자동으로 `git init`을 실행합니다.
> 이전 버전 클라이언트는 위 명령을 수동으로 실행해야 합니다.

### clinic.json이 없는 경우
마법사가 자동으로 수동 입력 또는 브라우저 인증 모드로 전환합니다.

### Wrangler 로그인 필요
```bash
npx wrangler login
```

### DB 초기화 오류

> v1.24.3부터 `db:init`/`db:migrate`는 root의 `.docking/engine/migrate.js`를 직접 실행합니다.
> wrangler.toml이 없으면 명확한 에러 메시지와 함께 `.agent/last-error.json`에 보고서가 저장됩니다.

```bash
npm run db:init      # 스키마 마이그레이션 (wrangler.toml 필수)
npm run db:seed      # 샘플 데이터 삽입
```

wrangler.toml이 없다면 먼저 `npm run setup`을 실행하세요.
마이그레이션 실패 시 seeds는 자동으로 건너뛰며, 복구 후 `npm run db:seed`로 별도 실행할 수 있습니다.

### 에러 자동 복구

`.agent/last-error.json`이 존재하면 이전 에러가 해결되지 않은 상태입니다.
→ `.agent/workflows/troubleshooting.md`를 참조하여 복구 후 다음 단계로 진행하세요.

---

## 다음 단계: 병원 개별화 온보딩

기술적 설정이 완료되면, 병원 정보와 콘텐츠를 세팅하는 온보딩 워크플로우로 이어집니다.

→ **`/onboarding`** 워크플로우 실행 또는 "온보딩 시작"이라고 말해주세요.

온보딩 에이전트가 다음을 안내합니다:
1. 관리자 계정 보안 → 병원 정보 → 브랜딩 → **1차 배포**
2. 의료진 → 진료 프로그램 → 홈페이지 → **2차 배포**
3. 접수 폼 → 블로그 → 환자 관리 → **운영 시작**
4. SMS, SEO, 다국어 등 → **선택적 확장**

---

## 명령어 요약

| 명령어 | 용도 |
|--------|------|
| `npm run setup` | 초기 설정 마법사 |
| `npm run fetch` | 앱 패키지 가져오기 |
| `npm run dev` | 로컬 개발 서버 |
| `npm run deploy` | 프로덕션 배포 |
| `npm run doctor` | 시스템 건전성 체크 |
