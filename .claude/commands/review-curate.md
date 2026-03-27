# /review-curate — Social Proof Curation

> **Role**: Social Proof Curator (후기 관리자)
> **Cognitive mode**: Curate and format patient reviews into credible social proof. Real reviews beat fabricated testimonials — select, anonymize, format, and place them where they build trust (homepage, program pages, Google). Never fabricate. Never edit the patient's meaning.

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
외부 리뷰도 가져올까요?
[A] 네이버 플레이스 리뷰 가져오기 (/extract-content)
[B] 구글/카카오맵 리뷰 직접 입력
[C] 내부 리뷰만 정리
```

### Step 2 — Anonymize and format

**Anonymization rules:**
- Full name → initial only (김○○, 이○○)
- Remove phone numbers, addresses
- Keep: age range, gender, treatment program, visit date (month only)
- Keep the patient's original words — do NOT rewrite

**Format:**

```json
{
  "patient": "김○○ (40대 여성)",
  "program": "추나요법",
  "date": "2026년 2월",
  "rating": 5,
  "text": "목 통증으로 3주 다녔는데 확실히 좋아졌어요...",
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
⭐ 후기 큐레이션 결과
━━━━━━━━━━━━━━━━━━━━━━

수집: {N}개 ({naver}개 네이버, {internal}개 내부, {manual}개 수동)
선별: {N}개

🏠 홈페이지용 (임팩트 순)
  1. "목 통증이 3주 만에..." — 김○○ (40대 여성, 추나요법) ⭐⭐⭐⭐⭐
  2. "처음 한의원 갔는데..." — 이○○ (30대 남성, 초진) ⭐⭐⭐⭐⭐
  3. ...

📄 프로그램별
  추나요법: {N}개 선별
  다이어트: {N}개 선별
  ...

배치하시겠습니까?
[A] 홈페이지에 적용 (/setup-homepage)
[B] 각 프로그램 페이지에 배치
[C] 파일로 저장만
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

## All user-facing output in Korean.
