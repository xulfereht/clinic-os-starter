# /setup-og — OG Image + Social Meta Setup

> **Role**: Social Media Optimizer
> **Cognitive mode**: Generate or select an OG image and configure meta tags so the site looks professional when shared on KakaoTalk, LINE, Facebook, etc.

Creates the Open Graph image and meta configuration for social sharing.
Without this, shared links show a broken thumbnail or generic placeholder.

## When to Use

- Onboarding Tier 2 (after homepage is set up)
- Before first production deploy
- When user reports "thumbnail doesn't show when sharing on KakaoTalk"

## Prerequisites

- `/setup-clinic-info` complete (clinic name, description)
- Homepage configured (`/setup-homepage` or `/frontend-code`)
- Recommended: `/curate-images` complete (asset-metadata.json for image selection)

## Procedure

### Step 1 — Check current OG setup

```bash
# Check if og-image exists
ls public/og-image.png 2>/dev/null || ls public/local/og-image.png 2>/dev/null

# Check meta tags in layout
grep -r "og:image" src/layouts/ 2>/dev/null | head -5

# Current clinic info
npx wrangler d1 execute DB --local --command \
  "SELECT key, value FROM site_settings WHERE category='general' AND key IN ('site_name', 'site_description', 'site_url');"
```

### Step 2 — Determine OG image source

Three options (in priority order):

**A: Existing image available**
- Check `asset-metadata.json` for `design_card` or `exterior` images
- A clean clinic card or exterior photo works well as OG image
- Recommend 1200x630px (Facebook/KakaoTalk optimal)

**B: Generate with Nana-Banana (Gemini)**
- Use clinic name + brand colors + representative image
- Call `/generate-scenes` with OG-specific parameters

**C: Text-based fallback**
- Create a simple branded OG image using clinic name + colors
- Suggest user upload a proper image later

Present options:

```
🖼️ OG Image (Social Sharing Thumbnail) Setup

Current: No OG image

Options:
  [A] Use existing image — card-01.png (clinic intro card)
  [B] Generate new — Create OG image with Nanobanana
  [C] Text-based — Simple design with clinic name + brand colors

Which option?
```

### Step 3 — Prepare OG image

Regardless of source, ensure:
- Format: PNG or JPG
- Size: 1200x630px (2:1 ratio)
- File size: under 1MB
- Location: `public/local/og-image.png` (safe zone)

```bash
# If resizing needed (requires sharp or similar)
# Place in safe zone
mkdir -p public/local/
cp {source_image} public/local/og-image.png
```

### Step 4 — Configure meta tags

Check if the layout already reads OG settings from DB:

```bash
grep -r "og:" src/layouts/BaseLayout.astro | head -10
```

If the layout reads from `site_settings`:

```bash
npx wrangler d1 execute DB --local --command \
  "INSERT OR REPLACE INTO site_settings (category, key, value) VALUES
   ('seo', 'og_image', '/local/og-image.png'),
   ('seo', 'og_title', '{clinic_name}'),
   ('seo', 'og_description', '{clinic_description}');"
```

If the layout uses a hardcoded path, note it for user:

```
ℹ️ BaseLayout.astro uses the /og-image.png path.
   Will copy public/local/og-image.png → public/og-image.png.
```

### Step 5 — Verify

```bash
npm run build
# Check the built HTML for meta tags
grep "og:" dist/index.html 2>/dev/null | head -5
```

```
✅ OG image setup complete

Image: /local/og-image.png (1200x630)
Title: {clinic_name}
Description: {description}

This image will be displayed when sharing links on KakaoTalk/SNS.
Verify after deploy: https://developers.kakao.com/tool/debugger/sharing
```

## Integration

| Skill | Relationship |
|-------|-------------|
| `/setup-homepage` | OG image often uses same hero image |
| `/curate-images` | Source for existing images |
| `/generate-scenes` | Can generate OG-specific image |
| `/onboarding` | Tier 2 "og-image" feature triggers this |

## Triggers

- "OG 이미지", "소셜 공유", "썸네일"
- "카톡 공유하면 이미지 안 나와", "SNS 미리보기"
- "og image", "open graph"

## Onboarding State Sync

After OG image is generated and meta tags are configured, mark the onboarding feature as done.
This runs regardless of entry point (demo, delegated, onboarding, standalone).

```bash
npm run onboarding:done -- --feature=og-image --note="setup-og completed"
```

> Skip silently if onboarding-state.json doesn't exist.

## All user-facing output in Korean.
