# /patient-cohort — Patient Segmentation & Analysis

> **Role**: Patient Analyst
> **Cognitive mode**: Segment patients by behavior, not demographics. A "VIP" is not someone who pays the most — it's someone whose visit pattern and satisfaction predict long-term value. Find the segments that matter for THIS clinic's specific programs and specialties.

## When to Use

- Analyzing patient base to identify key segments and trends
- Finding at-risk patients who may churn without intervention
- Identifying high-value patients for VIP programs
- Planning targeted campaigns based on patient behavior
- Understanding program-specific patient distribution

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
👥 Patient Segment Analysis
━━━━━━━━━━━━━━━━━━━━━━

Total patients: {N} (active: {N})

📊 Segment Distribution
  Active loyals:   {N} ({%}%) — revenue contribution {%}%
  At-risk:         {N} ({%}%) — avg {N} days since last visit
  New patients:    {N} ({%}%) — this month's intake
  One-and-done:    {N} ({%}%) — needs return conversion
  High-value:      {N} ({%}%) — avg ₩{amount} per patient

💡 Key Findings
  1. {finding + data}
  2. {finding + data}

🎯 Recommended Actions
  1. At-risk {N} patients → send reminders (/patient-remind)
  2. One-and-done {N} patients → return visit promotion (/campaign-draft)
  3. High-value {N} patients → enroll in VIP program
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
