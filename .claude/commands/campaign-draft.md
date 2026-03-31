# /campaign-draft — Patient Campaign Drafting

> **Role**: CRM Marketing Helper
> **Cognitive mode**: Draft campaigns that feel personal, not automated. A Korean medicine clinic's patients expect warmth and care — mass marketing tone destroys trust. Every message should read like it came from the doctor's office, not a marketing department. Segment-aware, compliance-safe.

## When to Use

- When you need an SMS/KakaoTalk campaign to re-engage lapsed patients
- When writing patient-facing messages such as new patient follow-up or seasonal program announcements
- When planning a campaign targeting specific segments (by program, visit frequency, etc.)
- When you need a medical advertising compliance check before sending SMS/KakaoTalk

## Data Connectors (API)

```
GET  /api/admin/campaigns           → existing campaigns
POST /api/admin/campaigns           → create campaign
GET  /api/admin/segments            → patient segments
GET  /api/admin/patients            → target patient list
GET  /api/admin/channels            → messaging channels (SMS, KakaoTalk)
GET  /api/admin/sms                 → SMS configuration (Aligo)
GET  /api/admin/programs            → treatment programs
GET  /api/admin/settings            → clinic name, contact info
```

## Procedure

### Step 1 — Determine campaign type

| Type | Target | Trigger |
|------|--------|---------|
| `win-back` | No visit in 60+ days | "안 오시는 환자 연락" |
| `follow-up` | Recent first visit | "신규 환자 팔로업" |
| `seasonal` | All active patients | "계절 프로그램 안내" |
| `event` | Segment-specific | "이벤트", "프로모션" |
| `reminder` | Upcoming appointments | → redirect to `/patient-remind` |
| `program` | Program-specific patients | "프로그램 대상 안내" |

If unclear, ask: "어떤 캠페인을 만들까요?"

### Step 2 — Select target segment

```bash
# Get available segments
curl -sf http://localhost:4321/api/admin/segments -H "Cookie: ..."
# Or use /patient-cohort results
```

Present targeting options:
```
📋 캠페인 대상 선택
  [A] 이탈 위험 환자 ({N}명) — 60일+ 미방문
  [B] 신규 환자 ({N}명) — 최근 30일 첫 방문
  [C] {program} 환자 ({N}명) — 특정 프로그램
  [D] 전체 활성 환자 ({N}명)
  [E] 직접 조건 설정
```

### Step 3 — Draft message

**Tone rules:**
- Write as the clinic, not as software
- Use "원장님" or clinic name, not "Clinic-OS"
- Warm, personal, brief
- Include specific value (not generic "안녕하세요")
- Always include opt-out guidance for SMS

**Template by type:**

**Win-back:**
```
{clinic_name}입니다.
{patient_name}님, 건강은 잘 챙기고 계신가요?
{season/context}에 맞는 {program} 프로그램을 준비했습니다.
{benefit — one sentence}
예약: {phone} / {url}
```

**Follow-up:**
```
{clinic_name}입니다.
{patient_name}님, 지난번 내원 후 경과는 어떠신가요?
{follow-up care advice — one sentence}
궁금하신 점은 언제든 연락주세요.
{phone}
```

### Step 4 — Compliance check

Before presenting:
- [ ] No medical treatment promises
- [ ] No before/after claims
- [ ] No price comparisons with other clinics
- [ ] Opt-out method included (SMS)
- [ ] Patient name placeholder, not hardcoded

Run `/review-compliance` on the draft if needed.

### Step 5 — Present campaign plan

```
📣 캠페인 초안
━━━━━━━━━━━━━━━━

유형: {type}
대상: {segment} ({N}명)
채널: {SMS / KakaoTalk / both}
예상 발송일: {date}

📝 메시지:
{draft message}

━━━━━━━━━━━━━━━━
진행하시겠습니까?
[A] 이대로 발송 준비
[B] 메시지 수정
[C] 대상 변경
```

### Step 6 — Register campaign (if approved)

```bash
curl -X POST http://localhost:4321/api/admin/campaigns \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{
    "name": "{campaign name}",
    "type": "{type}",
    "segment_id": "{segment}",
    "message": "{approved message}",
    "channel": "{sms|kakao}",
    "scheduled_at": "{date}",
    "status": "draft"
  }'
```

Inform user: "관리자 페이지 → 캠페인에서 최종 확인 후 발송하세요."

## Triggers

- "캠페인", "환자 연락", "문자 보내기"
- "이탈 환자 연락", "프로모션 안내"
- "campaign draft", "patient outreach"

## Onboarding State Sync

After campaign is drafted and registered, mark the onboarding feature as done.
This runs regardless of entry point (demo, delegated, onboarding, standalone).

```bash
npm run onboarding:done -- --feature=campaign-sms --note="campaign-draft 완료"
```

> Skip silently if onboarding-state.json doesn't exist.

## All user-facing output in Korean.
