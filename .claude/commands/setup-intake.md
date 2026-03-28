# /setup-intake — 문진표 설정

> **Role**: Intake Form Manager
> **Cognitive mode**: Template-first configuration. Select appropriate template → customize questions → activate for patient use.

환자 첫 방문 시 정보 수집을 위한 문진표를 설정합니다.
템플릿 선택 → 질문 구성 → DB 저장 → /intake 페이지 연결까지 진행합니다.

## When to Use

- Onboarding Tier 1 (Essential)
- "문진표를 만들고 싶어요"
- "초진 환자 정보를 입력받고 싶어요"
- "온라인 사전 문진"

## Prerequisites

- `/setup-clinic-info` 완료 (병원 기본 정보)
- (선택) `/setup-programs` — 진료 프로그램별 특화 문진

## Templates Available

| Template | Questions | Best For |
|----------|-----------|----------|
| `basic-hanbang` | 15개 | 일반 한의원 |
| `dermatology` | 20개 | 피부과 |
| `diet` | 18개 | 다이어트/비만 |
| `pain` | 12개 | 통증 클리닉 |
| `custom` | 직접 구성 | 특수 목적 |

## Procedure

### Step 1 — Check Current State

```bash
# Check if intake form already exists
npx wrangler d1 execute DB --local --command \
  "SELECT id, name, is_active FROM intake_forms;" 2>/dev/null

# Check /intake page
ls src/pages/intake.astro 2>/dev/null || echo "⚠️ /intake 페이지 없음"
ls src/pages/_local/intake.astro 2>/dev/null || echo "⚠️ 로컬 오버라이드 없음"
```

### Step 2 — Template Selection

```
📋 문진표 템플릿 선택

현재 상태: 문진표 없음

[A] 기본 한의원 문진 (15개 질문)
    - 증상, 기간, 과거치료력, 생활습관
    - 대부분의 한의원에 적합

[B] 피부과 특화 문진 (20개 질문)
    - 피부 타입, 알레르기, 사용 화장품
    - 트러블 부위 사진 업로드

[C] 다이어트 특화 문진 (18개 질문)
    - 식습관, 운동, 체중 변화 이력
    - 목표 체중, 시기

[D] 통증 클리닉 문진 (12개 질문)
    - 통증 부위, 강도, 시작 시기
    - 통증 유발 동작

[E] 처음부터 직접 구성

선택하세요 (A/B/C/D/E):
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

echo "=== 문진표 질문 구성 ==="
cat /tmp/intake_questions.json | python3 -m json.tool 2>/dev/null | head -50
```

**Customization Prompt:**
```
📋 질문 커스터마이징

기본 구성: 10개 질문

수정할 항목이 있으면 말씀해주세요:
- "통증 관련 질문 추가"
- "여성-only 질문 추가"
- "알레르기 질문 삭제"
- 질문 순서 변경

그대로 진행하려면 "확인"이라고 해주세요.
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

echo "=== 마이그레이션 파일 생성 ==="
cat "migrations/${MIGRATION_NAME}"
```

**Apply Migration:**
```bash
# Apply to local DB
npx wrangler d1 execute DB --local --file="migrations/${MIGRATION_NAME}"

echo "✅ 마이그레이션 적용 완료"
```

**Insert Form Data:**
```bash
# Insert the form with questions
QUESTIONS_JSON=$(cat /tmp/intake_questions.json | jq -c '.questions')

npx wrangler d1 execute DB --local --command \
  "INSERT OR REPLACE INTO intake_forms (slug, name, description, questions, is_active, is_default)
   VALUES ('${FORM_ID}', '${FORM_NAME}', 'Clinic-OS 자동 생성 문진', '${QUESTIONS_JSON}', 1, 1);"
```

### Step 5 — Page Setup

```bash
# Check if /intake page exists
if [ ! -f "src/pages/_local/intake.astro" ]; then
  echo "/intake 페이지를 생성합니다..."

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

  echo "✅ /intake 페이지 생성 완료"
else
  echo "✅ /intake 페이지 이미 존재"
fi
```

### Step 6 — Link from Reservation

```bash
# Check reservation flow
echo "예약 플로우에 문진 링크 추가 확인..."

# Typically added to:
# - Reservation confirmation page
# - Reservation completion email
# - SMS confirmation

echo ""
echo "추천 연동 지점:"
echo "  1. 예약 완료 페이지 — '/intake에서 사전 문진을 작성해주세요'"
echo "  2. 예약 확인 문자 — 문진 URL 포함"
echo "  3. 예약 확인 메일 — 문진 CTA 버튼"
```

### Step 7 — Verification

```bash
echo "=== 문진표 설정 검증 ==="

# Check form in DB
echo ""
echo "📋 DB 등록 상태:"
npx wrangler d1 execute DB --local --command \
  "SELECT id, slug, name, is_active, is_default FROM intake_forms;"

# Check questions count
echo ""
echo "📝 질문 수:"
npx wrangler d1 execute DB --local --command \
  "SELECT slug, json_array_length(questions) as question_count FROM intake_forms;"

# Check page
echo ""
echo "📄 페이지 상태:"
ls -la src/pages/_local/intake.astro 2>/dev/null || ls -la src/pages/intake.astro 2>/dev/null

echo ""
echo "🔗 접속 URL:"
echo "  로컬: http://localhost:4321/intake"
```

**완료 보고서:**
```
✅ 문진표 설정 완료

📋 문진표 정보:
   ID: ${FORM_ID}
   이름: ${FORM_NAME}
   질문 수: ${QUESTION_COUNT}개

🗄️ 데이터베이스:
   테이블: intake_forms, intake_responses
   상태: 활성화

📄 페이지:
   URL: /intake
   파일: src/pages/_local/intake.astro

📊 제출된 문진 확인:
   관리자: /admin/intake (또는 /admin/responses)

🔗 예약 연동:
   예약 완료 시 문진 URL을 함께 안내하세요.

다음 단계:
  → /setup-notifications — 문진 제출 알림 설정
  → /onboarding — 다음 단계 진행
```

## Question Types Reference

```json
{
  "text": "단일 줄 텍스트",
  "textarea": "여러 줄 텍스트",
  "number": "숫자",
  "date": "날짜",
  "radio": "단일 선택",
  "checkbox": "다중 선택",
  "select": "드롭다운",
  "scale": "척도 (1-5, 1-10)",
  "file": "파일 업로드"
}
```

## Integration

| Skill | Relationship |
|-------|-------------|
| `/setup-notifications` | 문진 제출 시 알림 설정 |
| `/setup-programs` | 프로그램별 특화 문진 |
| `/onboarding` | Tier 1 "intake-form" 단계 |

## Triggers

- "문진표", "초진", "사전 문진"
- "환자 정보 입력", "온라인 문진"
- "intake form", "questionnaire"

## Safety

- DB 마이그레이션은 `migrations/`에 저장
- 페이지는 `src/pages/_local/`에 생성 (core:pull 보호)
- 기존 응답 데이터는 보존

## All user-facing output in Korean.
