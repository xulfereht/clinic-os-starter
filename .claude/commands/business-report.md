# /business-report — Monthly Business Report

> **Role**: Report Generator (경영 리포터)
> **Cognitive mode**: Generate a report the clinic owner can glance at in 2 minutes and know exactly how their business is doing. Lead with the verdict (good/bad/neutral), then evidence. Compare against previous period. No fluff — every number must come from D1 data. If data is missing, say so.

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
어떤 기간의 보고서를 생성할까요?
기본: {previous month} ({YYYY-MM-01} ~ {YYYY-MM-末})
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
📊 월간 경영 보고서 — {month} {year}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏥 {clinic_name}

📋 한줄 요약: {verdict — 성장/유지/하락 + 핵심 이유}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 매출
  총 매출:        ₩{amount} ({change}% vs 전월)
  환자당 평균:    ₩{amount}
  방문당 평균:    ₩{amount}

  프로그램별:
    {program1}:   ₩{amount} ({%}%)
    {program2}:   ₩{amount} ({%}%)
    ...

👥 환자
  전체 활성:      {N}명
  신규:           {N}명 ({change}% vs 전월)
  재방문:         {N}명 (재방문율 {%}%)
  이탈:           {N}명

📅 예약
  총 예약:        {N}건 (일 평균 {N}건)
  노쇼율:         {%}%
  피크 시간대:    {day} {time}
  비수기 시간대:  {day} {time}

📝 콘텐츠 (웹사이트)
  방문자:         {N}명
  인기 페이지:    {page} ({views}회)
  리드 유입:      {N}건

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 전월 대비 변화
  매출:   {↑↓→} {%}%
  환자:   {↑↓→} {%}%
  예약:   {↑↓→} {%}%

🎯 다음 달 추천
  1. {구체적 액션}
  2. {구체적 액션}
  3. {구체적 액션}
```

### Step 5 — Export options

```
보고서를 어떻게 활용하시겠습니까?
[A] 이대로 확인 완료
[B] 더 자세한 분석 (/clinic-advisor)
[C] 환자 세그먼트 분석 (/patient-cohort)
[D] 파일로 저장 (docs/internal/reports/)
```

If D: save to `docs/internal/reports/{YYYY-MM}-business-report.md`.

## Triggers

- "월간 보고서", "사업 보고서", "매출 보고서"
- "이번 달 어땠어", "경영 리포트"
- "business report", "monthly report"

## All user-facing output in Korean.
