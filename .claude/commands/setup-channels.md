# /setup-channels — External Lead Channel Integration

> **Role**: Channel Integration Specialist
> **Cognitive mode**: Channel-by-channel setup. Select channel → guide external service config → connect to clinic-os → test → activate.

Connects external messaging and reservation channels to clinic-os lead management.
Each channel requires setup on both the external service and clinic-os side.

## When to Use

- Onboarding Tier 4 (Advanced) or standalone
- "카카오톡 연동하고 싶어요", "네이버 톡톡 연결", "네이버 예약 연동"
- "외부 채널 설정", "문의 채널 추가"
- After `/setup-intake` — extend lead capture beyond the website

## Prerequisites

- `/setup-clinic-info` completed (clinic name, phone)
- Domain deployed (webhook URLs require a live domain)
- Admin access to clinic-os

## Supported Channels

| Channel | External Service | Lead Type | Difficulty |
|---------|-----------------|-----------|------------|
| 카카오톡 상담 | Kakao i OpenBuilder | Real-time chat | ★★☆ |
| 네이버 톡톡 | Naver TalkTalk Partner | Real-time chat | ★★☆ |
| 네이버 예약 | Naver Reservation + CF Email | Reservation alert | ★★★ |

## Procedure

### Step 1 — Check Current State

```bash
echo "=== Current channel integrations ==="

# Check DB for integration config
npx wrangler d1 execute DB --local --command \
  "SELECT json_extract(integrations, '$.kakao.enabled') as kakao,
          json_extract(integrations, '$.naverTalk.enabled') as naver_talk
   FROM clinics WHERE id = 1;" 2>/dev/null || echo "No config found"

# Check webhook endpoints exist
echo ""
echo "Webhook endpoints:"
ls src/pages/api/kakao/webhook.ts 2>/dev/null && echo "  ✅ Kakao webhook" || echo "  ❌ Kakao webhook missing"
ls src/pages/api/webhook/naver-talktalk.ts 2>/dev/null && echo "  ✅ Naver TalkTalk webhook" || echo "  ❌ Naver TalkTalk webhook missing"
ls src/pages/api/webhooks/inbound-email.ts 2>/dev/null && echo "  ✅ Inbound email webhook" || echo "  ❌ Inbound email webhook missing"
```

### Step 2 — Channel Selection

```
📡 External Lead Channel Setup

Which channel would you like to connect?

[A] 카카오톡 상담 (Kakao Talk)
    - 환자가 카카오톡으로 문의 → 자동 리드 생성
    - 필요: 카카오 비즈니스 채널 + i OpenBuilder

[B] 네이버 톡톡 (Naver TalkTalk)
    - 네이버에서 톡톡 문의 → 자동 리드 생성
    - 필요: 네이버 톡톡 파트너센터 계정

[C] 네이버 예약 이메일 (Naver Reservation)
    - 네이버 예약 접수/변경/취소 → 자동 리드 생성
    - 필요: Cloudflare Email Routing 설정

[D] 전체 설정

Select (A/B/C/D):
```

---

### Step 3A — 카카오톡 상담 연동

#### 외부 서비스 설정 (카카오 측)

원장님이 직접 해야 하는 단계입니다. 에이전트가 안내합니다.

```
🟡 카카오톡 채널 설정 — 외부 서비스 (원장님 작업)

━━━ 1단계: 카카오 비즈니스 채널 ━━━

이미 카카오톡 채널이 있으신가요?

[있음] → 2단계로 이동
[없음] → 아래 순서대로 생성

1. https://business.kakao.com 접속 → 로그인
2. [채널 만들기] 클릭
3. 채널 정보 입력:
   - 채널 이름: {clinic_name} (예: 백록담한의원)
   - 프로필 사진: 한의원 로고
   - 카테고리: 의료 > 한의원
4. 채널 개설 완료 → 채널 URL 확인
   (예: http://pf.kakao.com/_xxxxx)

━━━ 2단계: 카카오 i OpenBuilder 설정 ━━━

1. https://i.kakao.com 접속 → 로그인
2. [봇 만들기] → 봇 이름 입력 (예: {clinic_name} 상담봇)
3. 좌측 메뉴 [시나리오] → [폴백 블록] 선택
4. [스킬 사용] 활성화 → [스킬 서버 설정]
5. 스킬 서버 URL 등록:

   📋 복사할 URL:
   https://{your_domain}/api/kakao/webhook

6. [배포] → [배포하기] 클릭
7. 봇 → 카카오톡 채널 연결:
   [설정] > [카카오톡 채널 연결] > 1단계에서 만든 채널 선택

✅ 완료 확인:
카카오톡에서 채널을 검색하고 메시지를 보내보세요.
자동 응답이 오면 외부 설정 완료입니다.
```

