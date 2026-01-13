# HQ Server 배포 가이드

Clinic-OS HQ 서버를 Cloudflare Workers에 배포하는 방법입니다.

---

## 1. 사전 준비

### Cloudflare 계정 설정
```bash
npx wrangler login
```

### 필요한 리소스
- D1 Database (라이선스, 클라이언트, 디바이스 관리)
- R2 Bucket (패키지 저장)

---

## 2. D1 데이터베이스 생성

```bash
cd hq
npx wrangler d1 create clinic-hq-db
```

출력된 `database_id`를 `wrangler.toml`에 복사:

```toml
[[d1_databases]]
binding = "DB"
database_name = "clinic-hq-db"
database_id = "YOUR-DATABASE-ID"  # ← 여기에 붙여넣기
```

### 스키마 적용
```bash
npx wrangler d1 execute clinic-hq-db --remote --file=schema.sql
```

---

## 3. R2 버킷 생성

```bash
npx wrangler r2 bucket create clinic-packages
```

`wrangler.toml` 확인:
```toml
[[r2_buckets]]
binding = "PACKAGES_BUCKET"
bucket_name = "clinic-packages"
```

---

## 4. 환경변수 설정

프로덕션 비밀키 설정:
```bash
npx wrangler secret put ADMIN_API_KEY
# 강력한 API 키 입력
```

---

## 5. 배포

```bash
npx wrangler deploy
```

배포 후 URL 확인 (예: `https://clinic-hq.your-subdomain.workers.dev`)

---

## 6. 초기 관리자 설정

> ⚠️ **중요**: 첫 배포 후 즉시 관리자 비밀번호 변경!

기본 계정:
- Email: `admin@clinic-os.com`
- Password: `changeme123`

### 비밀번호 변경 (필수)

D1 콘솔에서 직접 업데이트:
```sql
-- 새 비밀번호 해시 생성 필요 (bcrypt)
UPDATE admins SET password_hash = 'NEW_BCRYPT_HASH' WHERE email = 'admin@clinic-os.com';
```

---

## 7. 클라이언트 코드 업데이트

`scripts/setup-clinic.js`의 DEFAULT_HQ_URL 수정:
```javascript
const DEFAULT_HQ_URL = 'https://clinic-hq.your-subdomain.workers.dev';
```

---

## 8. 테스트

1. HQ 대시보드 접속: `https://YOUR-HQ-URL/admin/login`
2. 로그인 테스트
3. 클라이언트 등록 테스트: `https://YOUR-HQ-URL/register`

---

## 문제 해결

### 로그 확인
```bash
npx wrangler tail
```

### D1 데이터 확인
```bash
npx wrangler d1 execute clinic-hq-db --remote --command="SELECT * FROM clients"
```
