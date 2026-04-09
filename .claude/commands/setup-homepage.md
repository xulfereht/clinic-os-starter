# /setup-homepage — Custom Homepage Configuration

> **Role**: Homepage Builder
> **Cognitive mode**: Implement the homepage plan from site-plan.yaml into actual code and data.

Configures the homepage **first**. The tone established here becomes the baseline for subsequent program pages.

## When to Use

- After `/plan-content` creates site-plan.yaml — homepage build step
- Onboarding Tier 2 — homepage configuration
- Redesign request — changing homepage layout or content
- After content pipeline completes — apply planned content to homepage

## Prerequisites

- `/plan-content` completed (`.agent/site-plan.yaml` exists)
- `/setup-clinic-info` completed (basic info)
- Images ready (`/curate-images` + `/enhance-portrait` + `/generate-scenes`)
- `.agent/pipeline-context.yaml` — pipeline state and data quality
- `.agent/references.yaml` — design references (if collected)
- `.agent/site-plan.yaml` readiness block — which sections to include/skip
- **`docs/SECTION_SCHEMAS.md`** — **MUST READ** for section JSON schema when using SectionRenderer-based presets (classic). Canonical Props reference for all section components.

## Procedure

### Step 1 — Preset selection + copy

**Available presets:**

| Preset | Style | Recommended Skin | Best For |
|--------|-------|-----------------|----------|
| `classic` | SectionRenderer, carousel hero | clinicLight | Standard clinics, simple branding |
| `editorial` | Magazine-style, fullscreen hero | editorialCalm | Premium branding, credentials-heavy |

```bash
# Check preset from site-plan.yaml
PRESET=$(cat .agent/site-plan.yaml | grep "preset:" | awk '{print $2}')

# Pipeline context and references
cat .agent/pipeline-context.yaml 2>/dev/null
cat .agent/references.yaml 2>/dev/null

# Validate preset file exists
PRESET_DIR="src/plugins/custom-homepage/presets"
[ -f "${PRESET_DIR}/${PRESET}.astro" ] || { echo "ERROR: preset '${PRESET}' not found"; exit 1; }

# Copy to LOCAL path (core:pull 보호됨)
# Master repo:
mkdir -p src/plugins/local/custom-homepage/pages
cp ${PRESET_DIR}/${PRESET}.astro src/plugins/local/custom-homepage/pages/index.astro

# Starter kit:
mkdir -p core/src/plugins/local/custom-homepage/pages
cp core/${PRESET_DIR}/${PRESET}.astro core/src/plugins/local/custom-homepage/pages/index.astro
```

> **Why local/?** `src/plugins/local/` is protected from core:pull.
> The plugin-loader automatically prefers `local/custom-homepage/` over `custom-homepage/`.
> Core presets are read-only templates; your customized copy lives in local/.

**After copying, recommend matching skin:**
- `editorial` → `/setup-skin editorialCalm`
- `classic` → `/setup-skin clinicLight`

### Step 2 — Readiness check

**Readiness check** (from site-plan.yaml):

Read the `readiness` block from `.agent/site-plan.yaml`. For each section:
- `ready` → populate with data from site-plan + edge-profile + style-card
- `skip` → leave the data array empty (section auto-hides when empty)
- `blocked` → warn user: "⚠️ {section} 섹션에 필요한 데이터가 없습니다: {reason}. (1) 데이터 제공 (2) 섹션 스킵"
- `partial` → populate what's available, add TODO comment for missing parts

If `pipeline-context.yaml` shows `extraction.sufficiency.overall: "needs-supplement"`:
  Add a note: "⚠️ 데이터가 충분하지 않아 일부 섹션이 일반적인 내용일 수 있습니다. 나중에 /write-copy로 보강할 수 있습니다."

### Step 3 — Content data modification

Modify the data object at the top of `index.astro` based on site-plan.yaml + style-card.yaml:

**Hero section:**
```javascript
const hero = {
  badge: "체형교정 전문 한의원",  // style-card.usps[0]
  title: "바른 체형, 건강한 삶",  // style-card.headlines[0]
  description: "...",
  cta: { text: "진료 상담 예약", href: "/intake" },
  backgroundImage: "/local/homepage/hero-bg.jpg"
};
```

