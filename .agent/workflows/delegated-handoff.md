---
description: 위임 셋업 완료 프로젝트를 클라이언트가 인수할 때 사용하는 워크플로우
---

# 위임 인수 워크플로우 (Delegated Handoff)

위임 셋업으로 완성된 프로젝트를 클라이언트가 자기 환경에서 인수받는 플로우입니다.

---

## 판별 조건

다음 **모두 해당**이면 이 워크플로우 진입:
- `.agent/delegated-setup.json` 존재
- `handoff_status` ≠ `claimed`

---

## 인수 절차

### 1단계: 프로젝트 클론

```bash
git clone <GITHUB_URL> my-clinic
cd my-clinic
npm install
```

### 2단계: Cloudflare 로그인

> Cloudflare 계정이 없으면 먼저 생성하세요:
> 📖 [Cloudflare 셋업 가이드](https://clinic-os-hq.pages.dev/guide/cloudflare-setup) (`docs/CLOUDFLARE_SETUP_GUIDE.md`)

```bash
npx wrangler login
```

> 고객 본인의 Cloudflare 계정으로 로그인합니다.
> 위임 셋업 시 사용한 API Token은 인수 과정에서 자동 제거됩니다.

### 3단계: 핸드오프 실행

```bash
npm run handoff:claim
```

이 명령어가 수행하는 작업:
1. wrangler 로그인 상태 확인
2. HQ에 새 device_token 발급
3. `.docking/config.yaml` 업데이트 (새 device_token)
4. `.env`에서 `CLOUDFLARE_API_TOKEN` 제거 (보안)
5. `delegated-setup.json` → `claimed`
6. `softgate-state.json` 리셋 (소프트게이트 재시작)
7. `npm run health` 자동 실행

### 4단계: 소프트게이트 통과

인수 후 에이전트가 처음 열리면 소프트게이트를 안내합니다:
- Gate 0: 프로파일 확인/보완 (이미 인테이크 데이터로 채워져 있음)
- Gate 1: GitHub 연동 (이미 clone했으므로 remote 설정 확인)
- Gate 2: D1 백업 설정
- Gate 3: R2 스토리지 설정

### 5단계: 운영 모드

소프트게이트 통과 후 일반 운영 모드로 진입합니다.

---

## 주의사항

- `handoff:claim` 실행 전에 반드시 `npx wrangler login` 완료
- 인수 후 `.env`의 CF API Token은 자동 제거됨
- 문제 발생 시: `npm run health:fix` 또는 서포트 에이전트 활용

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `scripts/handoff-claim.js` | 인수 스크립트 |
| `.agent/delegated-setup.json` | 위임 상태 추적 |
| `.agent/workflows/delegated-setup.md` | 중앙 위임 셋업 워크플로우 |
| `.agent/workflows/softgate.md` | 소프트게이트 워크플로우 |
