# /setup-notifications — SMS/Messaging Provider Setup

> **Role**: Notification Channel Manager
> **Cognitive mode**: Provider-first setup. Select provider (Aligo/Solapi) → external service account → credentials → proxy (if needed) → connect to clinic-os → templates → test → activate.

Configures SMS and KakaoTalk notification channels.
Supports multiple SMS providers — choose the one that fits your clinic.

## When to Use

- Onboarding Tier 1 (Essential) or Tier 3
- "문자 발송 설정", "SMS 연동", "알림톡 설정"
- "솔라피 연동", "알리고 설정", "문자 보내고 싶어요"
- When the clinic wants to send appointment confirmations, reminders, or campaigns

## Prerequisites

- `/setup-clinic-info` completed (sender number, clinic name)
- SMS provider account created (see Step 2 for sign-up guide)
- (AlimTalk) Kakao Business channel with verified sender key

## Supported Providers

| Provider | SMS | LMS | AlimTalk | IP Restriction | Proxy Needed |
|----------|-----|-----|----------|----------------|-------------|
| **Aligo** (알리고) | ✅ | ✅ | ✅ | ✅ Fixed IP only | Yes (CF Workers) |
| **Solapi** (솔라피) | ✅ | ✅ | ✅ | ❌ No restriction | No |

> **Proxy requirement**: Cloudflare Workers have dynamic IPs. Aligo requires fixed IP registration.
> Solapi has no IP restriction — simpler setup, no proxy needed.
> If you're starting fresh, Solapi is recommended for easier setup.

## Procedure

### Step 1 — Check Current State

```bash
echo "=== Current notification settings ==="

# Check DB for SMS config
npx wrangler d1 execute DB --local --command \
  "SELECT json_extract(integrations, '$.aligo.enabled') as aligo,
          json_extract(integrations, '$.solapi.enabled') as solapi,
          json_extract(integrations, '$.aligo.sender') as sender
   FROM clinics WHERE id = 1;" 2>/dev/null || echo "No config found"

# Check environment variables
echo ""
echo "Environment variables:"
grep -E "^(ALIGO|SOLAPI|SMS)" .dev.vars 2>/dev/null | cut -d'=' -f1 | \
  while read key; do echo "  ✅ $key"; done
test $? -ne 0 && echo "  (none configured)"
```

### Step 2 — Provider Selection

```
📱 SMS Provider Selection

Which SMS provider will you use?

[A] Aligo (알리고) — smartsms.aligo.in
    ✅ Established, widely used in Korean clinics
    ✅ AlimTalk (카카오 알림톡) support
    ⚠️ Requires proxy server (fixed IP restriction)
    💰 SMS ~20원, LMS ~50원, AlimTalk ~9원

[B] Solapi (솔라피) — solapi.com
    ✅ No IP restriction (no proxy needed)
    ✅ REST API, modern developer experience
    ✅ AlimTalk support
    💰 SMS ~20원, LMS ~50원, AlimTalk ~9원

[C] Already have an account — skip to credential entry

Select (A/B/C):
```

---

### Step 3A — Aligo 계정 생성 + 설정

#### 외부 서비스 설정 (원장님 작업)

