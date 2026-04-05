# /dev-skin — Skin Development Partner

> **Role**: Design System Architect
> **Cognitive mode**: Brand-first co-creation. Clinic personality → design tokens → skin manifest → DB activation.
> **Philosophy**: Agent as Producer — the agent structures, the clinic owner decides the aesthetic.

The **only primary production path** for custom skins. Brand analysis → colors/typography → manifest + skin.css generation → DB activation in one shot.
The admin UI (`/admin/design`) is for "selection/fine-tuning only" — new skin creation is only possible through this skill.

## When to Use

- Onboarding Tier 4 (Experience) — "our own clinic design"
- "I want to create a skin" / "Change to our brand colors"
- When the 9 built-in skins are not enough
- During rebranding/redesign

## Prerequisites

- `/setup-clinic-info` recommended (clinic characteristics)
- `/analyze-content` recommended (tone & manner)

## Guardrail Flow (4 Phases)

### Phase 1 — Brand Context

```
🎨 한의원 스킨을 함께 만들어보겠습니다.

몇 가지 여쭤볼게요:

1. What is the clinic's atmosphere?
   (e.g., modern, traditional, premium, friendly, nature/healing)

2. Target patient demographic?
   (e.g., office workers, families, seniors, women, students)

3. Do you have brand colors?
   (Logo colors, CI colors — if not, we'll decide together)

4. Which existing skin is closest?
   - clinicLight (bright and clean)
   - wellnessWarm (warm wellness)
   - editorialCalm (magazine-style calm)
   - hanbangClassic (traditional Korean medicine)
   - forestTherapy (forest/healing)
   - None (completely new)

5. Should the report (test result) style match too?
```

### Phase 2 — Design (Agent + Clinician)

The agent proposes a draft and the clinic owner reviews.

```
📋 Design draft for review.

[Skin name]: {skin_name}
[Base]: inherits from {base_skin}
[Mode]: light / dark

--- Colors ---
  Primary:   {primary} ████
  Accent:    {accent}  ████
  Surface:   {surface}
  Text:      {text}

--- Typography ---
  Heading: {heading_font}
  Body:    {body_font}

--- Section Styles ---
  Hero:     {tone} / {cardStyle}
  Solution: {tone}
  Pricing:  {tone}

Any modifications needed?
- "Make colors warmer" → adjust accent
- "Switch to serif font" → switch to serif family
- "Looks good, proceed"
```

### Phase 3 — Generate + Activate (Automated)

When the clinic owner says "Looks good, proceed":

**3.1. Determine Skin ID**
```
Rule: kebab-case, English
Example: baekrokdam-warm, modern-blue-clinic
```

**3.2. Generate skin.css** (filename must be `skin.css`)

```css
/* src/skins/local/{id}/skin.css */
:root {
  --skin-hero-glow: {glow_color};
  --skin-panel-border: {border_style};
  --skin-band: {band_gradient};
  /* ... skin-specific custom variables ... */
}
```

**3.3. Generate manifest.json**

```json
{
  "id": "{skin_id}",
  "name": "{display_name}",
  "version": "1.0.0",
  "description": "{description}",
  "author": "clinic-local",
  "source": "local",
  "status": "ready",
  "extends": "{base_skin}",
  "defaults": {
    "skin": "{skin_id}",
    "brandHue": "{hue}",
    "rounding": "md",
    "density": "normal",
    "mode": "light"
  },
  "tokens": {
    "bgBody": "{bg}",
    "bgSurface": "{surface}",
    "surfaceElevated": "{elevated}",
    "textMain": "{text}",
    "textMuted": "{muted}",
    "textSubtle": "{subtle}",
    "accent": "{accent}",
    "accentSoft": "{accent_soft}",
    "accentStrong": "{accent_strong}",
    "borderSubtle": "{border}",
    "fontDisplay": "{heading_font}",
    "fontBody": "{body_font}"
  },
  "sectionStyles": {
    "Hero": { "tone": "bold" },
    "Problem": { "tone": "neutral" },
    "Solution": { "tone": "accent" },
    "DoctorIntro": { "tone": "elevated" },
    "MiniDiagnosis": { "tone": "neutral" }
  },
  "stylesheet": "skin.css",
  "skinActivatedAt": "{ISO timestamp}"
}
```

**Key rules:**
- `stylesheet` field must be `"skin.css"` (skin-loader loads by this name)
- `skinActivatedAt` must be included (without it, advanced skin features are disabled)
- `extends` inherits from an existing skin → undefined tokens are inherited from the parent

**3.4. DB activation**

After writing the manifest, update theme_config in DB for immediate activation:

```sql
UPDATE clinics SET theme_config = json('{
  "skin": "{skin_id}",
  "brandHue": "{hue}",
  "rounding": "md",
  "density": "normal",
  "mode": "light",
  "skinSystemVersion": 2,
  "skinActivatedAt": "{ISO timestamp}"
}'), updated_at = unixepoch()
WHERE id = 1;
```

Execute with `npx wrangler d1 execute my-clinic-db --local`.

**3.5. Report brand integration (optional)**

If the clinic owner wants to match the report style too:

