# /setup-notifications — Notification Channel Setup

> **Role**: Notification Channel Manager
> **Cognitive mode**: Channel-first setup. Select channel (SMS/Kakao) → configure credentials → set up templates → test → activate.

Configures SMS and Kakao notification channels and sets up message templates.
Connects patient communication channels and completes testing.

## When to Use

- Onboarding Tier 1 (Essential)
- When the clinic wants to send SMS notifications
- When integrating KakaoTalk notifications
- When setting up automatic reservation confirmations

## Prerequisites

- `/setup-clinic-info` completed (sender number/channel name)
- (SMS) Aligo account and API key issued
- (Kakao) Business channel created and verified

## Supported Channels

| Channel | Provider | Use Case |
|---------|----------|----------|
| SMS | Aligo | Reservation confirmation, reminders |
| Kakao Notification | Kakao Business | Treatment completion, revisit prompts |
| Kakao Friend Message | Kakao Business | Marketing, announcements |

## Procedure

### Step 1 — Check Current State

```bash
# Check existing notification settings
echo "=== Current notification settings ==="

# Check DB for notification config
npx wrangler d1 execute DB --local --command \
  "SELECT key, value FROM site_settings WHERE category='notifications';" 2>/dev/null || echo "No settings found"

# Check environment variables
echo ""
echo "Environment variables (wrangler.toml / .dev.vars):"
grep -E "(ALIGO|KAKAO)" .dev.vars 2>/dev/null || echo "No local env vars"
grep -E "(ALIGO|KAKAO)" wrangler.toml 2>/dev/null | head -5 || echo "Not in wrangler.toml"

# Check for notification service files
ls src/lib/notifications* 2>/dev/null || echo "Check notification service files"
```

### Step 2 — Channel Selection

```
📱 Notification Channel Selection

Current state: Not configured

[A] SMS (Aligo)
    - Reservation confirmation, reminders, announcements
    - Sender number pre-registration required
    - API key issuance required

[B] Kakao Notification
    - Treatment completion, revisit prompts
    - Business channel creation required
    - Template pre-review required

[C] Configure both

Select (A/B/C):
```

### Step 3 — SMS (Aligo) Configuration

**Credential Collection:**
```
📲 Aligo SMS Setup

Enter your API Key and sender number
from the Aligo site (smartsms.aligo.in).

API Key: [________________]
API Secret: [________________]
Sender Number: [________________]

* Only pre-registered sender numbers can be used.
```

**Store Credentials:**
```bash
# Store in local environment
cat >> .dev.vars << 'EOF'
ALIGO_API_KEY=your_api_key_here
ALIGO_API_SECRET=your_api_secret_here
ALIGO_SENDER=0212345678
EOF

echo "✅ Local env vars saved (.dev.vars)"

# For production, use wrangler secret
echo ""
echo "For production deploy, run:"
echo "  wrangler secret put ALIGO_API_KEY"
echo "  wrangler secret put ALIGO_API_SECRET"
echo "  wrangler secret put ALIGO_SENDER"
```

**Test Send:**
```bash
# Test API connectivity
echo "📤 Sending test message..."

curl -X POST "https://smartsms.aligo.in/send" \
  -d "key=${ALIGO_API_KEY}" \
  -d "user_id=your_aligo_id" \
  -d "sender=${ALIGO_SENDER}" \
  -d "receiver=01012345678" \
  -d "msg=Clinic-OS test message." 2>/dev/null

echo ""
echo "Please check if you received the test message."
```

### Step 4 — Kakao Business Configuration

**Credential Collection:**
```
💬 Kakao Business Setup

Enter your channel information
from Kakao Business (business.kakao.com).

Channel ID: [________________]
Access Token: [________________]
Channel Name: [________________]

* Notification templates require Kakao review/approval.
```

