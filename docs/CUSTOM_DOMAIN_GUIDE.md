---
hq_slug: custom-domain
hq_title: 커스텀 도메인 연결 가이드
hq_category: "01. 시작하기"
hq_sort: 35
hq_active: true
---

# 커스텀 도메인 연결 가이드

사이트에 직접 소유한 도메인(예: `www.baroklinic.com`)을 연결하는 방법입니다.

---

## 도메인이 없는 경우

### 옵션 A: Cloudflare에서 직접 구매 (권장)

가장 간단합니다. Cloudflare가 호스팅도 하고 도메인도 관리하므로 DNS 설정이 자동입니다.

1. [Cloudflare Dashboard](https://dash.cloudflare.com) 로그인
2. 좌측 메뉴 **도메인 등록** → **도메인 등록**
3. 원하는 도메인 검색 (예: `baroklinic.com`)
4. 결제 후 등록 완료
5. 아래 **"Cloudflare에 이미 있는 도메인 연결"** 단계로 이동

> Cloudflare 도메인은 원가 수준으로 저렴합니다 (.com 기준 연 $10 내외).
> 한국 도메인(.kr, .co.kr)은 Cloudflare에서 직접 구매 불가 — 아래 옵션 B를 사용하세요.

### 옵션 B: 외부에서 구매 후 Cloudflare로 연결

가비아, 호스팅KR, GoDaddy 등에서 도메인을 구매한 뒤 Cloudflare로 네임서버를 변경합니다.

1. 도메인 등록 업체에서 도메인 구매
2. Cloudflare Dashboard → **웹사이트 추가** → 구매한 도메인 입력
3. Cloudflare가 네임서버 2개를 안내합니다:
   ```
   예: lara.ns.cloudflare.com
       phil.ns.cloudflare.com
   ```
4. 도메인 등록 업체 관리 페이지에서 **네임서버 변경**:
   - 기존 네임서버 삭제
   - Cloudflare 네임서버 2개 입력
5. 네임서버 변경은 최대 24시간 소요 (보통 1~2시간)
6. Cloudflare에서 "활성" 상태 확인 후 아래 연결 단계로 이동

> **가비아**: 도메인 관리 → 네임서버 설정 → 직접 입력
> **호스팅KR**: My 호스팅 → 도메인 관리 → 네임서버 변경
> **GoDaddy**: 도메인 설정 → 네임서버 → 사용자 지정 입력

---

## 도메인을 Cloudflare Pages에 연결

도메인이 Cloudflare에 등록/연결된 상태에서 사이트에 연결합니다.

### 1. Pages 프로젝트에 도메인 추가

```bash
# CLI로 추가
npx wrangler pages project update <프로젝트명> --custom-domain=www.yourdomain.com

# 또는 Cloudflare Dashboard에서:
# Pages → 프로젝트 → 커스텀 도메인 → 도메인 추가
```

> **www 서브도메인 권장**: `www.yourdomain.com`을 기본으로 사용하고, `yourdomain.com`(루트)에서 www로 리다이렉트 설정.

### 2. DNS 레코드 확인

Cloudflare가 자동으로 CNAME 레코드를 생성합니다:

```
CNAME  www  →  <프로젝트명>.pages.dev  (프록시됨)
```

수동으로 추가해야 한다면:
1. Cloudflare Dashboard → DNS → 레코드 추가
2. 유형: **CNAME**
3. 이름: **www**
4. 대상: **<프로젝트명>.pages.dev**
5. 프록시 상태: **프록시됨** (주황색 구름)

### 3. 루트 도메인 리다이렉트 (선택)

`yourdomain.com` → `www.yourdomain.com` 리다이렉트:

1. Cloudflare Dashboard → 규칙 → 리다이렉트 규칙
2. 새 규칙 만들기:
   - 조건: 호스트 이름 = `yourdomain.com`
   - 작업: 동적 리다이렉트
   - URL: `https://www.yourdomain.com${http.request.uri.path}`
   - 상태 코드: 301

### 4. SSL/TLS 확인

Cloudflare Pages는 자동으로 SSL 인증서를 발급합니다.
- Dashboard → SSL/TLS → 암호화 모드가 **전체(엄격)** 인지 확인
- 인증서 발급에 최대 15분 소요

---

## 도메인 연결 후 사이트 설정 변경

도메인 연결이 완료되면 사이트 설정을 업데이트해야 합니다:

### 1. site_url 변경

```bash
# 관리자 페이지에서 변경하거나, DB 직접 업데이트
npx wrangler d1 execute <DB명> --remote \
  --command="UPDATE site_settings SET value='https://www.yourdomain.com' WHERE key='site_url'"
```

### 2. config.ts URL 변경

```typescript
// src/config.ts
export const siteConfig = {
  url: 'https://www.yourdomain.com',
  // ...
};
```

### 3. OG 이미지 absolute URL

OG 메타 태그의 이미지 URL이 새 도메인으로 표시되는지 확인.

### 4. 검색엔진 인증 (선택)

- **Google Search Console**: DNS TXT 레코드 또는 HTML 파일 인증
- **네이버 서치어드바이저**: HTML 메타 태그 인증
- **사이트맵 제출**: `https://www.yourdomain.com/sitemap.xml`

### 5. 재배포

설정 변경 후 빌드 + 배포:

```bash
npm run build
npm run deploy
```

---

## 자주 묻는 질문

**Q: 기존 pages.dev URL은 계속 사용 가능한가요?**
A: 네, 커스텀 도메인을 연결해도 기존 `*.pages.dev` URL은 계속 동작합니다.

**Q: 도메인 구매 비용은?**
A: .com 기준 연 $10~15, .kr 기준 연 약 20,000원. 연 단위 갱신.

**Q: 네임서버 변경 후 사이트가 안 열려요.**
A: 네임서버 전파에 최대 24시간 걸립니다. 보통 1~2시간이면 됩니다.

**Q: www 없이 도메인만 쓸 수 있나요?**
A: 가능하지만 www 서브도메인을 권장합니다. 루트 도메인은 CNAME flattening이 필요하고, 일부 DNS 호환성 이슈가 있을 수 있습니다.
