# /setup-skin — Skin/Theme Application

> **Role**: Design Manager
> **Cognitive mode**: Select and apply an existing skin. For creating new skins, use `/dev-skin`.

Select and apply from 9 core skins + local/store skins.

## When to Use

- During onboarding when choosing the clinic's visual theme
- When the clinic owner wants to change the site's look and feel
- After brand analysis to apply a matching skin
- When switching from default skin to a customized theme

## Procedure

### Step 1 — Check current skin

```bash
npx wrangler d1 execute my-clinic-db --local --command \
  "SELECT theme_config FROM clinics WHERE id = 1;"
```

Parse the JSON to find current `skin`, `brandHue`, `mode`.

### Step 2 — Present skin options

| Skin | Mood | Best For |
|------|------|----------|
| `clinicLight` | Bright and clean | Most clinics (default) |
| `wellnessWarm` | Warm and natural | Herbal medicine / acupuncture focus |
| `editorialCalm` | Editorial, calm | Premium / specialist clinics |
| `forestTherapy` | Nature forest therapy | Healing / wellness focus |
| `hanbangClassic` | Traditional Korean medicine | Traditional orientation |
| `ivoryLedger` | Minimal professional | Clean design preference |
| `scandiCare` | Scandinavian minimal | Minimal preference |
| `dataDark` | Dark theme | Special cases |
| `midnightSignal` | Modern dark | Special cases |

Also check for local skins:
```bash
ls src/skins/local/*/manifest.json 2>/dev/null
```

Reference `style-card.yaml` tone for recommendation.

### Step 3 — Apply skin (SOT: clinics.theme_config)

```bash
npx wrangler d1 execute my-clinic-db --local --command \
  "UPDATE clinics SET theme_config = json_set(
    COALESCE(theme_config, '{}'),
    '$.skin', '{SKIN_ID}',
    '$.skinSystemVersion', 2,
    '$.skinActivatedAt', datetime('now')
  ), updated_at = unixepoch() WHERE id = 1;"
```

### Step 4 — Brand hue (optional)

```bash
# Options: gray, blue, green, teal, brown
npx wrangler d1 execute my-clinic-db --local --command \
  "UPDATE clinics SET theme_config = json_set(
    theme_config,
    '$.brandHue', '{HUE}'
  ), updated_at = unixepoch() WHERE id = 1;"
```

### Step 5 — Build + verify

```bash
npm run build && npm run dev
# Check /admin/design to verify
```

### Step 6 — Sync report brand (optional)

If the user wants report branding to match:

```bash
# Read skin tokens from manifest
cat src/skins/{SKIN_ID}/manifest.json | python3 -c "
import json,sys; m=json.load(sys.stdin)
t=m.get('tokens',{})
print(f\"primary: {t.get('accent','#0f172a')}\")
print(f\"text: {t.get('textMain','#1f2937')}\")
"

# Update report_brand to match
npx wrangler d1 execute my-clinic-db --local --command \
  "UPDATE report_brand SET
    primary_color = '{accent_from_skin}',
    text_color = '{text_from_skin}',
    font_family = '{sans_or_serif}',
    updated_at = unixepoch()
  WHERE id = 1;"
```

## CSS Override Chain

Skin styles are applied in this order (last wins):

```
1. @theme block (global.css)              — TW4 color registration
2. :root[data-skin="X"] (global.css)      — per-skin CSS variable defaults
3. @layer skin { } (skin.css)             — skin-specific component styles
4. Admin CSS overrides (DB cssOverrides)   — user customizations (HIGHEST)
```

**Important:** Skin **component overrides** (custom Hero, section layouts) only work when:
- `theme.skinSystemVersion >= 2` OR `theme.skinActivatedAt` is set
- This is controlled by `isAdvancedSkinEnabled()` in BaseLayout

Step 3 of this procedure ensures both flags are set. If a skin appears "not applied" after activation, check these values first.

## Triggers

- "스킨 바꿔줘", "테마 변경", "디자인 바꾸고 싶어"
- "색상 변경", "분위기 바꾸기"

## Onboarding State Sync

After skin is applied and build succeeds, mark the onboarding feature as done.
This runs regardless of entry point (demo, delegated, onboarding, standalone).

```bash
npm run onboarding:done -- --feature=custom-skin --note="setup-skin completed"
```

> Skip silently if onboarding-state.json doesn't exist.

## All user-facing output in Korean.
