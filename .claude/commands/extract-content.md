# /extract-content — Naver Content Extraction & Import

Auto-extracts the client's Naver Blog/Place content and imports it into Clinic-OS.

## When to Use

- When importing a clinic's existing Naver Blog posts into Clinic-OS
- When extracting Naver Place information (address, phone, hours) for clinic setup
- During onboarding Tier 2 (core content) to populate the blog and enrich clinic info
- Anytime blog content migration from Naver is needed

## Source of Truth
- `scripts/extract-naver.js` — CLI entry point
- `scripts/lib/naver-blog-extractor.js` — blog extraction
- `scripts/lib/naver-place-extractor.js` — Place extraction
- `scripts/lib/content-analyzer.js` — content analysis
- `scripts/lib/image-pipeline.js` — image R2 upload
- `scripts/lib/html-cleaner.js` — HTML cleanup
- `docs/CONTENT_EXTRACT_GUIDE.md` — user guide

## Execution Flow

### Step 1 — Gather information (conversation)

Confirm the following with the user:

1. **Naver Blog ID** — found in blog URL (e.g., `blog.naver.com/varo_clinic` → `varo_clinic`)
   - Multiple blogs supported
2. **Naver Place URL** — `naver.me` short URL or `place.naver.com` URL
3. **Extraction scope** — how many recent posts? (default 50)
4. **Image handling** — whether to upload to R2

### Step 2 — Dry Run extraction

First run `--dry-run` to preview extraction results:

```bash
node scripts/extract-naver.js \
  --blog-id={blogId} \
  --place-url="{placeUrl}" \
  --limit={limit} \
  --dry-run
```

Read the result file (`.agent/naver-extract-{date}.json`) and report to the user:
- Number of extracted posts and images
- Key specialties (analysis results)
- Category distribution
- Place information

### Step 3 — User confirmation

Show extraction results and confirm whether to proceed with actual import:
- "이 결과로 임포트를 진행할까요?"
- Adjust `--limit`, `--skip-images`, etc. if needed

### Step 4 — Actual import

Execute after approval. Select the appropriate mode for the environment:

**Local DB (development/direct install):**
```bash
node scripts/extract-naver.js \
  --blog-id={blogId} \
  --place-url="{placeUrl}" \
  --limit={limit} \
  --local
```

**API mode (deployed site, delegated setup):**
```bash
node scripts/extract-naver.js \
  --blog-id={blogId} \
  --place-url="{placeUrl}" \
  --limit={limit} \
  --site-url={siteUrl} \
  --api-key={apiKey}
```

**Wrangler mode (direct production access):**
```bash
node scripts/extract-naver.js \
  --blog-id={blogId} \
  --place-url="{placeUrl}" \
  --limit={limit} \
  --db={dbName} \
  --env=production
```

Result report:
- Number of posts imported to D1 (in draft status)
- Number of images uploaded to R2
- clinic-profile.json update details
- Admin review method: `/admin/posts?type=blog`

### Step 5 — Post-import quality check

Import 후 반드시 품질 검수를 실행한다. 특히 **2020년 이전 글 (SE2 구 에디터)**은 추출 품질이 낮을 수 있다.

**공통 검수 항목:**
- "관리자 페이지에서 draft 상태의 블로그 글을 검수해주세요"
- "이미지가 정상적으로 표시되는지 확인해주세요"

**SE2 (구 에디터, ~2020년 이전) 주의사항:**
네이버 SE2 에디터로 작성된 글은 모바일 API가 `briefContents` (요약 1-2문단)만 반환하는 경우가 많다.
자동 추출 파이프라인이 데스크톱 PostView를 시도하지만 실패할 수 있다.

| 증상 | 원인 | 대처 |
|------|------|------|
| 앞 1-2문단만 추출됨 | 데스크톱 PostView 실패 → briefContents 폴백 | 해당 글의 네이버 URL을 직접 열어 전체 본문을 수동 복사 |
| 이미지 누락 | SE2 모바일은 blank.gif만 반환 | 네이버 원문에서 이미지 URL 직접 확인 후 수동 업로드 |
| 이미지가 글 하단으로 밀림 | SE2의 table 레이아웃 → 정리 과정에서 순서 변동 | 관리자 에디터에서 이미지 위치 수동 교정 |
| 네이버 잔해 (날짜, 공감, 태그 등) | html-cleaner가 커버 못한 패턴 | 에디터에서 수동 삭제, 발견 시 패턴 보고 |

**잔해 체크리스트 (import 후 확인):**
- [ ] 본문 내 타임스탬프 텍스트 ("2019.04.13 15:23" 등)
- [ ] 공감/좋아요 버튼 텍스트
- [ ] 네이버 내부 링크 (blog.naver.com 등)
- [ ] 태그 (#한의원 #치료 등)
- [ ] 구독/이웃추가 버튼 텍스트

**자동 정리 범위** (html-cleaner.js가 처리):
공감 모듈, 태그 영역, 구독 버튼, 작성자 정보, SNS 공유, 네이버 내부 링크(→텍스트 보존),
타임스탬프/공감/댓글/이웃추가/공유하기/태그 텍스트 패턴.

> 새로운 잔해 패턴 발견 시 `scripts/lib/html-cleaner.js`의 REMOVE_SELECTORS 또는
> htmlToMarkdown 후처리에 패턴을 추가한다.

**Post-import guidance:**
- Can suggest program planning based on analysis results
- Can suggest clinic settings enrichment using Place info (address/phone/hours)

## Migration

The `source_url` column is required before import:
```bash
# Local
npx wrangler d1 execute {db} --local --file=migrations/0928_posts_source_url.sql
# Production
npx wrangler d1 execute {db} --file=migrations/0928_posts_source_url.sql --remote
```

## Onboarding State Sync

After successful import (Step 4), mark the onboarding feature as done.
This runs regardless of entry point (demo, delegated, onboarding, standalone).

```bash
npm run onboarding:done -- --feature=naver-content-import --note="extract-content 완료"
```

> Skip silently if onboarding-state.json doesn't exist.

## Onboarding Integration

This feature is also run during onboarding Tier 2 (core content) stage.
When called during onboarding, Place information auto-enriches clinic-info/contact/hours.
Can be skipped, and run later anytime via `/extract-content`.

## Triggers

- "네이버 블로그 추출", "블로그 임포트", "콘텐츠 추출"
- "네이버 글 가져오기", "블로그 글 옮기기"
- "플레이스 정보 가져오기"

## All user-facing output in Korean.
