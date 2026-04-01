# /patient-remind — Patient Reminder & Follow-up

> **Role**: Patient Communication
> **Cognitive mode**: Send the RIGHT reminder to the RIGHT patient at the RIGHT time. Not a bulk mailer — a thoughtful assistant who knows when a gentle nudge helps and when it annoys. Respect frequency limits. Always provide opt-out.

## When to Use

- Sending appointment reminders for tomorrow's reservations
- Following up with patients after recent visits
- Recalling patients who haven't visited in 60+ days
- Sending birthday or seasonal greetings to active patients
- Checking SMS configuration and channel readiness

## Data Connectors (API)

```
GET  /api/admin/reservations        → upcoming appointments
GET  /api/admin/patients            → patient list + contact info
GET  /api/admin/patients/[id]       → individual patient detail
GET  /api/admin/sms                 → SMS config (Aligo integration)
POST /api/admin/messages            → send message
GET  /api/admin/channels            → available channels
GET  /api/admin/settings            → clinic info
GET  /api/admin/programs            → treatment programs
```

## Reminder Types

| Type | When | Target |
|------|------|--------|
| `appointment` | D-1 before appointment | Patients with tomorrow's reservation |
| `follow-up` | D+7 after visit | Recent patients (check-in) |
| `recall` | D+30/60/90 after last visit | No upcoming reservation |
| `birthday` | On birthday | Active patients |
| `seasonal` | Season change | Program-specific patients |

## Procedure

### Step 1 — Determine reminder type

If user says "리마인드" without context, check what's actionable:

```bash
# Tomorrow's appointments (most common)
curl -sf "http://localhost:4321/api/admin/reservations?date={tomorrow}" -H "Cookie: ..."

# Patients with no recent visit (recall candidates)
curl -sf "http://localhost:4321/api/admin/patients?last_visit_before={60_days_ago}" -H "Cookie: ..."
```

Present options:
```
Which reminder to send?
[A] Tomorrow's appointment reminder ({N} patients)
[B] No-visit patient recall ({N} patients, 60+ days)
[C] Recent visit follow-up ({N} patients, 7 days ago)
[D] Custom target selection
```

### Step 2 — Verify SMS configuration

```bash
# Check Aligo/SMS config
curl -sf "http://localhost:4321/api/admin/sms/config" -H "Cookie: ..."
```

If not configured:
```
⚠️ SMS sending configuration required.
Go to Admin → Settings → SMS and register the Aligo API key.
Guide: /admin/settings → SMS tab
```

### Step 3 — Draft message

**Rules:**
- Max 90 bytes for SMS (45 Korean characters)
- Include clinic name
- Include opt-out text: "수신거부: {phone}"
- No medical advice in SMS

**Templates:**

**Appointment (D-1):**
```
[{clinic_name}] {patient_name}님, 내일 {time} 예약 안내드립니다. 변경/취소: {phone}
```

**Follow-up (D+7):**
```
[{clinic_name}] {patient_name}님, 치료 후 경과는 어떠신가요? 궁금하신 점은 {phone}으로 연락주세요.
```

**Recall (D+60):**
```
[{clinic_name}] {patient_name}님, 건강은 잘 챙기고 계신가요? 정기 관리가 필요하시면 예약해주세요. {phone}
```

### Step 4 — Preview and confirm

```
📱 Reminder Send Preview
━━━━━━━━━━━━━━━━━━━━━━━━

Type: {type}
Target: {N} patients
Channel: SMS (Aligo)
Estimated cost: approx ₩{amount} ({N} messages × ₩{unit})

Message:
{draft message}

Recipient list:
  {name1} — {phone} — {context}
  {name2} — {phone} — {context}
  ...

━━━━━━━━━━━━━━━━━━━━━━━━
Send? [Y/n]
```

### Step 5 — Send (with confirmation only)

**SAFETY: Never auto-send. Always require explicit user confirmation.**

```bash
# Send via message API
curl -X POST "http://localhost:4321/api/admin/messages" \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{
    "type": "sms",
    "recipients": [{patient_ids}],
    "message": "{approved message}",
    "scheduled_at": "{now or scheduled time}"
  }'
```

### Step 6 — Report

```
✅ Sending Complete
  Success: {N} messages
  Failed: {N} messages (wrong number, etc.)
  Total cost: ₩{amount}

Check delivery history at Admin → Messages.
```

## Frequency Guard

- Same patient: max 1 reminder per 7 days
- Check recent message history before sending
- Warn if patient was recently contacted

## Triggers

- "리마인드", "환자 알림", "문자 보내기"
- "내일 예약 알려줘", "안 오는 환자 연락"
- "patient remind", "send reminder"

## All user-facing output in Korean.
