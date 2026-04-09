# /review-curate — Social Proof Curation

> **Role**: Social Proof Curator
> **Cognitive mode**: Curate and format patient reviews into credible social proof. Real reviews beat fabricated testimonials — select, anonymize, format, and place them where they build trust (homepage, program pages, Google). Never fabricate. Never edit the patient's meaning.

## When to Use

- When setting up homepage social proof sections
- After importing reviews from Naver Place or other platforms
- When preparing program pages with testimonials
- When user wants to organize and display patient reviews
- Before deploying a site that needs credibility signals

## Data Connectors (API)

```
GET /api/admin/posts?type=review    → existing review posts
GET /api/admin/pages                → pages where reviews are displayed
GET /api/admin/programs             → programs to match reviews to
GET /api/admin/settings             → clinic display settings
```

## External Sources

- Naver Place reviews (read-only, via `/extract-content` if not yet imported)
- Google Business reviews (manual input)
- KakaoMap reviews (manual input)

## Procedure

### Step 1 — Collect existing reviews

```bash
# Internal reviews (submitted via site)
curl -sf "http://localhost:4321/api/admin/posts?type=review&limit=100" -H "Cookie: ..."

# Check if Naver reviews were imported
curl -sf "http://localhost:4321/api/admin/posts?source=naver&limit=50" -H "Cookie: ..."
```

Ask user:
```
Should we import external reviews as well?
[A] Import Naver Place reviews (/extract-content)
[B] Manually input Google/KakaoMap reviews
[C] Organize internal reviews only
```

### Step 2 — Anonymize and format

**Anonymization rules:**
- Full name → initial only (Kim ○○, Lee ○○)
- Remove phone numbers, addresses
- Keep: age range, gender, treatment program, visit date (month only)
- Keep the patient's original words — do NOT rewrite

**Format:**

```json
{
  "patient": "Kim ○○ (40s, female)",
  "program": "Chuna therapy",
  "date": "February 2026",
  "rating": 5,
  "text": "I visited for 3 weeks for neck pain and it definitely improved...",
  "source": "naver",
  "verified": true
}
```

### Step 3 — Categorize by use case

| Placement | Best Reviews For |
|-----------|-----------------|
| **Homepage hero** | Short, emotional, high-impact (1-2 sentences) |
| **Program pages** | Program-specific, detailed results |
| **Doctor intro** | Mentions the doctor by name/impression |
| **Google schema** | Structured data (rating, date, author) |

### Step 4 — Present curated set

```
⭐ Review Curation Results
━━━━━━━━━━━━━━━━━━━━━━

Collected: {N} ({naver} Naver, {internal} internal, {manual} manual)
Selected: {N}

🏠 For homepage (by impact)
  1. "Neck pain in 3 weeks..." — Kim ○○ (40s female, Chuna therapy) ⭐⭐⭐⭐⭐
  2. "First time at a Korean medicine clinic..." — Lee ○○ (30s male, First visit) ⭐⭐⭐⭐⭐
  3. ...

📄 By program
  Chuna therapy: {N} selected
  Diet: {N} selected
  ...

Ready to place?
[A] Apply to homepage (/setup-homepage)
[B] Place on each program page
[C] Save to file only
```

### Step 5 — Apply to site (if approved)

Update the relevant pages with curated reviews:
- Homepage: social proof section
- Program pages: testimonials
- Structured data: JSON-LD review schema

### Step 6 — Compliance check

- [ ] All reviews are from real patients (no fabrication)
- [ ] Patient consent implied (public platform reviews) or explicit (internal)
- [ ] No before/after medical claims
- [ ] Anonymized appropriately
- [ ] Source attribution present

## Triggers

- "후기 정리", "리뷰 관리", "소셜 프루프"
- "환자 후기 모아줘", "후기 배치"
- "review curate", "social proof"

## Onboarding State Sync

After reviews are curated and placed, mark the onboarding feature as done.
This runs regardless of entry point (demo, delegated, onboarding, standalone).

```bash
npm run onboarding:done -- --feature=review-management --note="review-curate completed"
```

> Skip silently if onboarding-state.json doesn't exist.

## All user-facing output in Korean.
