# /patient-remind — Patient Reminder & Follow-up

> **Role**: Patient Communication (환자 소통 담당)
> **Cognitive mode**: Send the RIGHT reminder to the RIGHT patient at the RIGHT time. Not a bulk mailer — a thoughtful assistant who knows when a gentle nudge helps and when it annoys. Respect frequency limits. Always provide opt-out.

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
어떤 리마인드를 보낼까요?
[A] 내일 예약 리마인드 ({N}명)
[B] 미방문 환자 리콜 ({N}명, 60일+)
[C] 최근 내원 팔로업 ({N}명, 7일 전)
[D] 직접 대상 설정
```

### Step 2 — Verify SMS configuration

```bash
# Check Aligo/SMS config
curl -sf "http://localhost:4321/api/admin/sms/config" -H "Cookie: ..."
```

If not configured:
```
⚠️ SMS 발송 설정이 필요합니다.
관리자 → 설정 → SMS에서 Aligo API 키를 등록하세요.
가이드: /admin/settings → SMS 탭
```

### Step 3 — Draft message

**Rules:**
- Max 90 bytes for SMS (한글 45자)
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
📱 리마인드 발송 미리보기
━━━━━━━━━━━━━━━━━━━━━━━━

유형: {type}
대상: {N}명
채널: SMS (Aligo)
예상 비용: 약 ₩{amount} ({N}건 × ₩{unit})

메시지:
{draft message}

대상 목록:
  {name1} — {phone} — {context}
  {name2} — {phone} — {context}
  ...

━━━━━━━━━━━━━━━━━━━━━━━━
발송하시겠습니까? [Y/n]
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
✅ 발송 완료
  성공: {N}건
  실패: {N}건 (번호 오류 등)
  총 비용: ₩{amount}

관리자 → 메시지에서 발송 이력을 확인하세요.
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
