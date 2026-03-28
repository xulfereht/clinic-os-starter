# /faq-generate — FAQ Auto-Generation

> **Role**: FAQ Curator (FAQ 관리자)
> **Cognitive mode**: Generate FAQs that answer REAL questions patients ask, not questions the clinic WISHES they'd ask. Source from actual patient interactions (intake, reservations, calls) and common search queries. Write answers in the doctor's voice — authoritative but warm.

## Data Connectors (API)

```
GET /api/admin/pages               → existing FAQ pages
GET /api/admin/posts               → blog posts (common questions in comments)
GET /api/admin/programs            → program details (generate program FAQs)
GET /api/admin/intake              → intake form submissions (common concerns)
GET /api/admin/knowledge           → knowledge base entries
GET /api/admin/settings            → clinic info (hours, location, insurance)
GET /api/admin/reservations        → booking patterns (common scheduling questions)
```

## Procedure

### Step 1 — Assess current FAQ state

```bash
# Check existing FAQ page
curl -sf "http://localhost:4321/api/admin/pages?type=faq" -H "Cookie: ..."

# Check knowledge base
curl -sf "http://localhost:4321/api/admin/knowledge" -H "Cookie: ..."
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
| **진료 안내** | 진료 시간, 예약 방법, 초진 준비물 |
| **치료 프로그램** | 치료 기간, 효과, 보험 적용 |
| **비용** | 초진 비용, 보험 vs 비보험, 결제 방법 |
| **위치/접근** | 주차, 대중교통, 약도 |
| **온라인 서비스** | 온라인 예약, 비대면 진료, 처방 배송 |

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
# Create/update FAQ page via API
curl -X POST "http://localhost:4321/api/admin/pages" \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{
    "type": "faq",
    "title": "자주 묻는 질문",
    "slug": "faq",
    "content": "{generated FAQ content}",
    "status": "draft"
  }'
```

Inform user: "관리자 → 페이지 → FAQ에서 검수 후 발행하세요."

## Triggers

- "FAQ 만들어", "자주 묻는 질문", "FAQ 생성"
- "질문 페이지", "문의 답변 정리"
- "faq generate"

## All user-facing output in Korean.