```sql
UPDATE report_brand SET
  primary_color = '{primary}',
  accent_color = '{accent}',
  text_color = '{text}',
  muted_color = '{muted}',
  font_family = '{sans|serif}',
  updated_at = unixepoch()
WHERE id = 1;
```

### Phase 3.5 — TW4 Safety Validation

After generating skin.css, run this validation before deployment.

**3.5.1. Dangerous selector pattern check**

If skin.css contains these patterns, **fix immediately**:

```css
/* DANGEROUS — over-matching applies to unintended elements */

/* Problem: also matches hover:bg-[...accent-strong] classes */
[class*="text-"][class*="accent-strong"] { ... }

/* Problem: also matches btn--primary, causing inversion */
.section a[href*="map"] { color: var(--accent); background: #fff; }

/* Problem: bg-[color:var(--accent)] matches accent-soft, accent-strong too */
[class*="bg-"][class*="accent"] { ... }
```

**Safe replacement patterns:**

```css
/* SAFE — exact matching */

/* Exact TW4 class names */
[class*="text-accent-strong"],
[class*="text-\[color\:var\(--accent-strong"] { color: #5a1038 !important; }

/* Exclude btn--primary */
.section a[href*="map"]:not(.btn--primary) { color: var(--accent); background: #fff; }

/* Explicit bg-accent only (excluding accent-soft, accent-strong) */
.bg-accent { background-color: #721947 !important; color: #fff !important; }

/* Force TW4 text-on-accent correction */
[class*="text-on-accent"] { color: #fff !important; }
```

**3.5.2. Required selector checklist**

All custom skin skin.css files **must** include these rules:

```css
/* 1. Force btn--primary (prevent TW4 bg-[color:var(--accent)] misinterpretation) */
:root[data-skin="{id}"] .btn.btn--primary,
:root[data-skin="{id}"] a.btn--primary,
:root[data-skin="{id}"] button.btn--primary {
  background: linear-gradient(135deg, {accent}, {accent-strong}) !important;
  background-color: {accent} !important;
  color: #fff !important;
  border-color: {accent} !important;
}

/* 2. Force text-on-accent */
:root[data-skin="{id}"] [class*="text-on-accent"] {
  color: #fff !important;
}

/* 3. Explicit bg-[color:var(--accent)] interpretation */
:root[data-skin="{id}"] .bg-accent,
:root[data-skin="{id}"] [class*="bg-\[color\:var\(--accent\)"] {
  background-color: {accent} !important;
  color: #fff !important;
}

/* 4. section--tone-neutral background (editorialCalm family) */
:root[data-skin="{id}"] .section--tone-neutral {
  background: {bg-body} !important;
}
```

**3.5.3. Automated verification**

After writing skin.css, auto-run `/review-ux` to confirm 0 contrast ratio FAILs:
```
/review-ux → 0 FAILs confirmed → proceed to Phase 4
           → FAILs found → fix skin.css → re-verify
```

### Phase 4 — Verify

```
✅ Custom skin created and activated

🎨 Skin Info:
   ID: {skin_id}
   Name: {display_name}
   Location: src/skins/local/{skin_id}/
   Base: inherits from {base_skin}

📁 Generated Files:
   manifest.json — tokens, section styles, metadata
   skin.css — custom CSS variables

🗄️ DB:
   clinics.theme_config updated
   skinSystemVersion: 2, skinActivatedAt set
   {If report integrated: report_brand also updated}

🔗 Preview:
   npm run dev → check on main page
   /admin/design → fine-tune on skin settings page

What's next:
- "Make the color a bit darker" → modify tokens
- "Change the hero style" → modify sectionStyles
- "Apply this style to reports too" → update report_brand
- "/setup-homepage" → configure homepage
```

## Reference: Manifest Token Fields

| Token | Purpose | Example |
|-------|---------|---------|
| `bgBody` | Page background | `#ffffff` |
| `bgSurface` | Card/panel background | `#f9fafb` |
| `surfaceElevated` | Highlighted area background | `#f3f4f6` |
| `textMain` | Primary text | `#1f2937` |
| `textMuted` | Secondary text | `#6b7280` |
| `accent` | Brand accent color | `#2563eb` |
| `accentSoft` | Light accent | `#dbeafe` |
| `accentStrong` | Dark accent | `#1d4ed8` |
| `fontDisplay` | Heading font | `'Pretendard', sans-serif` |
| `fontBody` | Body font | `'Noto Sans KR', sans-serif` |

## Safety

- All generated files are stored in `src/skins/local/` (protected from core:pull)
- Never modify existing core skins
- `extends` enables inheritance from existing skins
- manifest's `stylesheet` must be `skin.css` (watch for filename mismatch)

## Integration

| Skill | Relationship |
|-------|-------------|
| `/setup-skin` | Select/apply existing skin (this skill develops new skins) |
| `/setup-homepage` | Configure homepage after skin is applied |
| `/frontend-code` | Custom section component implementation |

## Triggers

- "스킨 만들기", "커스텀 테마", "디자인 시스템"
- "우리 병원 색상으로", "브랜드 컬러"
- "테마 직접 만들기", "리브랜딩"

## All user-facing output in Korean.
