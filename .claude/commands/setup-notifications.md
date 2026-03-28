# /setup-notifications — 알림 채널 설정

> **Role**: Notification Channel Manager
> **Cognitive mode**: Channel-first setup. Select channel (SMS/Kakao) → configure credentials → set up templates → test → activate.

SMS 및 카카오 알림톡 채널을 설정하고 알림 템플릿을 구성합니다.
환자와의 소통 채널을 연결하고 테스트까지 완료합니다.

## When to Use

- Onboarding Tier 1 (Essential)
- "문자 알림을 보내고 싶어요"
- "카카오 알림톡을 연동하고 싶어요"
- "예약 확인 문자 자동 발송"

## Prerequisites

- `/setup-clinic-info` 완료 (발신번호/채널명)
- (SMS) Aligo 가입 및 API 키 발급
- (Kakao) 비즈니스 채널 생성 및 인증

## Supported Channels

| Channel | Provider | Use Case |
|---------|----------|----------|
| SMS | Aligo | 예약 확인, 리마인더 |
| Kakao 알림톡 | Kakao Business | 치료 완료, 재방문 유도 |
| Kakao 친구톡 | Kakao Business | 마케팅, 공지 |

## Procedure

### Step 1 — Check Current State

```bash
# Check existing notification settings
echo "=== 현재 알림 설정 확인 ==="

# Check DB for notification config
npx wrangler d1 execute DB --local --command \
  "SELECT key, value FROM site_settings WHERE category='notifications';" 2>/dev/null || echo "설정 없음"

# Check environment variables
echo ""
echo "환경 변수 (wrangler.toml / .dev.vars):"
grep -E "(ALIGO|KAKAO)" .dev.vars 2>/dev/null || echo "로컬 환경변수 없음"
grep -E "(ALIGO|KAKAO)" wrangler.toml 2>/dev/null | head -5 || echo "wrangler.toml에 없음"

# Check for notification service files
ls src/lib/notifications* 2>/dev/null || echo "알림 서비스 파일 확인 필요"
```

### Step 2 — Channel Selection

```
📱 알림 채널 선택

현재 상태: 미설정

[A] SMS (Aligo)
    - 예약 확인, 리마인더, 공지
    - 발신번호 사전등록 필요
    - API 키 발급 필요

[B] 카카오 알림톡
    - 치료 완료, 재방문 안내
    - 비즈니스 채널 생성 필요
    - 템플릿 사전 심사 필요

[C] 둘 다 설정

선택하세요 (A/B/C):
```

### Step 3 — SMS (Aligo) Configuration

**Credential Collection:**
```
📲 Aligo SMS 설정

Aligo 사이트 (smartsms.aligo.in)에서
API Key와 발신번호를 입력하세요.

API Key: [________________]
API Secret: [________________]
발신번호: [________________]

* 발신번호는 사전등록된 번호만 사용 가능합니다.
```

**Store Credentials:**
```bash
# Store in local environment
cat >> .dev.vars << 'EOF'
ALIGO_API_KEY=your_api_key_here
ALIGO_API_SECRET=your_api_secret_here
ALIGO_SENDER=0212345678
EOF

echo "✅ 로컬 환경변수 저장 완료 (.dev.vars)"

# For production, use wrangler secret
echo ""
echo "프로덕션 배포 시 실행:"
echo "  wrangler secret put ALIGO_API_KEY"
echo "  wrangler secret put ALIGO_API_SECRET"
echo "  wrangler secret put ALIGO_SENDER"
```

**Test Send:**
```bash
# Test API connectivity
echo "📤 테스트 발송..."

curl -X POST "https://smartsms.aligo.in/send" \
  -d "key=${ALIGO_API_KEY}" \
  -d "user_id=your_aligo_id" \
  -d "sender=${ALIGO_SENDER}" \
  -d "receiver=01012345678" \
  -d "msg=Clinic-OS 테스트 메시지입니다." 2>/dev/null

echo ""
echo "테스트 문자를 확인하세요."
```

### Step 4 — Kakao Business Configuration

**Credential Collection:**
```
💬 카카오 비즈니스 설정

Kakao Business (business.kakao.com)에서
채널 정보를 입력하세요.

채널 ID: [________________]
액세스 토큰: [________________]
채널 이름: [________________]

* 알림톡 템플릿은 카카오 심사가 필요합니다.
```

