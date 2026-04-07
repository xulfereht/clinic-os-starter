# /faq-generate — FAQ Auto-Generation

> **Role**: FAQ Curator
> **Cognitive mode**: Generate FAQs that answer REAL questions patients ask, not questions the clinic WISHES they'd ask. Source from actual patient interactions (intake, reservations, calls) and common search queries. Write answers in the doctor's voice — authoritative but warm.

## When to Use

- When creating a FAQ page for the clinic website from scratch
- When generating per-program FAQs based on treatment details and patient patterns
- When enriching existing FAQ content with data-driven questions from intake forms and reservations
- When you need compliance-checked Q&A pairs in the doctor's voice

## Data Connectors

**API endpoints (verified):**
```
GET /api/admin/pages               → existing FAQ pages (by slug, NOT by type)
GET /api/admin/posts               → blog posts (source for common questions)
GET /api/admin/programs            → program details (generate per-program FAQs)
GET /api/admin/clinic-info         → clinic info (hours, location, insurance)
GET /api/admin/hours               → business hours
```

**Direct DB queries (for data not exposed via API):**
```sql
-- Intake form patterns
SELECT chief_complaint, COUNT(*) as cnt FROM patient_events
  WHERE type='intake' GROUP BY chief_complaint ORDER BY cnt DESC LIMIT 20;

-- Reservation patterns
SELECT COUNT(*) as cnt FROM reservations GROUP BY strftime('%w', datetime(date, 'unixepoch'));
```

## Procedure

### Step 1 — Assess current FAQ state

```bash
# Check existing FAQ page (by slug, NOT by type — pages table has no type column)
npx wrangler d1 execute DB --local --command \
  "SELECT id, slug, title, LENGTH(sections) as sections_len FROM pages WHERE slug='faq';"

# Check existing FAQ sections in programs
npx wrangler d1 execute DB --local --command \
  "SELECT slug, name FROM programs WHERE sections LIKE '%FAQ%' AND is_active=1;"

# Clinic info for operational FAQs
npx wrangler d1 execute DB --local --command \
  "SELECT key, value FROM site_settings WHERE category IN ('general','contact','hours');"
```

### Step 2 — Identify question sources

1. **Clinic profile** — hours, location, parking, insurance → basic operational FAQs
2. **Programs** — each program generates 3-5 common questions
3. **Intake data** — what patients ask before first visit
4. **Blog content** — topics patients search for → generate Q&A pairs
5. **User input** — "자주 받는 질문이 있으세요?"

### Step 3 — Generate FAQ categories

| Category | Example Questions |
|----------|-------------------|
| **Visit Guide** | Business hours, reservation method, first visit preparation |
| **Treatment Programs** | Treatment duration, effectiveness, insurance coverage |
| **Cost** | First visit cost, insurance vs non-insurance, payment methods |
| **Location/Access** | Parking, public transport, directions |
| **Online Services** | Online reservation, telemedicine, prescription delivery |

### Step 4 — Write FAQ entries

For each Q&A:
- **Question**: Natural language, as a patient would ask
- **Answer**: 2-3 sentences, authoritative, includes actionable info
- **Source**: Where this question comes from (data-backed)

```
📋 FAQ 생성 결과
━━━━━━━━━━━━━━━━

📁 진료 안내 (5문항)
  Q: 예약 없이 방문할 수 있나요?
  A: 예약 우선제로 운영하고 있으며, 예약 없이 오시면
     대기가 길어질 수 있습니다. 전화({phone}) 또는
     온라인 예약을 권장합니다.

  Q: 초진 시 무엇을 준비해야 하나요?
  A: 신분증과 기존 복용 약 목록을 지참해 주세요.
     내원 10분 전 도착하시면 문진표 작성 시간이 충분합니다.
  ...

📁 치료 프로그램 (per program)
  ...

총 {N}개 FAQ 생성됨
```

### Step 5 — Compliance check

- [ ] No treatment outcome guarantees
- [ ] No specific pricing (changes frequently)
- [ ] No comparison with other clinics
- [ ] Medical advice ends with "자세한 내용은 내원 상담 시 안내드립니다"

### Step 6 — Save to site

```bash
# Save FAQ page with sections JSON (pages table uses sections column, NOT content)
npx wrangler d1 execute DB --local --command \
  "INSERT OR REPLACE INTO pages (id, slug, title, description, sections, is_published, created_at, updated_at)
   VALUES (
     'page-faq',
     'faq',
     '자주 묻는 질문',
     '환자분들이 자주 묻는 질문과 답변입니다.',
     '[{\"type\":\"PageIntro\",\"title\":\"자주 묻는 질문\",\"description\":\"궁금한 점을 확인해보세요.\"},
       {\"type\":\"FAQ\",\"title\":\"진료 안내\",\"items\":[{\"q\":\"...\",\"a\":\"...\"}]},
       {\"type\":\"FAQ\",\"title\":\"치료 프로그램\",\"items\":[{\"q\":\"...\",\"a\":\"...\"}]},
       {\"type\":\"InquiryCTA\"}]',
     0,
     unixepoch(),
     unixepoch()
   );"
```

> **sections JSON must conform to `docs/SECTION_SCHEMAS.md`.**
> FAQ page uses `PageIntro` + multiple `FAQ` sections + `InquiryCTA`. See schema doc for exact Props.

Inform user: "관리자 → 페이지 → FAQ에서 검수 후 발행하세요."

## Triggers

- "FAQ 만들어", "자주 묻는 질문", "FAQ 생성"
- "질문 페이지", "문의 답변 정리"
- "faq generate"

## All user-facing output in Korean.
