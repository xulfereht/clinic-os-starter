---
hq_slug: r2-storage-guide
hq_title: "R2 스토리지 관리"
hq_category: "09. 시스템 설정"
hq_sort: 5
hq_active: true
---
# R2 스토리지 관리

Cloudflare R2는 이미지, 파일 등을 저장하는 클라우드 스토리지입니다.
관리자 페이지에서 업로드하는 모든 이미지가 R2에 저장됩니다.

> **소프트게이트 Gate 3** — 이미지 업로드 전에 R2 설정이 필요합니다.

---

## R2란?

```
로컬 컴퓨터                    Cloudflare R2
──────────                    ──────────────
public/local/logo.png         clinic-uploads/staff/dr-kim.jpg
(코드에서 사용하는 정적 파일)     (관리자 페이지에서 업로드한 이미지)
  ↓                              ↓
git으로 관리                    클라우드에 자동 보관
```

| 저장소 | 용도 | 백업 방법 |
|--------|------|----------|
| `public/local/` | 정적 에셋 (로고, 아이콘) | Git + GitHub |
| **R2 버킷** | 동적 업로드 (의료진 사진, 블로그 이미지) | Cloudflare 인프라 |

---

## 1. R2 설정하기

### Cloudflare 계정이 없는 경우

```
에이전트에게: "Cloudflare 계정 만들고 R2 설정해줘"
```

1. [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) 접속
2. 이메일, 비밀번호 입력
3. 무료 플랜 선택 — R2는 월 10GB까지 무료

### Cloudflare 로그인

```bash
npx wrangler login
```

브라우저에서 로그인 화면이 뜨면 로그인합니다. 한 번만 하면 됩니다.

### R2 버킷 생성

```bash
# 버킷 생성 (한의원 고유 이름 사용)
npx wrangler r2 bucket create {clinic-name}-uploads

# 예시
npx wrangler r2 bucket create seoul-clinic-uploads
```

### wrangler.toml 설정 확인

`wrangler.toml`에 R2 설정이 있는지 확인합니다:

```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "seoul-clinic-uploads"  # 위에서 생성한 버킷명
```

> `npm run setup` 실행 시 이 설정이 자동으로 생성되지만,
> 실제 버킷 생성은 Cloudflare 로그인 후 별도로 해야 합니다.

---

## 2. 이미지 업로드 경로

### 관리자 페이지에서 업로드

관리자 페이지에서 이미지를 업로드하면 자동으로 R2에 저장됩니다:

| 업로드 위치 | R2 저장 경로 | 예시 |
|------------|-------------|------|
| 의료진 사진 | `staff/{id}/{filename}` | `staff/1/profile.jpg` |
| 프로그램 이미지 | `programs/{id}/{filename}` | `programs/5/thumbnail.jpg` |
| 블로그 이미지 | `posts/{id}/{filename}` | `posts/12/hero.jpg` |
| 갤러리 | `gallery/{filename}` | `gallery/clinic-interior.jpg` |
| 기타 | `uploads/{filename}` | `uploads/document.pdf` |

### 코드에서 사용하는 정적 파일

코드에서 직접 참조하는 파일은 `public/local/`에 저장합니다:

```
public/local/
├── logo.png          # 한의원 로고
├── favicon.ico       # 파비콘
├── og-image.jpg      # SNS 공유 이미지
└── images/
    └── banner.jpg    # 코드에서 참조하는 배너
```

이 파일들은 Git으로 관리되어 GitHub에 백업됩니다.

---

## 3. R2 버킷 관리

### 파일 목록 확인

```bash
# R2 버킷의 파일 목록
npx wrangler r2 object list {bucket-name}

# 예시
npx wrangler r2 object list seoul-clinic-uploads
```

### 파일 다운로드

```bash
# 특정 파일 다운로드
npx wrangler r2 object get {bucket-name}/{path} --file {local-path}

# 예시
npx wrangler r2 object get seoul-clinic-uploads/staff/1/profile.jpg --file ./profile.jpg
```

### 파일 업로드 (CLI)

```bash
# 파일 직접 업로드
npx wrangler r2 object put {bucket-name}/{path} --file {local-path}

# 예시
npx wrangler r2 object put seoul-clinic-uploads/gallery/new-photo.jpg --file ./new-photo.jpg
```

### 파일 삭제

```bash
npx wrangler r2 object delete {bucket-name}/{path}
```

---

## 4. 로컬 개발 환경

로컬에서 `npm run dev` 실행 시 R2는 로컬 에뮬레이션으로 동작합니다:

```
로컬 R2 저장 위치: .wrangler/state/v3/r2/
```

로컬에서 업로드한 이미지는 프로덕션 R2와 별개입니다.

---

## 5. R2 설정 미완료 시

R2가 설정되지 않은 상태에서 이미지 업로드를 시도하면:

```
에이전트: "이미지를 업로드하려면 Cloudflare R2 설정이 필요합니다.
          지금 설정할까요?"
```

에이전트가 자동으로 안내합니다:
1. Cloudflare 로그인 확인
2. R2 버킷 생성
3. wrangler.toml 업데이트
4. 배포하여 프로덕션 반영

---

## 6. 요금

| 항목 | 무료 한도 | 초과 시 |
|------|----------|--------|
| 저장 용량 | 10 GB/월 | $0.015/GB |
| 읽기 요청 | 1,000만/월 | $0.36/100만 |
| 쓰기 요청 | 100만/월 | $4.50/100만 |

> 일반적인 한의원 홈페이지는 무료 한도 내에서 충분합니다.

---

## 문제 해결

### "R2 bucket not found"

버킷이 생성되지 않았습니다:

```bash
# 버킷 목록 확인
npx wrangler r2 bucket list

# 없으면 생성
npx wrangler r2 bucket create {bucket-name}
```

### "wrangler.toml에 R2 설정이 없습니다"

```toml
# wrangler.toml에 추가
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "your-clinic-uploads"
```

### 이미지가 프로덕션에서 안 보일 때

1. 배포가 완료되었는지 확인: `npm run deploy`
2. R2 버킷이 프로덕션에 생성되었는지 확인
3. `wrangler.toml`의 `bucket_name`이 실제 버킷명과 일치하는지 확인

---

## 관련 문서

| 문서 | 설명 |
|------|------|
| [GitHub 연동](GITHUB_SETUP_GUIDE.md) | public/local/ 파일의 Git 백업 |
| [백업 가이드](BACKUP_GUIDE.md) | D1 데이터베이스 백업 |
| [배포 워크플로우](../hq/guides/deployment-workflow.md) | 프로덕션 배포 절차 |