```
🟡 Aligo 설정 — 외부 서비스 (원장님 작업)

━━━ 1단계: 알리고 가입 ━━━

1. https://smartsms.aligo.in 접속
2. [회원가입] → 사업자 정보 입력
   - 사업자등록번호, 대표자명, 업종
   - SMS 발송을 위한 본인 인증
3. 가입 완료 후 로그인

━━━ 2단계: 발신번호 등록 ━━━

SMS는 사전 등록된 번호에서만 발송 가능합니다.

1. [문자 보내기] > [발신번호 관리]
2. [발신번호 등록] 클릭
3. 한의원 대표 전화번호 입력 (예: 02-1234-5678)
4. 인증 방법 선택:
   - 통신서비스 이용증명원 업로드 (추천)
   - 또는 ARS 인증
5. 승인 대기 (보통 1~2 영업일)

━━━ 3단계: API Key 확인 ━━━

1. 로그인 후 [마이페이지] > [API 키 관리]
2. API Key 복사 → 아래 입력

   API Key:   [________________________________]
   User ID:   [________________________________] (알리고 아이디)
   발신번호:  [________________________________] (등록한 번호, -없이)

━━━ 4단계: 알림톡 (선택사항) ━━━

알림톡도 사용하시나요?

[예] → 아래 진행
[아니오] → 5단계로 건너뛰기

1. [알림톡] > [발신프로필 관리]
2. 카카오톡 채널 연동 → Sender Key 발급
3. Sender Key 복사:

   Sender Key: [________________________________]

━━━ 5단계: IP 등록 (프록시 사용 시) ━━━

⚠️ 알리고는 등록된 고정 IP에서만 API 호출을 허용합니다.
Clinic-OS는 Cloudflare Workers에서 동작하므로 프록시가 필요합니다.

프록시 서버가 있으신가요?

[있음] → 프록시 IP를 알리고에 등록:
  [마이페이지] > [API 키 관리] > [허용 IP] 에 프록시 IP 추가

[없음] → 두 가지 옵션:
  (a) 공유 프록시 사용 (위임 고객 대상, 요청)
  (b) 직접 설치: /guide/lightsail-proxy-setup 참조

프록시 URL: [________________________________]
  (예: https://sms.example.com/aligo/)
```

#### 내부 시스템 설정 (에이전트 작업)

```bash
# Store Aligo credentials
# Variables: ALIGO_KEY, ALIGO_USERID, ALIGO_SENDER, ALIGO_SENDERKEY, ALIGO_PROXY

npx wrangler d1 execute DB --local --command \
  "UPDATE clinics SET integrations = json_set(
    COALESCE(integrations, '{}'),
    '$.aligo.enabled', json('true'),
    '$.aligo.apiKey', '${ALIGO_KEY}',
    '$.aligo.userId', '${ALIGO_USERID}',
    '$.aligo.sender', '${ALIGO_SENDER}',
    '$.aligo.senderKey', '${ALIGO_SENDERKEY}',
    '$.aligo.baseUrl', '${ALIGO_PROXY}',
    '$.aligo.testmode_yn', 'N'
  ) WHERE id = 1;"

# Also store in environment for production
cat >> .dev.vars << EOF
ALIGO_API_KEY=${ALIGO_KEY}
ALIGO_USER_ID=${ALIGO_USERID}
ALIGO_SENDER=${ALIGO_SENDER}
ALIGO_TESTMODE=N
EOF

echo "✅ Aligo configuration saved"
echo ""
echo "For production secrets:"
echo "  wrangler secret put ALIGO_API_KEY"
echo "  wrangler secret put ALIGO_USER_ID"
echo "  wrangler secret put ALIGO_SENDER"
```

#### 연결 테스트

```bash
# Balance check (verifies API key + proxy + IP)
curl -s -X POST "http://localhost:4321/api/admin/settings/integrations" \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: ${ADMIN_API_KEY}" \
  -d '{"action": "test_aligo"}' 2>/dev/null

echo ""
echo "Success = API key valid + proxy working + IP registered"
echo ""
echo "📤 Send test SMS?"
echo "Enter your phone number (010xxxxxxxx):"
```

---

### Step 3B — Solapi 계정 생성 + 설정

#### 외부 서비스 설정 (원장님 작업)