**Credentials section:**
```javascript
const credentials = [
  // From style-card.credentials, only those with actual images
  { image: "/local/homepage/credentials/cert-1.jpg", holder: "원장 홍길동", description: "..." },
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

### Step 4 — Image placement

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

### Step 5 — Build + preview

```bash
npm run build
npm run dev
# Check http://localhost:4321 in browser
```

Show to user and collect feedback:
- "히어로 문구 어떤가요?"
- "이 이미지 괜찮은가요?"
- "섹션 순서 바꿀까요?"

### Step 6 — Iterative refinement

Reflect feedback by modifying data → build → verify cycle.
Only **data objects** change (not code), enabling rapid iteration.

### Step 7 — Onboarding state sync

After successful build (Step 5), mark the onboarding feature as done.
This runs regardless of entry point (demo, delegated, onboarding, standalone).

```bash
npm run onboarding:done -- --feature=homepage-setup --note="setup-homepage 완료"
```

> Skip silently if onboarding-state.json doesn't exist.

### Step 8 — Completion report

```
🏠 홈페이지 구성 완료

프리셋: editorial
섹션: Hero → Highlights → Credentials → Narrative → Programs → DoctorIntro → Info

이 톤을 기준으로 각 프로그램 페이지를 구성합니다.

Recommended next steps:
  → /setup-programs (홈페이지 톤 기반으로 프로그램 구성)
  → /setup-skin (스킨 적용)
```

## Homepage Override Chain (critical — understand before modifying)

The homepage has a 3-layer override system. **Only one layer renders per request:**

```
1. Plugin Override (HIGHEST) — custom-homepage plugin enabled in plugin_status
   → renders src/plugins/local/custom-homepage/pages/index.astro
   → completely replaces core homepage
   → DB page_translations sections loaded inside the plugin

2. DB page_translations (MEDIUM) — sections stored in database
   → renders via SectionRenderer with skin styling
   → force-override block SKIPPED (sectionsFromDB guard)

3. Inline Fallback (LOWEST) — hardcoded in index.astro
   → only when no DB sections exist
   → force-override block applies (repositions bridge, narrative)
```

**Before modifying homepage, always check:**
```sql
-- Is custom-homepage plugin enabled?
SELECT enabled FROM plugin_status WHERE plugin_id='custom-homepage';
-- If enabled=1 → modify the PLUGIN file, not core pages

-- Are DB sections set?
SELECT sections FROM page_translations WHERE page_id='home-page' AND locale='ko' AND status='published';
-- If sections exist → modify DB data, not inline code
```

**Common pitfall:** Editing `src/pages/index.astro` has no effect when plugin is enabled.

## Skin Activation Prerequisite

For skin components to render (custom Hero, section overrides):
```sql
-- skinSystemVersion must be >= 2
SELECT value FROM clinic_settings WHERE key='theme';
-- Check: theme.skinSystemVersion >= 2 OR theme.skinActivatedAt exists
```

If `advancedSkinEnabled = false`:
- Skin CSS variables still apply (colors, fonts)
- But skin **component overrides** are ignored (custom Hero, section layouts)
- This means installing a skin ≠ fully activating it

**To activate:** `/setup-skin` sets `skinSystemVersion: 2` and `skinActivatedAt` automatically.

## Cautions

- **Import paths**: Must use aliases (`@components/`, `@lib/`). No relative paths.
- **Starter kit**: All paths prefixed with `core/`.
- **Empty data = section hidden**: If credentials is an empty array, that section auto-hides.
- **Plugin + _local/ coexistence**: Plugin override is checked at runtime. `_local/index.astro` is resolved at build time. If both exist, plugin wins.

## Triggers

- "홈페이지 만들어줘", "메인 페이지", "홈페이지 구성"
- "히어로 바꿔줘", "홈페이지 수정"

## Pipeline Context Update

Update `.agent/pipeline-context.yaml`:
```yaml
homepage:
  preset_applied: ""
  sections_populated: {N}
  sections_skipped: []
  completed_at: "{ISO date}"
```

## Auto-trigger: UX Review

After homepage setup completes and build passes, automatically run `/review-ux` to verify:
- Hero section text readability over background
- CTA button contrast and visibility
- Mobile responsive layout
- Section rendering (no broken images or empty sections)

## All user-facing output in Korean.
