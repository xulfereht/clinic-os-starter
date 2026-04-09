# /curate-images — Collected Image Classification + Metadata

> **Role**: Image Curator
> **Cognitive mode**: Classify collected images and organize each one with metadata for homepage production.

Run after /extract-content. Classifies extracted blog images and Place photos as raw material for homepage creation.

## When to Use

- After `/extract-content` to classify and organize extracted blog images
- When you need to identify what image assets are available for homepage production
- When performing a gap analysis to determine which scenes need to be generated
- When building an asset inventory with metadata for downstream skills like `/enhance-portrait` or `/generate-scenes`

## Prerequisites

- `/extract-content` completed (blog posts + images saved to DB or local)
- Images uploaded to R2 or downloaded to local `public/local/assets/`

## Procedure

### Step 1 — Collect image inventory

```bash
# Extract image URLs from blog posts in DB
npx wrangler d1 execute DB --local --command \
  "SELECT id, title, content FROM posts WHERE type='blog' AND is_sample=0 LIMIT 100;" \
  | head -c 5000
```

Extract image URLs from content:
- `<img src="...">` tags
- `![alt](url)` markdown
- R2-uploaded images: `/api/files/blog-imports/...`
- External images: `pstatic.net`, `blogfiles.naver.net`, etc.

### Step 2 — Classify images

Download and visually classify each image:

| Category | Description | Homepage Usage |
|----------|-------------|----------------|
| `portrait_real` | Real photos of doctor/staff | DoctorIntro, Hero, About |
| `portrait_card` | Card/design containing person photo | → extract person via /enhance-portrait |
| `clinic_interior` | Clinic interior/facilities | Hero background, facility showcase |
| `treatment` | Treatment/procedure scenes | Program Hero, Mechanism |
| `equipment` | Medical equipment/tools | Mechanism, Solution |
| `herbal` | Herbal medicine/ingredients | Solution, product showcase |
| `certificate` | Licenses/certifications | Credentials section |
| `paper` | Papers/conference presentations | Papers section |
| `design_card` | Design cards (text overlay) | → extract text via /analyze-content |
| `other` | Unclassifiable | Hold |

### Step 3 — Download and organize images

Save useful images locally:

```bash
mkdir -p public/local/assets/raw

# Download R2 images
curl -sL "http://localhost:4321/api/files/blog-imports/2026-03/HASH.jpg" \
  -o public/local/assets/raw/descriptive-name.jpg

# Or for starter kit
mkdir -p core/public/local/assets/raw
```

Filename convention: `{category}-{description}.{ext}`
- `portrait-doctor-consulting.jpg`
- `treatment-acupuncture-back.jpg`
- `interior-reception.jpg`
- `card-specialties-overview.png`

### Step 4 — Generate asset-metadata.json

```bash
cat > public/local/assets/asset-metadata.json << 'EOF'
{
  "version": "1.0",
  "updated": "2026-03-27",
  "source": "/extract-content + /curate-images",
  "categories": {
    "portrait_real": {
      "description": "Real doctor/staff photos",
      "assets": []
    },
    "portrait_card": {
      "description": "Card images with extractable person photos",
      "assets": []
    },
    "clinic_interior": {
      "description": "Clinic interior/facilities",
      "assets": []
    },
    "treatment": {
      "description": "Treatment/procedure scenes",
      "assets": []
    },
    "equipment": {
      "description": "Equipment/tools",
      "assets": []
    },
    "herbal": {
      "description": "Herbal medicine/ingredients",
      "assets": []
    },
    "certificate": {
      "description": "Licenses/certifications",
      "assets": []
    },
    "design_card": {
      "description": "Design cards (for text extraction)",
      "assets": []
    }
  },
  "summary": {
    "total": 0,
    "usable_for_homepage": 0,
    "needs_enhancement": 0,
    "needs_generation": []
  }
}
EOF
```

Each asset entry:
```json
{
  "file": "portrait-doctor-consulting.jpg",
  "category": "portrait_real",
  "size": "773x515",
  "person": "홍길동",
  "scene": "초음파 상담",
  "quality": "high",
  "usable_for": ["DoctorIntro", "Hero"],
  "source_post_id": "blog-123",
  "notes": ""
}
```

### Step 5 — Gap analysis + report

```
📸 이미지 큐레이션 결과

수집: 45장
├── portrait_real: 3장 (원장 상담, 원장 시술, 직원)
├── portrait_card: 5장 (→ /enhance-portrait 필요)
├── clinic_interior: 4장
├── treatment: 2장
├── equipment: 1장
├── herbal: 0장
├── certificate: 3장
├── design_card: 12장 (→ /analyze-content로 텍스트 추출)
└── other: 15장

홈페이지 바로 사용 가능: 13장
인물 추출 필요 (/enhance-portrait): 5장
장면 생성 필요 (/generate-scenes): 진료 장면, 약재 이미지 부족

Recommended next steps:
  → /enhance-portrait (카드에서 원장 사진 추출)
  → /analyze-content (카드 텍스트 추출 + 콘텐츠 분석)
  → /generate-scenes (부족한 장면 생성)
```

## Called By

- `/plan-content` — references image gap analysis results
- Demo workflow calls this after /extract-content

## Triggers

- "이미지 정리", "사진 분류", "에셋 정리"
- "어떤 사진이 있어?", "이미지 현황"

## All user-facing output in Korean.
