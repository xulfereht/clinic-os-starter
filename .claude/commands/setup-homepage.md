# /setup-homepage — Custom Homepage Configuration

> **Role**: Homepage Builder
> **Cognitive mode**: Implement the homepage plan from site-plan.yaml into actual code and data.

Configures the homepage **first**. The tone established here becomes the baseline for subsequent program pages.

## Prerequisites

- `/plan-site` completed (`.agent/site-plan.yaml` exists)
- `/setup-clinic-info` completed (basic info)
- Images ready (`/curate-images` + `/enhance-portrait` + `/generate-scenes`)

## Procedure

### Step 1 — Preset selection + copy

```bash
# Check preset from site-plan.yaml
PRESET=$(cat .agent/site-plan.yaml | grep "preset:" | awk '{print $2}')

# Copy preset → activate
# Master repo:
cp src/plugins/custom-homepage/presets/${PRESET}.astro \
   src/plugins/custom-homepage/pages/index.astro

# Starter kit:
cp core/src/plugins/custom-homepage/presets/${PRESET}.astro \
   core/src/plugins/custom-homepage/pages/index.astro
```

### Step 2 — Content data modification

Modify the data object at the top of `index.astro` based on site-plan.yaml + style-card.yaml:

**Hero section:**
```javascript
const hero = {
  badge: "체형교정 전문 한의원",  // style-card.usps[0]
  title: "바른 체형, 건강한 삶",  // style-card.headlines[0]
  description: "...",
  cta: { text: "진료 상담 예약", href: "/intake" },
  backgroundImage: "/local/assets/enhanced/doctor-portrait-hero.png"
};
```

**Credentials section:**
```javascript
const credentials = [
  // From style-card.credentials, only those with actual images
  { image: "/local/assets/raw/certificate-01.jpg", holder: "원장 홍길동", description: "..." },
];
// Empty array → section auto-hides
```

**Narrative section:**
```javascript
const narrative = {
  steps: [
    { label: "문제", title: "이런 증상이 있으신가요?", description: "..." },
    { label: "치료", title: "근본 원인에 접근합니다", description: "..." },
    { label: "결과", title: "일상으로 돌아갑니다", description: "..." },
  ]
};
```

### Step 3 — Image placement

Place asset files in the correct locations:

```bash
# Master:
mkdir -p public/local/homepage/
cp public/local/assets/enhanced/* public/local/homepage/
cp public/local/assets/generated/* public/local/homepage/

# Starter kit:
mkdir -p core/public/local/homepage/
# ... same pattern
```

### Step 4 — Build + preview

```bash
npm run build
npm run dev
# Check http://localhost:4321 in browser
```

Show to user and collect feedback:
- "히어로 문구 어떤가요?"
- "이 이미지 괜찮은가요?"
- "섹션 순서 바꿀까요?"

### Step 5 — Iterative refinement

Reflect feedback by modifying data → build → verify cycle.
Only **data objects** change (not code), enabling rapid iteration.

### Step 6 — Completion report

```
🏠 홈페이지 구성 완료

프리셋: editorial
섹션: Hero → Highlights → Credentials → Narrative → Programs → DoctorIntro → Info

이 톤을 기준으로 각 프로그램 페이지를 구성합니다.

추천 다음 단계:
  → /setup-programs (홈페이지 톤 기반으로 프로그램 구성)
  → /setup-skin (스킨 적용)
```

## Cautions

- **Import paths**: Must use aliases (`@components/`, `@lib/`). No relative paths.
- **Starter kit**: All paths prefixed with `core/`.
- **Empty data = section hidden**: If credentials is an empty array, that section auto-hides.

## Triggers

- "홈페이지 만들어줘", "메인 페이지", "홈페이지 구성"
- "히어로 바꿔줘", "홈페이지 수정"

## All user-facing output in Korean.