#### 내부 시스템 설정 (에이전트 작업)

```bash
# Enable Kakao integration in DB
npx wrangler d1 execute DB --local --command \
  "UPDATE clinics SET integrations = json_set(
    COALESCE(integrations, '{}'),
    '$.kakao.enabled', json('true')
  ) WHERE id = 1;"

echo "✅ Kakao integration enabled"
```

#### 연동 테스트

```bash
# Test webhook endpoint
DOMAIN=$(grep 'name =' wrangler.toml | head -1 | sed 's/.*= *"//' | sed 's/".*//')
echo "Testing webhook at: https://${DOMAIN}/api/kakao/webhook"

curl -s -o /dev/null -w "%{http_code}" \
  "https://${DOMAIN}/api/kakao/webhook" 2>/dev/null

echo ""
echo "200 = endpoint alive"
echo ""
echo "📱 Now send a test message from KakaoTalk to your channel."
echo "   Check admin > leads for the new entry."
```

---

### Step 3B — 네이버 톡톡 연동

#### 외부 서비스 설정 (네이버 측)

```
🟢 네이버 톡톡 설정 — 외부 서비스 (원장님 작업)

━━━ 1단계: 네이버 톡톡 파트너 가입 ━━━

1. https://partner.talk.naver.com 접속 → 네이버 아이디로 로그인
2. [서비스 등록] → 업체 정보 입력:
   - 업체명: {clinic_name}
   - 대표 전화번호: {clinic_phone}
   - 업종: 의료 > 한의원
3. 서비스 승인 대기 (보통 1~3 영업일)

━━━ 2단계: 챗봇 API 설정 ━━━

서비스 승인 후:

1. 파트너센터 > [챗봇 API] 메뉴
2. [이벤트 수신 URL] 에 아래 주소 입력:

   📋 복사할 URL:
   https://{your_domain}/api/webhook/naver-talktalk

3. [Authorization Token] 복사 → 아래에 붙여넣기
   (토큰은 파트너센터에서 자동 발급됩니다)

━━━ 3단계: 토큰 전달 ━━━

파트너센터에서 복사한 Authorization Token을 알려주세요:

Token: [________________________________]
```

#### 내부 시스템 설정 (에이전트 작업)

```bash
# Store Naver TalkTalk token (user provides the token)
NAVER_TOKEN="USER_PROVIDED_TOKEN"

npx wrangler d1 execute DB --local --command \
  "UPDATE clinics SET integrations = json_set(
    COALESCE(integrations, '{}'),
    '$.naverTalk.enabled', json('true'),
    '$.naverTalk.token', '${NAVER_TOKEN}'
  ) WHERE id = 1;"

echo "✅ Naver TalkTalk integration enabled"

# For production, also store as wrangler secret
echo ""
echo "For production, run:"
echo "  wrangler secret put NAVER_TALKTALK_TOKEN"
```

#### 연동 테스트

```bash
# Test via admin settings API
curl -s -X POST "http://localhost:4321/api/admin/settings/integrations" \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: ${ADMIN_API_KEY}" \
  -d '{"action": "test_naver_talk"}' 2>/dev/null

echo ""
echo "📱 Test: go to your Naver Place page and click '톡톡 문의'."
echo "   Send a test message and check admin > leads."
```

---

### Step 3C — 네이버 예약 이메일 연동

#### 외부 서비스 설정

```
🔵 네이버 예약 이메일 연동 — 설정 순서

이 채널은 네이버 예약 알림 이메일을 Cloudflare가 수신하여
자동으로 리드를 생성하는 방식입니다.

━━━ 1단계: 네이버 예약 서비스 확인 ━━━

네이버 예약을 이미 사용 중이신가요?

[사용 중] → 2단계로 이동
[미사용] → 네이버 예약 가입이 필요합니다:
  1. https://booking.naver.com/partner 접속
  2. 업체 등록 + 예약 상품 설정
  3. 예약 완료 후 2단계로 이동

━━━ 2단계: 수신 이메일 주소 설정 ━━━

네이버 예약 알림을 받을 이메일 주소를 정합니다.
이 주소로 오는 이메일이 자동으로 리드로 변환됩니다.

추천 주소: reservation@{your_domain}

네이버 예약 관리자에서:
1. [설정] > [알림 설정] > [이메일 알림]
2. 알림 수신 이메일을 위 주소로 변경

━━━ 3단계: Cloudflare Email Routing (원장님 또는 에이전트 작업) ━━━

1. Cloudflare Dashboard 접속 → 도메인 선택
2. [Email] > [Email Routing] 메뉴
3. [Routes] > [Create route]
   - Match: reservation@{your_domain}
   - Action: Worker
   - Worker: {your_worker_name}

   ⚠️ Worker가 선택지에 없으면:
   먼저 [Email Workers] 탭에서 worker를 등록하세요.

4. [Save] → DNS 레코드 자동 생성 확인
   (MX, TXT 레코드가 추가됩니다)

━━━ 4단계: 이메일 수신 핸들러 확인 ━━━

wrangler.toml에 email 트리거가 설정되어 있어야 합니다:
```