**Store Credentials:**
```bash
cat >> .dev.vars << 'EOF'
KAKAO_CHANNEL_ID=your_channel_id
KAKAO_ACCESS_TOKEN=your_access_token
KAKAO_CHANNEL_NAME=your_channel_name
EOF

echo "✅ 로컬 환경변수 저장 완료"
```

### Step 5 — Template Configuration

**Default Templates:**

```bash
# Create notification templates
TEMPLATES=$(cat << 'EOF'
{
  "templates": [
    {
      "id": "reservation-confirm",
      "name": "예약 확인",
      "channel": "sms",
      "subject": "예약 확인",
      "content": "[병원명] {patient_name}님, {appointment_date} {appointment_time} 예약이 확인되었습니다. 변경 시 전화주세요. {clinic_phone}",
      "variables": ["patient_name", "appointment_date", "appointment_time", "clinic_phone"]
    },
    {
      "id": "reservation-reminder",
      "name": "예약 리마인더",
      "channel": "sms",
      "content": "[병원명] {patient_name}님, 내일 {appointment_time} 예약되어 있습니다. 시간에 맞춰 방문해주세요. {clinic_phone}",
      "variables": ["patient_name", "appointment_time", "clinic_phone"]
    },
    {
      "id": "treatment-complete",
      "name": "치료 완료",
      "channel": "kakao",
      "template_code": "TEMPLATE_CODE_HERE",
      "content": "{patient_name}님, 오늘 치료 잘 받으셨나요? 다음 예약은 {next_appointment}입니다. 궁금한 점은 언제든 문의주세요.",
      "variables": ["patient_name", "next_appointment"]
    },
    {
      "id": "recall-60days",
      "name": "60일 재방문 유도",
      "channel": "kakao",
      "content": "{patient_name}님, 60일이 지났네요. 몸 상태는 어떠신가요? 궁금한 점이 있으시면 방문해주세요. {booking_url}",
      "variables": ["patient_name", "booking_url"]
    }
  ]
}
EOF
)

echo "=== 알림 템플릿 ==="
echo "$TEMPLATES" | python3 -m json.tool 2>/dev/null | head -60
```

**Store Templates in DB:**
```bash
# Create notification_templates table migration
MIGRATION_NAME="$(date +%Y%m%d)_notification_templates.sql"

cat > "migrations/${MIGRATION_NAME}" << 'EOF'
-- Notification Templates
CREATE TABLE IF NOT EXISTS notification_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL, -- 'sms', 'kakao'
  template_code TEXT, -- For Kakao template code
  subject TEXT,
  content TEXT NOT NULL,
  variables JSON, -- ["patient_name", "appointment_date", ...]
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notification Logs
CREATE TABLE IF NOT EXISTS notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id TEXT,
  patient_id INTEGER,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL, -- phone number
  content TEXT NOT NULL,
  status TEXT, -- 'sent', 'failed', 'pending'
  provider_response TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES notification_templates(template_id),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notif_template_id ON notification_templates(template_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_patient ON notification_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_sent ON notification_logs(sent_at);

-- Insert default templates
INSERT OR IGNORE INTO notification_templates (template_id, name, channel, subject, content, variables)
VALUES
  ('reservation-confirm', '예약 확인', 'sms', '예약 확인',
   '[병원명] {patient_name}님, {appointment_date} {appointment_time} 예약이 확인되었습니다. 변경 시 전화주세요. {clinic_phone}',
   '["patient_name", "appointment_date", "appointment_time", "clinic_phone"]'),
  ('reservation-reminder', '예약 리마인더', 'sms', '예약 알림',
   '[병원명] {patient_name}님, 내일 {appointment_time} 예약되어 있습니다. 시간에 맞춰 방문해주세요. {clinic_phone}',
   '["patient_name", "appointment_time", "clinic_phone"]');
EOF

# Apply migration
npx wrangler d1 execute DB --local --file="migrations/${MIGRATION_NAME}"

echo "✅ 템플릿 테이블 생성 완료"
```

### Step 6 — Test Send

**SMS Test:**
```bash
echo ""
echo "📤 SMS 테스트 발송"
echo "테스트할 전화번호를 입력하세요:"
read TEST_PHONE

# Call notification service
# This would typically be an API call
curl -X POST "http://localhost:4321/api/notifications/send" \
  -H "Content-Type: application/json" \
  -d "{
    \"channel\": \"sms\",
    \"template_id\": \"reservation-confirm\",
    \"recipient\": \"${TEST_PHONE}\",
    \"variables\": {
      \"patient_name\": \"테스트\",
      \"appointment_date\": \"2026-04-01\",
      \"appointment_time\": \"14:00\",
      \"clinic_phone\": \"0212345678\"
    }
  }" 2>/dev/null

echo ""
echo "문자를 받으셨나요? (예/아니오):"
```

