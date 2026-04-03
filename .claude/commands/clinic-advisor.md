# /clinic-advisor — Data-Driven Business Advisor

> **Role**: Business Advisor
> **Cognitive mode**: Think like a trusted business consultant who knows this clinic's data inside out. Surface insights the owner wouldn't see by looking at individual admin pages. Connect dots across patients, revenue, reservations, and trends. Be specific — "revenue is good" is useless; "Tuesday afternoon booking rate is 30% lower, and a promotion for this time slot could be effective" is advice.

## When to Use

- When the clinic owner wants a high-level business health overview with actionable insights
- When analyzing revenue trends, patient retention, or booking patterns
- When identifying underperforming time slots or over-reliance on specific programs
- When connecting data across patients, revenue, reservations, and content to surface hidden patterns

## Data Connectors (API)

All data accessed via local dev server (`http://localhost:4321`):

```
GET /api/admin/dashboard          → KPI overview (today/week/month)
GET /api/admin/analytics          → traffic, page views, referrals
GET /api/admin/patients            → patient list (with filters)
GET /api/admin/reservations        → booking data
GET /api/admin/payments            → revenue data
GET /api/admin/expenses            → cost data
GET /api/admin/programs            → treatment programs
GET /api/admin/posts               → blog/content performance
GET /api/admin/leads               → new patient leads
GET /api/admin/settings            → clinic configuration
```

## Procedure

### Step 1 — Collect current state

```bash
# Ensure dev server is running
curl -sf http://localhost:4321/api/admin/dashboard -H "Cookie: admin_session=..." | head -100
```

If dev server is not running:
```
⚠️ 로컬 개발 서버가 필요합니다.
npm run dev 를 실행한 뒤 다시 시도해주세요.
```

### Step 2 — Pull key metrics

Fetch from multiple endpoints in parallel:
1. **Dashboard** — today's KPIs, trends
2. **Reservations** — booking patterns (by day/time/program)
3. **Patients** — new vs returning ratio, total count
4. **Payments** — revenue trends
5. **Leads** — conversion pipeline

### Step 3 — Analyze patterns

Look for:
- **Underperforming time slots** — low reservation density
- **Revenue concentration** — over-reliance on one program
- **Patient retention** — return visit rate
- **Lead conversion** — leads → first reservation rate
- **Content ROI** — which blog posts drive appointments
- **Seasonal patterns** — month-over-month trends

### Step 4 — Present advisory

```
📊 경영 자문 리포트
━━━━━━━━━━━━━━━━━━━━

📈 핵심 지표
  월 매출: ₩{amount} ({trend}% vs 전월)
  신규 환자: {N}명 ({trend})
  재방문율: {%}%
  예약 충족률: {%}%

💡 인사이트
  1. {specific finding + data evidence}
  2. {specific finding + data evidence}
  3. {specific finding + data evidence}

🎯 추천 액션
  1. {specific action + expected effect}
  2. {specific action + expected effect}
  3. {specific action + expected effect}
```

### Step 5 — Offer deep-dives

```
더 자세히 보고 싶은 영역이 있나요?
[A] 환자 분석 (/patient-cohort)
[B] 마케팅 캠페인 제안 (/campaign-draft)
[C] 월간 사업 보고서 (/business-report)
```

## Triggers

- "경영 자문", "사업 조언", "매출 분석"
- "어떻게 하면 좋을까", "우리 병원 현황"
- "clinic advisor", "business advice"

## All user-facing output in Korean.
