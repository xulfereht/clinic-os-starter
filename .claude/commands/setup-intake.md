# /setup-intake — Intake Form Setup

> **Role**: Intake Form Manager
> **Cognitive mode**: Template-first configuration. Select appropriate template → customize questions → activate for patient use.

Configures the patient intake form for first-visit information collection.
Template selection → question configuration → DB storage → /intake page connection.

## When to Use

- Onboarding Tier 1 (Essential)
- When the clinic needs an online intake form
- When collecting patient information before first visits
- When setting up online pre-visit questionnaires

## Prerequisites

- `/setup-clinic-info` completed (clinic basic information)
- (Optional) `/setup-programs` — program-specific intake questions

## Templates Available

| Template | Questions | Best For |
|----------|-----------|----------|
| `basic-hanbang` | 15 | General Korean medicine clinic |
| `dermatology` | 20 | Dermatology |
| `diet` | 18 | Diet/obesity |
| `pain` | 12 | Pain clinic |
| `custom` | Custom | Special purpose |

## Procedure

### Step 1 — Check Current State

```bash
# Check if intake form already exists
npx wrangler d1 execute DB --local --command \
  "SELECT id, name, is_active FROM intake_forms;" 2>/dev/null

# Check /intake page
ls src/pages/intake.astro 2>/dev/null || echo "⚠️ /intake page not found"
ls src/pages/_local/intake.astro 2>/dev/null || echo "⚠️ No local override"
```

### Step 2 — Template Selection

```
📋 Intake Form Template Selection

Current state: No intake form

[A] Basic Korean Medicine Intake (15 questions)
    - Symptoms, duration, treatment history, lifestyle
    - Suitable for most Korean medicine clinics

[B] Dermatology Specialized (20 questions)
    - Skin type, allergies, cosmetics used
    - Affected area photo upload

[C] Diet Specialized (18 questions)
    - Eating habits, exercise, weight change history
    - Target weight, timeline

[D] Pain Clinic (12 questions)
    - Pain location, intensity, onset date
    - Pain-triggering movements

[E] Build from scratch

Select (A/B/C/D/E):
```

### Step 3 — Question Configuration

**Basic Hanbang Template Example:**

```bash
FORM_ID="basic-hanbang"
FORM_NAME="기본 한의원 문진"

cat > /tmp/intake_questions.json << 'EOF'
{
  "questions": [
    {
      "id": "chief_complaint",
      "type": "textarea",
      "label": "주증상",
      "question": "현재 가장 불편한 증상을 자세히 설명해주세요.",
      "required": true,
      "placeholder": "예) 허리가 2주 전부터 아프기 시작했어요. 앉아있을 때 특히 심해요."
    },
    {
      "id": "onset_date",
      "type": "date",
      "label": "증상 시작일",
      "question": "증상이 언제부터 시작되었나요?",
      "required": true
    },
    {
      "id": "pain_level",
      "type": "scale",
      "label": "통증 정도",
      "question": "현재 통증이 어느 정도인가요? (1-10)",
      "min": 1,
      "max": 10,
      "required": true
    },
    {
      "id": "previous_treatment",
      "type": "checkbox",
      "label": "과거 치료 이력",
      "question": "이전에 받은 치료를 선택해주세요. (중복 선택 가능)",
      "options": [
        { "value": "hospital", "label": "병원 치료" },
        { "value": "oriental", "label": "한의원 치료" },
        { "value": "physical", "label": "물리치료" },
        { "value": "chiropractic", "label": "카이로프랙틱" },
        { "value": "massage", "label": "마사지" },
        { "value": "none", "label": "없음" }
      ]
    },
    {
      "id": "current_medication",
      "type": "textarea",
      "label": "현재 복용 중인 약",
      "question": "현재 복용 중인 약이 있으면 알려주세요.",
      "required": false
    },
    {
      "id": "allergies",
      "type": "textarea",
      "label": "알레르기",
      "question": "알레르기가 있으면 알려주세요.",
      "required": false
    },
    {
      "id": "sleep_pattern",
      "type": "radio",
      "label": "수면 패턴",
      "question": "평소 수면은 어떠신가요?",
      "options": [
        { "value": "good", "label": "잘 자는 편" },
        { "value": "moderate", "label": "보통" },
        { "value": "poor", "label": "잘 못 자는 편" }
      ]
    },
    {
      "id": "appetite",
      "type": "radio",
      "label": "식욕",
      "question": "식욕은 어떠신가요?",
      "options": [
        { "value": "good", "label": "좋은 편" },
        { "value": "moderate", "label": "보통" },
        { "value": "poor", "label": "없는 편" }
      ]
    },
    {
      "id": "stress_level",
      "type": "scale",
      "label": "스트레스 정도",
      "question": "요즘 스트레스가 어느 정도인가요? (1-10)",
      "min": 1,
      "max": 10
    },
    {
      "id": "exercise",
      "type": "radio",
      "label": "운동",
      "question": "규칙적인 운동을 하나요?",
      "options": [
        { "value": "daily", "label": "매일" },
        { "value": "weekly", "label": "주 1-2회" },
        { "value": "rarely", "label": "거의 안 함" }
      ]
    }
  ]
}
EOF

echo "=== Intake form question configuration ==="
cat /tmp/intake_questions.json | python3 -m json.tool 2>/dev/null | head -50
```