### Step 7 — Automation Rules

```
⚙️ 자동 발송 규칙 설정

예약 관련:
  ☑️ 예약 완료 시 즉시 확인 문자
  ☑️ 예약 1일 전 리마인더 (오전 10시)
  ☐ 예약 당일 리마인더 (오전 9시)

치료 관련:
  ☑️ 치료 완료 후 1시간 만족도 조사
  ☐ 7일 후 치료 효과 확인 문자
  ☑️ 60일 후 재방문 유도

생일/기념일:
  ☐ 생일 축하 문자
  ☐ 첫 방문 1주년 감사 문자

설정할 규칙을 선택하세요.
```

**Store Rules:**
```bash
# Create automation rules table
cat >> "migrations/${MIGRATION_NAME}" << 'EOF'

-- Notification Automation Rules
CREATE TABLE IF NOT EXISTS notification_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL, -- 'reservation_created', 'treatment_completed', 'daily_cron'
  template_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  delay_minutes INTEGER DEFAULT 0,
  schedule_time TEXT, -- For daily cron: '10:00'
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES notification_templates(template_id)
);

-- Insert default rules
INSERT OR IGNORE INTO notification_rules (name, trigger_event, template_id, channel, delay_minutes)
VALUES
  ('예약 확인', 'reservation_created', 'reservation-confirm', 'sms', 0),
  ('예약 리마인더', 'reservation_reminder', 'reservation-reminder', 'sms', 0),
  ('치료 완료', 'treatment_completed', 'treatment-complete', 'kakao', 60);
EOF

npx wrangler d1 execute DB --local --file="migrations/${MIGRATION_NAME}"
```

### Step 8 — Verification

```bash
echo "=== 알림 채널 설정 검증 ==="

# Check DB tables
echo ""
echo "🗄️  DB 테이블:"
npx wrangler d1 execute DB --local --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%notification%';"

# Check templates
echo ""
echo "📝 템플릿 목록:"
npx wrangler d1 execute DB --local --command \
  "SELECT template_id, name, channel, is_active FROM notification_templates;"

# Check automation rules
echo ""
echo "⚙️  자동화 규칙:"
npx wrangler d1 execute DB --local --command \
  "SELECT name, trigger_event, template_id, is_active FROM notification_rules;"

# Check environment
echo ""
echo "🔐 환경 변수:"
grep -E "^(ALIGO|KAKAO)" .dev.vars 2>/dev/null | cut -d'=' -f1 | while read key; do
  echo "  ✅ $key 설정됨"
done
```

**완료 보고서:**
```
✅ 알림 채널 설정 완료

📱 채널:
   SMS (Aligo): ${SMS_STATUS}
   카카오 알림톡: ${KAKAO_STATUS}

📝 템플릿:
   예약 확인: ✅
   예약 리마인더: ✅
   치료 완료: ✅
   60일 재방문: ✅

⚙️ 자동화:
   예약 완료 시 확인 문자: ✅
   1일 전 리마인더: ✅
   치료 후 만족도: ✅

🧪 테스트:
   SMS 테스트: ${TEST_RESULT}

📊 로그 확인:
   관리자: /admin/notifications/logs

다음 단계:
  → /setup-intake — 문진 제출 알림 연동
  → /onboarding — 다음 단계 진행
```

## Integration

| Skill | Relationship |
|-------|-------------|
| `/setup-intake` | 문진 제출 시 알림 |
| `/setup-programs` | 프로그램 예약 알림 |
| `/patient-remind` | 환자 리마인더 캠페인 |

## API Endpoint Reference

```bash
# Send notification
POST /api/notifications/send
{
  "channel": "sms|kakao",
  "template_id": "reservation-confirm",
  "recipient": "01012345678",
  "variables": {
    "patient_name": "홍길동",
    "appointment_date": "2026-04-01"
  }
}

# Get templates
GET /api/notifications/templates

# Get logs
GET /api/notifications/logs?patient_id=123
```

## Triggers

- "문자 설정", "알림톡", "카카오 연동"
- "예약 문자", "리마인더", "자동 발송"
- "SMS", "notification"

## Safety

- API 키는 환경변수로만 관리
- 로컬: `.dev_VARS` (gitignored)
- 프로덕션: Wrangler Secrets
- 로그에 전화번호 마스킹 권장

## All user-facing output in Korean.