**Store Credentials:**
```bash
cat >> .dev.vars << 'EOF'
KAKAO_CHANNEL_ID=your_channel_id
KAKAO_ACCESS_TOKEN=your_access_token
KAKAO_CHANNEL_NAME=your_channel_name
EOF

echo "✅ Local env vars saved"
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
      "name": "Reservation Confirmation",
      "channel": "sms",
      "subject": "Reservation Confirmation",
      "content": "[Clinic] {patient_name}, your appointment on {appointment_date} at {appointment_time} is confirmed. Call us to reschedule. {clinic_phone}",
      "variables": ["patient_name", "appointment_date", "appointment_time", "clinic_phone"]
    },
    {
      "id": "reservation-reminder",
      "name": "Reservation Reminder",
      "channel": "sms",
      "content": "[Clinic] {patient_name}, you have an appointment tomorrow at {appointment_time}. Please arrive on time. {clinic_phone}",
      "variables": ["patient_name", "appointment_time", "clinic_phone"]
    },
    {
      "id": "treatment-complete",
      "name": "Treatment Completion",
      "channel": "kakao",
      "template_code": "TEMPLATE_CODE_HERE",
      "content": "{patient_name}, how was your treatment today? Your next appointment is {next_appointment}. Feel free to reach out with any questions.",
      "variables": ["patient_name", "next_appointment"]
    },
    {
      "id": "recall-60days",
      "name": "60-Day Revisit Prompt",
      "channel": "kakao",
      "content": "{patient_name}, it's been 60 days. How are you feeling? If you have any questions, please visit us. {booking_url}",
      "variables": ["patient_name", "booking_url"]
    }
  ]
}
EOF
)

echo "=== Notification templates ==="
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
  ('reservation-confirm', 'Reservation Confirmation', 'sms', 'Reservation Confirmation',
   '[Clinic] {patient_name}, your appointment on {appointment_date} at {appointment_time} is confirmed. Call us to reschedule. {clinic_phone}',
   '["patient_name", "appointment_date", "appointment_time", "clinic_phone"]'),
  ('reservation-reminder', 'Reservation Reminder', 'sms', 'Reservation Reminder',
   '[Clinic] {patient_name}, you have an appointment tomorrow at {appointment_time}. Please arrive on time. {clinic_phone}',
   '["patient_name", "appointment_time", "clinic_phone"]');
EOF

# Apply migration
npx wrangler d1 execute DB --local --file="migrations/${MIGRATION_NAME}"

echo "✅ Template tables created"
```

### Step 6 — Test Send

**SMS Test:**
```bash
echo ""
echo "📤 SMS test send"
echo "Enter the phone number to test:"
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
      \"patient_name\": \"Test\",
      \"appointment_date\": \"2026-04-01\",
      \"appointment_time\": \"14:00\",
      \"clinic_phone\": \"0212345678\"
    }
  }" 2>/dev/null

echo ""
echo "Did you receive the message? (yes/no):"
```

### Step 7 — Automation Rules

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
  ('Reservation Confirm', 'reservation_created', 'reservation-confirm', 'sms', 0),
  ('Reservation Reminder', 'reservation_reminder', 'reservation-reminder', 'sms', 0),
  ('Treatment Complete', 'treatment_completed', 'treatment-complete', 'kakao', 60);
EOF

npx wrangler d1 execute DB --local --file="migrations/${MIGRATION_NAME}"
```

### Step 8 — Verification

```bash
echo "=== Notification channel verification ==="

# Check DB tables
echo ""
echo "🗄️  DB tables:"
npx wrangler d1 execute DB --local --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%notification%';"

# Check templates
echo ""
echo "📝 Template list:"
npx wrangler d1 execute DB --local --command \
  "SELECT template_id, name, channel, is_active FROM notification_templates;"

# Check automation rules
echo ""
echo "⚙️  Automation rules:"
npx wrangler d1 execute DB --local --command \
  "SELECT name, trigger_event, template_id, is_active FROM notification_rules;"

# Check environment
echo ""
echo "🔐 Environment variables:"
grep -E "^(ALIGO|KAKAO)" .dev.vars 2>/dev/null | cut -d'=' -f1 | while read key; do
  echo "  ✅ $key configured"
done
```

**Completion report:**
```
✅ Notification channel setup complete

📱 Channels:
   SMS (Aligo): ${SMS_STATUS}
   Kakao Notification: ${KAKAO_STATUS}

📝 Templates:
   Reservation confirmation: ✅
   Reservation reminder: ✅
   Treatment completion: ✅
   60-day revisit: ✅

⚙️ Automation:
   Booking confirmation SMS: ✅
   1-day reminder: ✅
   Post-treatment satisfaction: ✅

🧪 Testing:
   SMS test: ${TEST_RESULT}

📊 View logs:
   Admin: /admin/notifications/logs

Next steps:
  → /setup-intake — Connect intake submission notifications
  → /onboarding — Proceed to next step
```

## Integration

| Skill | Relationship |
|-------|-------------|
| `/setup-intake` | Notification on intake submission |
| `/setup-programs` | Program reservation notifications |
| `/patient-remind` | Patient reminder campaigns |

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

- API keys managed via environment variables only
- Local: `.dev.vars` (gitignored)
- Production: Wrangler Secrets
- Phone number masking in logs recommended

## Onboarding State Sync

After notification channels are configured and tested, mark the onboarding feature as done.
This runs regardless of entry point (demo, delegated, onboarding, standalone).

```bash
npm run onboarding:done -- --feature=notifications --note="setup-notifications completed"
```

> Skip silently if onboarding-state.json doesn't exist.

## All user-facing output in Korean.
