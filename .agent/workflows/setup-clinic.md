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

## 2단계: 자동 설정 마법사 실행 (Agent-First)

Agent-First Architecture의 **단계별 설치 시스템**을 사용합니다.

### 방법 A: 단계별 설치 (권장 - 메모리 안전)

메모리 제한 환경에서도 안전하게 실행되는 16단계 설치:

```bash
# 설치 상태 확인
npm run setup:step -- --status

# 한 단계씩 진행 (SIGKILL 발생핏도 해당 단계부터 재시작)
npm run setup:step -- --next
# → 완료될 때까지 위 명령어 반복
```

**장점:**
- 한 번에 하나의 단계만 실행 (저메모리)
- 각 단계는 멱등성 보장 (이미 완료된 단계는 skip)
- SIGKILL 발생 시 해당 단계부터 자동 재시작
- 진행 상태가 `.agent/setup-progress.json`에 저장
- `setup:agent`도 기본적으로 이 경로를 사용하며, fast setup 실패 시 자동으로 여기로 폴백

### 방법 B: 빠른 일괄 설치 (고성능 환경)

비Windows + 메모리 8GB 이상 환경이라면 루트/core 의존성 설치를 병렬 처리하는 빠른 경로를 사용할 수 있습니다.

```bash
npm run setup:fast
```

**적합한 경우:**
- macOS 또는 Linux
- 메모리 8GB 이상
- 사용자가 브라우저 인증과 일괄 설치 흐름을 받아들일 수 있음
- signed `clinic.json`이 있어 `setup:agent`가 자동 fast 선택 가능

```bash
npm run setup:agent -- --prefer-fast
```

`setup:agent`는 고성능 fresh install + signed `clinic.json`이면 내부적으로 `setup:fast -- --auto`를 먼저 시도하고,
실패하면 `setup:step`으로 자동 전환합니다.

### 방법 C: 레거시 일괄 설치

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

wrangler.toml이 없다면 먼저 `npm run setup:step -- --next`를 진행하세요.
고성능 환경이라면 `npm run setup:fast`도 가능합니다.
마이그레이션 실패 시 seeds는 자동으로 건너뛰며, 복구 후 `npm run db:seed`로 별도 실행할 수 있습니다.

### 에러 자동 복구

`.agent/last-error.json`이 존재하면 이전 에러가 해결되지 않은 상태입니다.

```bash
# 에러 상태 확인
npm run error:status

# 자동 복구 시도 (autoRecoverable 단계만)
npm run error:recover

# 강제 복구 (수동 단계도 시도)
npm run error:recover -- --force

# 수동으로 해결한 경우 표시
npm run error:resolve
```

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

### Agent-First 명령어 (신규)

| 명령어 | 용도 |
|--------|------|
| `npm run status` | **통합 상태 확인** (설치+온볼딩+건강도+Lock) |
| `npm run setup:step -- --next` | 다음 설치 단계 실행 |
| `npm run setup:step -- --status` | 설치 진행도 확인 |
| `npm run setup:fast` | 고성능 환경용 빠른 일괄 설치 |
| `npm run error:status` | 에러 복구 상태 확인 |
| `npm run error:recover` | 자동 복구 시도 |

### 기존 명령어

| 명령어 | 용도 |
|--------|------|
| `npm run setup` | 초기 설정 마법사 (레거시) |
| `npm run setup:fast` | 병렬 의존성 설치가 포함된 빠른 모놀리식 setup |
| `npm run fetch` | 앱 패키지 가져오기 |
| `npm run dev` | 로컬 개발 서버 |
| `npm run deploy` | 프로덕션 배포 |
| `npm run doctor` | 시스템 건전성 체크 |