**Customization Prompt:**
```
📋 Question Customization

Default configuration: 10 questions

Let me know if you want to modify:
- "Add pain-related questions"
- "Add female-only questions"
- "Remove allergy question"
- Reorder questions

Say "confirm" to proceed as-is.
```

### Step 4 — Database Setup

```bash
# Create intake_forms table migration
MIGRATION_NAME="$(date +%Y%m%d)_intake_forms.sql"

cat > "migrations/${MIGRATION_NAME}" << 'EOF'
-- Intake Forms
CREATE TABLE IF NOT EXISTS intake_forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  questions JSON NOT NULL,
  is_active INTEGER DEFAULT 1,
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Intake Responses
CREATE TABLE IF NOT EXISTS intake_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id INTEGER NOT NULL,
  patient_id INTEGER,
  -- Patient info (if not registered)
  temp_name TEXT,
  temp_phone TEXT,
  temp_email TEXT,
  -- Response data
  responses JSON NOT NULL,
  -- Status
  status TEXT DEFAULT 'pending', -- pending, reviewed, completed
  notes TEXT, -- Staff notes
  -- Metadata
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  reviewed_by INTEGER,
  FOREIGN KEY (form_id) REFERENCES intake_forms(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (reviewed_by) REFERENCES staff(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_intake_form_active ON intake_forms(is_active);
CREATE INDEX IF NOT EXISTS idx_intake_response_form ON intake_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_intake_response_patient ON intake_responses(patient_id);
CREATE INDEX IF NOT EXISTS idx_intake_response_status ON intake_responses(status);
CREATE INDEX IF NOT EXISTS idx_intake_response_submitted ON intake_responses(submitted_at);

-- Insert default form
INSERT OR IGNORE INTO intake_forms (slug, name, description, questions, is_active, is_default)
VALUES (
  'basic-hanbang',
  '기본 한의원 문진',
  '한의원 초진 환자를 위한 기본 문진표',
  '[...questions JSON...]',
  1,
  1
);
EOF

echo "=== Migration file created ==="
cat "migrations/${MIGRATION_NAME}"
```

**Apply Migration:**
```bash
# Apply to local DB
npx wrangler d1 execute DB --local --file="migrations/${MIGRATION_NAME}"

echo "✅ Migration applied"
```

**Insert Form Data:**
```bash
# Insert the form with questions
QUESTIONS_JSON=$(cat /tmp/intake_questions.json | jq -c '.questions')

npx wrangler d1 execute DB --local --command \
  "INSERT OR REPLACE INTO intake_forms (slug, name, description, questions, is_active, is_default)
   VALUES ('${FORM_ID}', '${FORM_NAME}', 'Clinic-OS auto-generated intake form', '${QUESTIONS_JSON}', 1, 1);"
```

### Step 5 — Page Setup