```
🟢 Solapi 설정 — 외부 서비스 (원장님 작업)

━━━ 1단계: 솔라피 가입 ━━━

1. https://solapi.com 접속
2. [무료 시작하기] → 가입
   - 이메일 인증 + 사업자 정보 입력
3. 가입 완료 후 로그인

━━━ 2단계: 발신번호 등록 ━━━

1. [문자 보내기] > [발신번호 관리]
2. 한의원 대표 번호 등록
3. 인증 진행 (ARS 또는 서류)
4. 승인 대기

━━━ 3단계: API Key 발급 ━━━

1. 대시보드 > [개발/연동] > [API Key 관리]
2. [새 API Key 생성]
3. API Key와 API Secret 복사:

   API Key:    [________________________________]
   API Secret: [________________________________]
   발신번호:    [________________________________]

━━━ 4단계: 알림톡 (선택사항) ━━━

1. [알림톡] > [카카오 채널 연동]
2. Sender Key 발급
3. 템플릿 등록 + 카카오 심사
4. PFId (프로필 ID) 복사:

   PFId: [________________________________]

🎉 IP 제한 없음 — 프록시가 필요 없습니다!
```

#### 내부 시스템 설정 (에이전트 작업)

> **Docking point**: Solapi는 현재 clinic-os 코어에 내장되어 있지 않습니다.
> `src/lib/solapi.ts` 파일을 생성해야 합니다.

```bash
# Check if solapi module exists
ls src/lib/solapi.ts 2>/dev/null && echo "✅ Solapi module exists" || echo "⚠️ Solapi module needed"
```

**Solapi module docking specification:**

Solapi REST API v4를 사용합니다. `src/lib/aligo.ts`와 동일한 인터페이스를 구현합니다.

```
Required functions (same interface as aligo.ts):
  - sendSMS(config, to, message, options?) → { success, messageId, error? }
  - sendAlimTalk(config, to, templateCode, variables, options?) → { success, messageId, error? }
  - checkBalance(config) → { sms, lms, alimtalk }

Config shape (clinics.integrations.solapi):
  {
    enabled: boolean,
    apiKey: string,        // Solapi API Key
    apiSecret: string,     // Solapi API Secret
    sender: string,        // Registered sender number
    pfId: string,          // Kakao PFId (for AlimTalk)
  }

Solapi API Reference:
  Base URL: https://api.solapi.com
  Auth: HMAC-SHA256 signature (apiKey + apiSecret + timestamp + salt)
  Send: POST /messages/v4/send
  Balance: GET /cash/v1/balance
```

```bash
# Store Solapi credentials
npx wrangler d1 execute DB --local --command \
  "UPDATE clinics SET integrations = json_set(
    COALESCE(integrations, '{}'),
    '$.solapi.enabled', json('true'),
    '$.solapi.apiKey', '${SOLAPI_KEY}',
    '$.solapi.apiSecret', '${SOLAPI_SECRET}',
    '$.solapi.sender', '${SOLAPI_SENDER}',
    '$.solapi.pfId', '${SOLAPI_PFID}'
  ) WHERE id = 1;"

echo "✅ Solapi configuration saved"
```

---

### Step 4 — Template Configuration

Templates work the same regardless of SMS provider.

```bash
echo "=== Message Templates ==="

npx wrangler d1 execute DB --local --command \
  "SELECT template_id, name, channel FROM message_templates
   WHERE is_active = 1 ORDER BY sort_order;" 2>/dev/null
```

Default templates to configure:

| Template | Channel | Variables | Trigger |
|----------|---------|-----------|---------|
| 예약 확인 | SMS | patient_name, date, time | Reservation created |
| 예약 리마인더 | SMS | patient_name, time | 1 day before |
| 치료 완료 | AlimTalk | patient_name, next_date | Treatment done |
| 재방문 안내 | AlimTalk | patient_name, booking_url | 60 days inactive |

### Step 5 — Test Send

```bash
echo "📤 Sending test message..."
echo "Enter test phone number (010xxxxxxxx):"

# The send endpoint auto-detects the active provider (Aligo or Solapi)
curl -s -X POST "http://localhost:4321/api/admin/sms/send" \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: ${ADMIN_API_KEY}" \
  -d "{
    \"to\": \"${TEST_PHONE}\",
    \"message\": \"[${CLINIC_NAME}] Clinic-OS test message.\"
  }" 2>/dev/null

echo ""
echo "Check your phone. Did the message arrive?"
```

### Step 6 — Automation Rules