#### 내부 시스템 설정

```bash
# Verify wrangler.toml has email routing
grep -A2 "email" wrangler.toml 2>/dev/null || echo "⚠️ Email routing not in wrangler.toml"

# The inbound-email webhook handler is built into clinic-os core.
# No additional DB config needed — leads are auto-created from parsed emails.

echo ""
echo "✅ Email webhook handler: src/pages/api/webhooks/inbound-email.ts"
echo "✅ Naver email parser: src/lib/email/NaverParser.ts"
echo ""
echo "Parsed fields: 예약자명, 연락처, 상품명, 이용일시, 예약번호, 요청사항"
echo "Lead channel: 'naver_reservation'"
echo "Deduplication: by message ID or phone+timestamp hash"
```

#### 연동 테스트

```
📧 테스트 방법:

1. 네이버 예약에서 테스트 예약을 하나 생성합니다
   (본인 명의로 예약 → 이메일 알림 발송)
2. 1~2분 후 admin > leads에서 확인:
   - channel: naver_reservation
   - summary: [네이버예약] 상품명 - 요청사항
3. 취소 테스트: 같은 예약을 취소 → 리드 상태 업데이트 확인

⚠️ 이메일이 안 오는 경우:
- Cloudflare Email Routing 활성 상태 확인
- DNS MX 레코드 확인 (dig MX {your_domain})
- Worker 연결 확인 (Cloudflare > Email > Routing > Logs)
```

---

### Step 4 — Verification Summary

```bash
echo "=== Channel Integration Summary ==="
echo ""

# Check all channels
npx wrangler d1 execute DB --local --command \
  "SELECT
    json_extract(integrations, '$.kakao.enabled') as kakao,
    json_extract(integrations, '$.naverTalk.enabled') as naver_talk
  FROM clinics WHERE id = 1;"

echo ""
echo "Channel status:"

# Count leads by channel (last 30 days)
npx wrangler d1 execute DB --local --command \
  "SELECT channel, COUNT(*) as count
   FROM leads
   WHERE created_at > strftime('%s', 'now', '-30 days')
   GROUP BY channel
   ORDER BY count DESC;"
```

**Completion report:**
```
✅ External channel setup complete

📡 Channels:
   카카오톡 상담: ${KAKAO_STATUS}
   네이버 톡톡:   ${NAVER_TALK_STATUS}
   네이버 예약:   ${NAVER_RESERVATION_STATUS}

📥 Lead flow:
   External message → Webhook → Lead created → Admin notification
   Deduplication: 24h window per user per channel

🔗 Admin panel:
   /admin/leads — View all incoming leads
   /admin/settings/integrations — Toggle channels

Next steps:
  → /setup-notifications — Set up SMS/Kakao auto-reply
  → /onboarding — Return to onboarding
```

## Lead Lifecycle

All external channels follow the same pattern:

```
External Service → Webhook POST → Parse payload → Create lead
                                                 ↓
                                    Dedup check (24h window)
                                                 ↓
                                    Link to patient (if phone match)
                                                 ↓
                                    Admin notification (Slack if enabled)
```

Leads appear in admin > leads with:
- `channel`: kakao, naver_talk, naver_reservation
- `type`: chat, inquiry, consultation
- `intake_data`: JSON with source-specific metadata
- `patient_type`: new_lead (first contact) or returning (phone match)

## Integration

| Skill | Relationship |
|-------|-------------|
| `/setup-clinic-info` | Prerequisite — clinic name/phone used in auto-reply |
| `/setup-intake` | Website-based lead capture (complementary) |
| `/setup-notifications` | Auto-reply and follow-up messages |
| `/onboarding` | Parent flow — Tier 4 feature |

## Triggers

- "카카오톡 연동", "톡톡 연결", "네이버 예약 연동"
- "외부 채널", "리드 채널", "문의 채널 추가"
- "channel integration", "lead sources"

## Safety

- Kakao webhook must respond within 5 seconds (timeout = bot failure)
- Naver TalkTalk token stored in DB (encrypted at rest by D1)
- Email routing does not expose any credentials
- All external user data is stored as leads, not directly as patients
- Phone numbers are used only for returning patient matching

## Onboarding State Sync

```bash
npm run onboarding:done -- --feature=channel-integration --note="setup-channels completed"
```

> Skip silently if onboarding-state.json doesn't exist.

## All user-facing output in Korean.
