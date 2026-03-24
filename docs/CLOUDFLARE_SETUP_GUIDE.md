# Cloudflare 셋업 가이드

Clinic-OS는 Cloudflare 인프라 위에서 동작합니다. 이 가이드는 Cloudflare 계정 생성부터 CLI 로그인까지 안내합니다.

---

## Cloudflare란?

Clinic-OS가 사용하는 Cloudflare 서비스:

| 서비스 | 용도 | 무료 범위 |
|--------|------|----------|
| **Pages** | 홈페이지 호스팅 + 서버 렌더링 (SSR) | 무제한 |
| **D1** | 데이터베이스 (환자, 예약, 콘텐츠) | 5GB |
| **R2** | 이미지/파일 저장소 | 10GB/월 |

> 일반적인 한의원 홈페이지는 무료 범위 내에서 충분히 운영됩니다.

---

## 1. 계정 가입

1. [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) 접속
2. 이메일과 비밀번호 입력
3. 이메일 인증 완료
4. 무료(Free) 플랜 선택

> 이미 Cloudflare 계정이 있다면 기존 계정을 그대로 사용할 수 있습니다.

---

## 2. Wrangler CLI 로그인

Wrangler는 Cloudflare의 명령줄 도구입니다. 셋업 스크립트가 자동으로 사용합니다.

```bash
npx wrangler login
```

브라우저가 열리면 Cloudflare에 로그인하고 **Allow** 버튼을 클릭합니다.
터미널에 `Successfully logged in` 메시지가 나오면 완료입니다.

### 로그인 확인

```bash
npx wrangler whoami
```

계정 이름과 Account ID가 표시되면 정상입니다.

---

## 3. D1 데이터베이스 (자동 생성)

셋업 스크립트(`npm run setup:step`)가 D1 데이터베이스를 자동으로 생성합니다.
수동으로 생성하려면:

```bash
npx wrangler d1 create {병원이름}-db
```

생성된 `database_id`가 `wrangler.toml`에 자동 반영됩니다.

---

## 4. R2 스토리지 (자동 생성)

이미지 업로드용 R2 버킷도 셋업 스크립트가 자동으로 생성합니다.
수동으로 생성하려면:

```bash
npx wrangler r2 bucket create {병원이름}-uploads
```

---

## 5. API Token 생성 (위임 셋업 전용)

위임 셋업을 이용하는 경우, 셋업 담당자에게 API Token을 전달해야 합니다.

### 토큰 생성 방법

1. [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) 접속
2. **Create Token** 클릭
3. **Create Custom Token** 선택
4. 토큰 이름: `Clinic-OS Setup` (자유)
5. 권한 설정:

| 권한 그룹 | 권한 | 수준 |
|-----------|------|------|
| Account / Account Settings | Account Settings | Read |
| Account / Cloudflare Pages | Pages | Edit |
| Account / D1 | D1 | Edit |
| Account / R2 Storage | R2 | Edit |

> **Account Settings (Read)** 는 셋업 도구가 계정 정보를 자동 감지하는 데 필요합니다.
> 이 권한이 없어도 셋업은 가능하지만, 추가 설정이 필요할 수 있습니다.

6. **Account Resources**: 본인 계정 선택
7. **Continue to summary** → **Create Token**
8. 표시된 토큰을 복사하여 위임 셋업 폼에 입력

> **보안 주의**: 토큰은 생성 시 한 번만 표시됩니다. 안전한 곳에 보관하세요.
> 셋업 완료 후에는 토큰을 삭제해도 됩니다.

---

## 자주 묻는 질문

### 비용이 발생하나요?

Cloudflare Free 플랜으로 충분합니다. 일반적인 한의원 홈페이지는 무료 범위 내에서 운영됩니다.
트래픽이 매우 많은 경우(월 10만 요청 초과)에만 유료 플랜이 필요합니다.

### 기존 Cloudflare 계정을 사용할 수 있나요?

네. 기존 계정에 다른 사이트가 있어도 Clinic-OS를 추가로 사용할 수 있습니다.
D1, R2, Pages 프로젝트는 계정 내에서 독립적으로 운영됩니다.

### API Token이 유출되면?

즉시 [API Tokens 페이지](https://dash.cloudflare.com/profile/api-tokens)에서 해당 토큰을 삭제하세요.
토큰 삭제 후에는 더 이상 접근할 수 없습니다.

### `npx wrangler login`이 안 되는 환경이면?

서버나 CI 환경에서는 API Token을 환경 변수로 설정합니다:

```bash
export CLOUDFLARE_API_TOKEN="your-token-here"
```

이 환경 변수가 설정되면 `wrangler login` 없이도 모든 wrangler 명령이 동작합니다.

---

## 다음 단계

- 직접 설치: `npm run setup:step -- --next` 실행
- 위임 셋업: HQ에서 위임 폼에 API Token 입력
- R2 상세 설정: `docs/R2_STORAGE_GUIDE.md` 참조
