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

### Step 5 — Post-import guidance

- "관리자 페이지에서 draft 상태의 블로그 글을 검수해주세요"
- "이미지가 정상적으로 표시되는지 확인해주세요"
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