```bash
# Check if /intake page exists
if [ ! -f "src/pages/_local/intake.astro" ]; then
  echo "Creating /intake page..."

  mkdir -p src/pages/_local

  cat > src/pages/_local/intake.astro << 'EOF'
---
import BaseLayout from '@components/layout/BaseLayout.astro';
import IntakeForm from '@components/intake/IntakeForm.astro';
import { getDefaultIntakeForm } from '@lib/intake';

const form = await getDefaultIntakeForm();
---

<BaseLayout title="사전 문진">
  <div class="min-h-screen bg-gray-50 py-12">
    <div class="max-w-2xl mx-auto px-4">
      <div class="bg-white rounded-lg shadow p-8">
        <h1 class="text-2xl font-bold text-center mb-2">사전 문진</h1>
        <p class="text-gray-600 text-center mb-8">
          첫 방문을 환영합니다. 아래 내용을 작성해주세요.
        </p>

        {form ? (
          <IntakeForm form={form} />
        ) : (
          <div class="text-center text-gray-500 py-8">
            문진표를 준비 중입니다. 잠시 후 다시 시도해주세요.
          </div>
        )}
      </div>
    </div>
  </div>
</BaseLayout>
EOF

  echo "✅ /intake page created"
else
  echo "✅ /intake page already exists"
fi
```

### Step 6 — Link from Reservation

```bash
# Check reservation flow
echo "Checking reservation flow for intake link..."

# Typically added to:
# - Reservation confirmation page
# - Reservation completion email
# - SMS confirmation

echo ""
echo "Recommended integration points:"
echo "  1. Reservation completion page — 'Please fill out the intake form at /intake'"
echo "  2. Reservation confirmation SMS — include intake URL"
echo "  3. Reservation confirmation email — intake CTA button"
```

### Step 7 — Verification

```bash
echo "=== Intake form setup verification ==="

# Check form in DB
echo ""
echo "📋 DB registration status:"
npx wrangler d1 execute DB --local --command \
  "SELECT id, slug, name, is_active, is_default FROM intake_forms;"

# Check questions count
echo ""
echo "📝 Question count:"
npx wrangler d1 execute DB --local --command \
  "SELECT slug, json_array_length(questions) as question_count FROM intake_forms;"

# Check page
echo ""
echo "📄 Page status:"
ls -la src/pages/_local/intake.astro 2>/dev/null || ls -la src/pages/intake.astro 2>/dev/null

echo ""
echo "🔗 Access URL:"
echo "  Local: http://localhost:4321/intake"
```

**Completion report:**
```
✅ Intake form setup complete

📋 Form info:
   ID: ${FORM_ID}
   Name: ${FORM_NAME}
   Questions: ${QUESTION_COUNT}

🗄️ Database:
   Tables: intake_forms, intake_responses
   Status: Active

📄 Page:
   URL: /intake
   File: src/pages/_local/intake.astro

📊 View submissions:
   Admin: /admin/intake (or /admin/responses)

🔗 Reservation integration:
   Include the intake URL when confirming reservations.

Next steps:
  → /setup-notifications — Set up intake submission notifications
  → /onboarding — Proceed to next step
```

## Question Types Reference

```json
{
  "text": "Single-line text",
  "textarea": "Multi-line text",
  "number": "Number",
  "date": "Date",
  "radio": "Single selection",
  "checkbox": "Multiple selection",
  "select": "Dropdown",
  "scale": "Scale (1-5, 1-10)",
  "file": "File upload"
}
```

## Integration

| Skill | Relationship |
|-------|-------------|
| `/setup-notifications` | Notification on intake submission |
| `/setup-programs` | Program-specific intake forms |
| `/onboarding` | Tier 1 "intake-form" step |

## Triggers

- "문진표", "초진", "사전 문진"
- "환자 정보 입력", "온라인 문진"
- "intake form", "questionnaire"

## Safety

- DB migrations are stored in `migrations/`
- Pages are created in `src/pages/_local/` (protected from core:pull)
- Existing response data is preserved

## Onboarding State Sync

After intake form is created and activated, mark the onboarding feature as done.
This runs regardless of entry point (demo, delegated, onboarding, standalone).

```bash
npm run onboarding:done -- --feature=intake-setup --note="setup-intake completed"
```

> Skip silently if onboarding-state.json doesn't exist.

## All user-facing output in Korean.
