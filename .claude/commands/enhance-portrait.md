# /enhance-portrait — Doctor Photo Enhancement (Nanobanana)

> **Role**: Portrait Specialist
> **Cognitive mode**: Extract a person from a card image or enhance an existing photo to studio-grade profile quality.

## Prerequisites

- `/curate-images` completed (portrait_card or portrait_real classified in asset-metadata.json)
- `scripts/generate-image.js` available
- GEMINI_API_KEY env var or HQ image generation quota

## Procedure

### Step 1 — Identify target images

```bash
cat public/local/assets/asset-metadata.json | \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); \
  ['portrait_real','portrait_card'].forEach(c => { \
    if(d.categories[c]) console.log(c+':', JSON.stringify(d.categories[c].assets, null, 2)); \
  })"
```

### Step 2 — Determine enhancement type

| Source Type | Enhancement Method | Result |
|-------------|-------------------|--------|
| Card image (contains person) | Extract person via Nanobanana + replace background | Studio-grade profile |
| Real photo (low quality) | Quality enhancement via Nanobanana + clean background | Enhanced profile |
| Real photo (high quality) | Use as-is or minor adjustments | Original used directly |

### Step 3 — Generate images

```bash
GEN="node scripts/generate-image.js"

# Extract person from card → studio-grade profile
$GEN \
  --prompt "Professional studio portrait of Korean medicine doctor in white coat, clean neutral background, soft natural lighting, confident and warm expression, medical professional headshot" \
  --ref public/local/assets/raw/card-doctor-profile.png \
  --aspect "3:4" \
  --save-path "public/local/assets/enhanced/doctor-portrait-studio.png"

# Enhance existing photo quality
$GEN \
  --prompt "Enhanced professional photo of Korean medicine doctor, same person same face, clean background, improved lighting, medical professional portrait" \
  --ref public/local/assets/raw/portrait-doctor-original.jpg \
  --aspect "4:5" \
  --save-path "public/local/assets/enhanced/doctor-portrait-enhanced.png"
```

**Prompt rules:**
- Always use `--ref` with the original person photo (maintain likeness)
- Include "same person same face" recommended
- Text/logo/watermark prohibition is auto-added (built into the script)
- Emphasize doctor's coat, clean background, professional lighting

### Step 4 — DoctorIntro-specific enhancement

The DoctorIntro section applies `scale-150%`, `center_20%` crop, so:
- Person must be centered in the frame
- Upper body must be sufficiently included (above waist)
- 4:5 aspect ratio recommended

```bash
$GEN \
  --prompt "Upper body portrait of Korean medicine doctor in white coat, centered composition, clean clinic background, warm professional lighting, looking at camera" \
  --ref public/local/assets/raw/portrait-doctor-original.jpg \
  --aspect "4:5" \
  --save-path "public/local/assets/enhanced/doctor-intro.png"
```

### Step 5 — Update asset-metadata.json

Add generated images to metadata:

```json
{
  "file": "enhanced/doctor-portrait-studio.png",
  "category": "portrait_enhanced",
  "size": "900x1200",
  "person": "원장",
  "scene": "스튜디오 프로필",
  "quality": "high",
  "usable_for": ["DoctorIntro", "Hero", "About"],
  "source": "portrait_card → /enhance-portrait",
  "notes": "카드 이미지에서 인물 추출 후 스튜디오급 가공"
}
```

### Step 6 — Report

```
🖼️ 원장 사진 가공 결과

생성: 3장
  doctor-portrait-studio.png (3:4) — 스튜디오 프로필
  doctor-portrait-enhanced.png (4:5) — 보정 프로필
  doctor-intro.png (4:5) — DoctorIntro 섹션용

이미지 쿼터 사용: 3/30

추천 다음 단계:
  → /generate-scenes (부족한 장면 이미지 생성)
  → /plan-site (기획안에 이미지 배치)
```

## Triggers

- "원장 사진 가공", "프로필 사진", "인물 추출"
- "카드에서 사진 뽑아줘", "스튜디오 사진"

## All user-facing output in Korean.
