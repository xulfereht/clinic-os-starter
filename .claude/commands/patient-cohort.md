# /patient-cohort — Patient Segmentation & Analysis

> **Role**: Patient Analyst (환자 분석가)
> **Cognitive mode**: Segment patients by behavior, not demographics. A "VIP" is not someone who pays the most — it's someone whose visit pattern and satisfaction predict long-term value. Find the segments that matter for THIS clinic's specific programs and specialties.

## Data Connectors (API)

```
GET /api/admin/patients             → full patient list
GET /api/admin/patients/[id]        → individual patient detail
GET /api/admin/segments             → existing segments
GET /api/admin/crm/cohort           → cohort analysis
GET /api/admin/reservations         → visit history
GET /api/admin/payments             → payment history
GET /api/admin/programs             → available programs
GET /api/admin/vip-management       → VIP tier data
```

## Procedure

### Step 1 — Pull patient data

```bash
# Patient list with recent activity
curl -sf http://localhost:4321/api/admin/patients?limit=500 -H "Cookie: ..."

# Reservation history
curl -sf http://localhost:4321/api/admin/reservations?limit=1000 -H "Cookie: ..."

# Existing segments
curl -sf http://localhost:4321/api/admin/segments -H "Cookie: ..."
```

### Step 2 — Build segments

Default segmentation framework:

| Segment | Criteria | Action |
|---------|----------|--------|
| **Active loyals** | 3+ visits in last 90 days | Retention → VIP program |
| **At-risk** | Was active, no visit in 60+ days | Win-back → reminder |
| **New patients** | First visit in last 30 days | Nurture → follow-up |
| **One-and-done** | Single visit, 90+ days ago | Re-engagement → offer |
| **High-value** | Top 20% by total payment | Appreciation → premium |
| **Program-specific** | Grouped by treatment program | Targeted → content |

### Step 3 — Analyze each segment

For each segment:
- **Size**: How many patients
- **Revenue contribution**: % of total revenue
- **Visit frequency**: Average visits per month
- **Trend**: Growing or shrinking vs last period
- **Top programs**: What they come for

### Step 4 — Present analysis

```
👥 환자 세그먼트 분석
━━━━━━━━━━━━━━━━━━━━━━

전체 환자: {N}명 (활성: {N}명)

📊 세그먼트 분포
  충성 고객:     {N}명 ({%}%) — 매출 기여 {%}%
  이탈 위험:     {N}명 ({%}%) — 마지막 방문 평균 {N}일 전
  신규 환자:     {N}명 ({%}%) — 이번 달 유입
  1회 방문:      {N}명 ({%}%) — 재방문 전환 필요
  고가치:        {N}명 ({%}%) — 인당 평균 ₩{amount}

💡 핵심 발견
  1. {발견 + 데이터}
  2. {발견 + 데이터}

🎯 추천 액션
  1. 이탈 위험 {N}명 → 리마인드 발송 (/patient-remind)
  2. 1회 방문 {N}명 → 재방문 프로모션 (/campaign-draft)
  3. 고가치 {N}명 → VIP 프로그램 등록
```

### Step 5 — Offer next actions

- `/campaign-draft` — create targeted campaign for a segment
- `/patient-remind` — send reminders to at-risk patients
- `/clinic-advisor` — broader business context

## Triggers

- "환자 분석", "세그먼트", "코호트"
- "어떤 환자가 많아", "이탈 환자", "VIP"
- "patient cohort", "segment analysis"

## All user-facing output in Korean.
