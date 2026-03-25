---
hq_slug: content-extract
hq_title: 네이버 콘텐츠 추출 가이드
hq_category: "01. 시작하기"
hq_sort: 35
hq_active: false
---

# 네이버 콘텐츠 추출 가이드

기존 네이버 블로그/플레이스 콘텐츠를 Clinic-OS로 자동 임포트하는 기능입니다.

## 개요

- **블로그**: 네이버 블로그 글을 마크다운으로 변환하여 D1에 저장
- **플레이스**: 네이버 플레이스 정보(상호, 주소, 전화, 영업시간, 이미지)를 추출
- **이미지**: 블로그/플레이스 이미지를 R2에 업로드하여 외부 의존 제거
- **분석**: 콘텐츠 기반 전문 분야 자동 분석

## 사전 준비

### 마이그레이션 적용

`posts` 테이블에 `source_url` 컬럼이 필요합니다:

```bash
# 로컬
npx wrangler d1 execute {db-name} --local --file=migrations/0928_posts_source_url.sql

# 프로덕션
npx wrangler d1 execute {db-name} --file=migrations/0928_posts_source_url.sql --remote
```

### API 키 확인

API 모드 사용 시 Admin API Key가 필요합니다:

- `v1.30.0+` 설치: `setup-clinic.js`가 자동 생성
- 기존 설치: 관리자 페이지 설정 → API 키 생성, 또는:

```bash
# 로컬 DB에서 직접 확인
npx wrangler d1 execute {db-name} --local \
  --command "SELECT value FROM site_settings WHERE category='api' AND key='admin_api_key'"
```

## 사용법

### AI 에이전트 사용 (권장)

```
/extract-content
```

대화형으로 블로그 ID, 플레이스 URL, 추출 범위를 안내받고 실행합니다.

### CLI 직접 사용

#### 기본 — Dry Run (추출만, DB 저장 안 함)

```bash
node scripts/extract-naver.js \
  --blog-id=myblog \
  --place-url="https://naver.me/xxxxx" \
  --limit=10 \
  --dry-run
```

#### 로컬 DB에 임포트

```bash
node scripts/extract-naver.js \
  --blog-id=myblog \
  --place-url="https://naver.me/xxxxx" \
  --local
```

#### 프로덕션 — API 모드 (권장)

사이트가 배포된 상태에서 API를 통해 임포트:

```bash
node scripts/extract-naver.js \
  --blog-id=myblog \
  --place-url="https://naver.me/xxxxx" \
  --site-url=https://your-site.pages.dev \
  --api-key=cos_xxxxxxxxxxxx
```

#### 프로덕션 — Wrangler 모드

API 키가 없거나 직접 DB 접근이 필요한 경우:

```bash
node scripts/extract-naver.js \
  --blog-id=myblog \
  --place-url="https://naver.me/xxxxx" \
  --db={db-name} \
  --env=production
```

### 전체 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--blog-id=<id>` | 네이버 블로그 ID (복수 지정 가능) | — |
| `--place-url=<url>` | 네이버 플레이스 URL | — |
| `--dry-run` | 추출만 수행, DB 저장 안 함 | false |
| `--limit=<n>` | 최근 N개 글만 추출 | 50 |
| `--skip-images` | 이미지 다운로드 스킵 | false |
| `--output=json` | 결과를 JSON 파일로 출력 | db |
| `--local` | 로컬 DB에 임포트 | false |
| `--site-url=<url>` | API 모드: 사이트 URL | — |
| `--api-key=<key>` | API 모드: Admin API Key | — |
| `--db=<name>` | Wrangler 모드: D1 DB 이름 | wrangler.toml에서 자동 |
| `--env=<env>` | Wrangler 환경 | production |
| `--bucket=<name>` | R2 버킷 이름 | wrangler.toml에서 자동 |

## 임포트 후 확인

1. 관리자 페이지 `/admin/posts?type=blog` 에서 임포트된 글 확인
2. 모든 글은 **draft** 상태로 저장됨 — 검수 후 발행
3. 이미지가 R2에 정상 업로드되었는지 확인
4. 중복 임포트 방지: `source_url` 기준으로 이미 존재하는 글은 건너뜀

## 추출 결과 파일

Dry run 시 `.agent/naver-extract-{date}.json`에 결과 저장:

- 추출된 글 목록 (제목, 날짜, 카테고리)
- 플레이스 정보 (상호, 주소, 전화 등)
- 전문 분야 분석 결과
- 이미지 목록

## 지원 소스

현재 네이버 블로그와 플레이스만 지원합니다. 추가 소스(카카오, 인스타그램 등)는 향후 확장 예정입니다.

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| "source_url 컬럼 없음" | 마이그레이션 미적용 | `migrations/0928_posts_source_url.sql` 실행 |
| "API Key 인증 실패" | 키 미등록 또는 불일치 | 관리자 설정에서 API 키 재생성 |
| "블로그 글 0개 추출" | 비공개 블로그 또는 잘못된 ID | 블로그 공개 설정 확인, `m.blog.naver.com/{id}` 접근 확인 |
| "플레이스 추출 실패" | URL 형식 오류 | `naver.me` 단축 URL 또는 `m.place.naver.com/xxxxx` 형태 사용 |
| "이미지 업로드 실패" | R2 버킷 미설정 | `wrangler.toml`에 R2 바인딩 확인, `--skip-images`로 우선 진행 |
