# /business-report — Monthly Business Report

> **Role**: Report Generator
> **Cognitive mode**: Generate a report the clinic owner can glance at in 2 minutes and know exactly how their business is doing. Lead with the verdict (good/bad/neutral), then evidence. Compare against previous period. No fluff — every number must come from D1 data. If data is missing, say so.

## When to Use

- At the beginning of each month to review previous month's performance
- When the clinic owner asks about business metrics or revenue
- Before strategic planning or marketing budget decisions
- When comparing performance across time periods

## Data Connectors (API)

```
GET /api/admin/dashboard            → KPI summary
GET /api/admin/analytics            → traffic data
GET /api/admin/patients             → patient counts + new/returning
GET /api/admin/reservations         → booking volume + patterns
GET /api/admin/payments             → revenue breakdown
GET /api/admin/expenses             → cost data
GET /api/admin/programs             → program performance
GET /api/admin/posts                → content performance
GET /api/admin/leads                → lead pipeline
GET /api/admin/staff                → staff utilization
```

## Procedure

### Step 1 — Determine report period

Default: previous full month. Ask if different period needed.

```
Which period should the report cover?
Default: {previous month} ({YYYY-MM-01} ~ {YYYY-MM-end})
```

### Step 2 — Collect all data

Fetch from all endpoints with date range filters:

```bash
# Dashboard KPIs
curl -sf "http://localhost:4321/api/admin/dashboard?from={start}&to={end}" -H "Cookie: ..."

# Patients
curl -sf "http://localhost:4321/api/admin/patients?from={start}&to={end}" -H "Cookie: ..."

# Revenue
curl -sf "http://localhost:4321/api/admin/payments?from={start}&to={end}" -H "Cookie: ..."

# Reservations
curl -sf "http://localhost:4321/api/admin/reservations?from={start}&to={end}" -H "Cookie: ..."
```

### Step 3 — Calculate metrics

| Category | Metrics |
|----------|---------|
| **Revenue** | Total, avg per patient, per visit, by program, vs previous |
| **Patients** | Total active, new, returning, churn rate |
| **Reservations** | Total, by day/time, no-show rate, avg per day |
| **Programs** | Revenue per program, patient count per program |
| **Content** | Blog views, top pages, lead source |
| **Expenses** | Total (if available), profit margin |

### Step 4 — Generate report

```
📊 Monthly Business Report — {month} {year}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏥 {clinic_name}

📋 One-line summary: {verdict — growth/stable/decline + key reason}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 Revenue
  Total revenue:     ₩{amount} ({change}% vs prev month)
  Per patient avg:   ₩{amount}
  Per visit avg:     ₩{amount}

  By program:
    {program1}:   ₩{amount} ({%}%)
    {program2}:   ₩{amount} ({%}%)
    ...

👥 Patients
  Total active:      {N}
  New:               {N} ({change}% vs prev month)
  Returning:         {N} (return rate {%}%)
  Churned:           {N}

📅 Reservations
  Total bookings:    {N} (daily avg {N})
  No-show rate:      {%}%
  Peak time:         {day} {time}
  Off-peak time:     {day} {time}

📝 Content (Website)
  Visitors:          {N}
  Top page:          {page} ({views} views)
  Lead inflow:       {N}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 Month-over-Month Changes
  Revenue:   {↑↓→} {%}%
  Patients:  {↑↓→} {%}%
  Bookings:  {↑↓→} {%}%

🎯 Recommendations for Next Month
  1. {specific action}
  2. {specific action}
  3. {specific action}
```

### Step 5 — Export options

```
How would you like to use this report?
[A] Done reviewing
[B] Deeper analysis (/clinic-advisor)
[C] Patient segment analysis (/patient-cohort)
[D] Save to file (docs/internal/reports/)
```

If D: save to `docs/internal/reports/{YYYY-MM}-business-report.md`.

## Triggers

- "월간 보고서", "사업 보고서", "매출 보고서"
- "이번 달 어땠어", "경영 리포트"
- "business report", "monthly report"

## All user-facing output in Korean.