```
⚙️ Automation Rule Setup

Reservation-related:
  ☑️ Immediate confirmation on booking
  ☑️ Reminder 1 day before (10:00 AM)
  ☐ Reminder on appointment day (9:00 AM)

Treatment-related:
  ☑️ Satisfaction survey 1 hour after treatment
  ☐ Treatment effect check 7 days later
  ☑️ Revisit prompt after 60 days

Birthday/Anniversary:
  ☐ Birthday greeting
  ☐ First visit anniversary thank you

Select the rules to configure.
```

### Step 7 — Verification

```bash
echo "=== Notification Setup Complete ==="

# Detect active provider
npx wrangler d1 execute DB --local --command \
  "SELECT
    CASE
      WHEN json_extract(integrations, '$.aligo.enabled') = 1 THEN 'Aligo'
      WHEN json_extract(integrations, '$.solapi.enabled') = 1 THEN 'Solapi'
      ELSE 'Not configured'
    END as provider,
    json_extract(integrations, '$.aligo.sender') as aligo_sender,
    json_extract(integrations, '$.solapi.sender') as solapi_sender
  FROM clinics WHERE id = 1;"

# Template count
echo ""
npx wrangler d1 execute DB --local --command \
  "SELECT COUNT(*) as count FROM message_templates WHERE is_active = 1;"

# Recent sends
echo ""
npx wrangler d1 execute DB --local --command \
  "SELECT COUNT(*) as sent_count FROM message_logs
   WHERE created_at > strftime('%s', 'now', '-7 days');"
```

**Completion report:**
```
✅ Notification setup complete

📱 Provider: ${PROVIDER_NAME}
   Sender: ${SENDER_NUMBER}
   Balance: SMS ${SMS_COUNT} / LMS ${LMS_COUNT}

📝 Templates: ${TEMPLATE_COUNT} active
⚙️ Automation: ${RULE_COUNT} rules configured
🧪 Test: ${TEST_RESULT}

Next steps:
  → /setup-channels — Connect external lead channels (Kakao, Naver)
  → /onboarding — Return to onboarding
```

## Provider Abstraction — Docking Points

For developers adding a new SMS provider:

1. **Create provider module**: `src/lib/{provider}.ts`
   - Implement: `sendSMS()`, `sendAlimTalk()`, `checkBalance()`
   - Match the interface of `src/lib/aligo.ts`

2. **Add config schema**: `clinics.integrations.{provider}`
   - `enabled`, `apiKey`, `sender`, plus provider-specific fields

3. **Update send router**: The SMS send endpoint should check which provider is enabled:
   ```
   if (integrations.aligo?.enabled) → use aligo.ts
   else if (integrations.solapi?.enabled) → use solapi.ts
   ```

4. **Update admin UI**: `src/pages/admin/settings/integrations.astro`
   - Add provider selection dropdown
   - Show provider-specific credential fields

5. **Register in onboarding**: `.agent/onboarding-registry.json`
   - Feature: `sms-kakao-setup` already exists

## Integration

| Skill | Relationship |
|-------|-------------|
| `/setup-clinic-info` | Sender number comes from clinic profile |
| `/setup-channels` | External channels that generate leads → follow up via SMS |
| `/setup-intake` | Intake submission → confirmation SMS |
| `/patient-remind` | Patient reminder campaigns using templates |

## Triggers

- "문자 설정", "SMS", "알림톡", "알리고", "솔라피"
- "예약 확인 문자", "리마인더", "자동 발송"
- "notification", "sms setup"

## Safety

- API keys stored in DB (integrations JSON) and wrangler secrets
- Test mode available (testmode_yn = 'Y') — no actual sends
- Sender number must be pre-registered with provider (legal requirement)
- AlimTalk templates must pass Kakao review before use
- Balance monitoring recommended (low balance → sends fail silently)

## Onboarding State Sync

```bash
npm run onboarding:done -- --feature=sms-kakao-setup --note="setup-notifications completed"
```

> Skip silently if onboarding-state.json doesn't exist.

## All user-facing output in Korean.
