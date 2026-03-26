# /setup-og — OG Image + Social Meta Setup

> **Role**: Social Media Optimizer
> **Cognitive mode**: Generate or select an OG image and configure meta tags so the site looks professional when shared on KakaoTalk, LINE, Facebook, etc.

Creates the Open Graph image and meta configuration for social sharing.
Without this, shared links show a broken thumbnail or generic placeholder.

## When to Use

- Onboarding Tier 2 (after homepage is set up)
- Before first production deploy
- When user reports "카톡에 공유하면 썸네일이 안 나와요"

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
npx wrangler d1 execute DB_NAME --local --command \
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
🖼️ OG 이미지 (소셜 공유 썸네일) 설정

현재: OG 이미지 없음

선택지:
  [A] 기존 이미지 사용 — card-01.png (한의원 소개 카드)
  [B] 새로 생성 — 나노바나나로 OG용 이미지 제작
  [C] 텍스트 기반 — 한의원 이름 + 브랜드 컬러로 간단히

어떤 걸로 할까요?
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
npx wrangler d1 execute DB_NAME --local --command \
  "INSERT OR REPLACE INTO site_settings (category, key, value) VALUES
   ('seo', 'og_image', '/local/og-image.png'),
   ('seo', 'og_title', '{clinic_name}'),
   ('seo', 'og_description', '{clinic_description}');"
```

If the layout uses a hardcoded path, note it for user:

```
ℹ️ BaseLayout.astro가 /og-image.png 경로를 사용합니다.
   public/local/og-image.png → public/og-image.png 로 복사하겠습니다.
```

### Step 5 — Verify

```bash
npm run build
# Check the built HTML for meta tags
grep "og:" dist/index.html 2>/dev/null | head -5
```

```
✅ OG 이미지 설정 완료

이미지: /local/og-image.png (1200x630)
제목: {clinic_name}
설명: {description}

카카오톡/SNS에서 링크 공유 시 이 이미지가 표시됩니다.
배포 후 확인: https://developers.kakao.com/tool/debugger/sharing
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

## All user-facing output in Korean.
