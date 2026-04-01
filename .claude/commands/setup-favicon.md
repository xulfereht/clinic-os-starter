# /setup-favicon — Favicon Generation & Setup

> **Role**: Brand Designer
> **Cognitive mode**: Generate a professional favicon that represents the clinic's brand identity.

## When to Use

- During onboarding (Tier 1 — deploy essentials)
- When the client requests brand refresh
- When favicon is missing or uses the default Clinic-OS favicon

## Prerequisites

- `clinic.json` exists (clinic name, brand info)
- Accent color known (from skin or style-card)

## Procedure

### Step 1 — Analyze brand identity

Read the clinic's brand context:
```
clinic.json → organization name
skin manifest → accent color, mood
style-card.yaml → brand colors (if exists)
```

Extract:
- **Clinic name** (first character for text-based favicon)
- **Accent color** (primary brand color)
- **Accent strong** (darker variant for gradient)
- **Brand mood** (modern, traditional, warm, etc.)

### Step 2 — Generate SVG favicon

Create a clean SVG favicon (32×32 viewBox). Best practices:

**Design rules:**
- Simple, recognizable at 16×16px
- Use the clinic's accent color as primary
- Max 2 colors (accent + white, or accent gradient)
- No fine details — they disappear at small sizes
- Rounded rectangle or circle background preferred
- Text-based (first character of clinic name) is the safest approach
- If the clinic has a logo concept, incorporate it abstractly

**SVG template (text-based):**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{accent}"/>
      <stop offset="100%" stop-color="{accent-strong}"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="url(#g)"/>
  <text x="16" y="23" text-anchor="middle" font-family="sans-serif"
        font-weight="900" font-size="20" fill="white">{첫글자}</text>
</svg>
```

**SVG template (icon-based):**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{accent}"/>
      <stop offset="100%" stop-color="{accent-strong}"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="url(#g)"/>
  <!-- Simple icon path here -->
</svg>
```

### Step 3 — Generate PNG variants

```bash
# SVG → PNG (32×32 for favicon, 180×180 for apple-touch-icon, 512×512 for PWA)
magick public/local/favicon.svg -resize 32x32 public/local/favicon.png
magick public/local/favicon.svg -resize 180x180 public/local/apple-touch-icon.png
magick public/local/favicon.svg -resize 512x512 public/local/icon-512.png
```

### Step 4 — Deploy favicon

Place files in `public/local/` (safe from core:pull):
```
public/local/favicon.svg
public/local/favicon.png
public/local/apple-touch-icon.png
public/local/icon-512.png
```

Update DB settings for favicon URL:
```sql
INSERT OR REPLACE INTO settings (key, value, updated_at)
VALUES ('faviconUrl', '"/local/favicon.png"', unixepoch());
```

Or if BaseLayout reads from settings.faviconUrl, set it there.

### Step 5 — Verify

```bash
npm run build
# Check dist/
ls -la dist/local/favicon.* dist/local/apple-touch-icon.png
```

Preview in browser and verify:
- [ ] Favicon visible in browser tab
- [ ] Readable at 16×16px
- [ ] Colors match clinic brand
- [ ] No pixelation or blur

### Report

```
🎨 파비콘 설정 완료

생성: favicon.svg + favicon.png (32×32) + apple-touch-icon.png (180×180)
브랜드 컬러: {accent} → {accent-strong} 그라데이션
디자인: {설명}
경로: public/local/favicon.* (core:pull 안전)
```

## Triggers

- "파비콘", "favicon", "아이콘 변경", "탭 아이콘"

## All user-facing output in Korean.
