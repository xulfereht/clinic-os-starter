---
description: Full content bootstrap pipeline — from data collection through image generation to site launch. Agent-executable for both onboarding and delegated flows.
---

# Content Bootstrap Pipeline

End-to-end workflow for populating a clinic site with real content.
Usable from both **onboarding** (direct install) and **delegated setup** flows.

> **Prerequisite**: Setup complete (`npm run setup:step` all done), admin accessible, DB initialized.
> **SOT**: This file is the single reference for content bootstrapping. `onboarding.md` and `delegated-setup.md` both point here.

---

## Overview

```
Phase 1: Data Collection
  ├─ 1a. Naver Place extraction
  ├─ 1b. Naver Blog extraction
  └─ 1c. Client-provided assets (photos, certificates, leaflets)

Phase 2: Analysis & Planning
  ├─ 2a. Tone & manner extraction (style card)
  ├─ 2b. Program planning (blog keyword → program structure)
  └─ 2c. Section matrix (which images for which pages)

Phase 3: Image Generation (Nano Banana 2)
  ├─ 3a. Base source cuts (doctor, clinic room, equipment)
  ├─ 3b. Page-specific images (Hero, Mechanism, Solution per program)
  └─ 3c. Branding assets (logo, favicon, OG image)

Phase 4: Blog Import
  ├─ 4a. Extract (Naver/other platforms → raw content)
  ├─ 4b. Clean (HTML→Markdown or HTML preservation)
  ├─ 4c. Metadata (doctor_id, category→program mapping)
  └─ 4d. Image R2 migration (pstatic.net → R2)

Phase 5: Site Configuration
  ├─ 5a. Basic info, contact, hours
  ├─ 5b. Terms & policies (4 types + i18n)
  ├─ 5c. Programs (sections + real photo assets), staff
  ├─ 5d. Theme & skin
  └─ 5e. YouTube, forms, navigation

Phase 6: Custom Homepage
  ├─ 6a. Preset selection (classic / editorial)
  ├─ 6b. Real photo sourcing (blog → optimized/)
  ├─ 6c. Content customization (hero, credentials, papers)
  └─ 6d. Asset metadata (asset-metadata.json)
```

---

## Phase 1: Data Collection

### 1a. Naver Place Extraction

```bash
node scripts/extract-naver.js \
  --place-url="https://naver.me/XXXXX" \
  --dry-run
```

**Extracts**: Clinic name (ko/en), address, phone, hours, photos, categories, reviews
**Output**: `--dry-run` prints JSON to stdout; without it, patches clinic-profile.json and site_settings

**Agent action**: Ask user for Naver Place URL if not in clinic-profile.json.

### 1b. Naver Blog Extraction

```bash
node scripts/extract-naver.js \
  --blog-id=BLOG_ID \
  --limit=100 \
  --dry-run \
  --output=json
```

**Extracts**: Blog posts with title, content (HTML), date, images
**Multiple blog IDs**: Use `--blog-id=X --blog-id=Y` for multiple accounts

**For delegated flow** (operating on client's remote DB):
```bash
node scripts/extract-naver.js \
  --blog-id=BLOG_ID \
  --db=CLIENT_DB_NAME \
  --cf-token=CF_TOKEN \
  --skip-images \
  --env=production
```

**Agent action**: Ask user for blog ID(s). Check Naver Place page for linked blog.

### 1c. Client-Provided Assets

Collect from user:
| Category | Required | Purpose |
|----------|----------|---------|
| Doctor profile photo | Required | DoctorIntro section, staff.image |
| Clinic interior photos | Required | Space tone reference |
| Equipment photos | Optional | Mechanism section reference |
| Treatment scene photos | Optional | Hero section reference |
| Herbal medicine/products | If applicable | Solution section reference |
| Logo file (SVG/PNG) | Optional | Header, favicon |
| Certificates/licenses | Optional | Credibility content |

**Agent action**: Ask user to provide photos. Store in `public/local/assets/` for reference during image generation.

---

## Phase 2: Analysis & Planning

### 2a. Tone & Manner Extraction (Style Card)

From collected assets, create a style card:

```yaml
# Style Card — {Clinic Name}
space:
  wall: warm wood panels, cream walls
  floor: light hardwood
  accent: bamboo, natural stone
  lighting: warm LED, indirect
  furniture: modern Korean medicine aesthetic

people:
  doctor_appearance: male, 40s, glasses, white coat
  uniform: white doctor's coat with clinic logo

brand:
  primary_color: "#2D5A4D"  # from Naver Place / branding-minimal
  secondary_color: "#F5E6D3"
  mood: professional yet warm, trustworthy
  logo_style: clean, modern

dont:
  - Elements not present in actual clinic
  - Any text, letters, numbers, signage
  - Overly saturated colors
  - Western medical equipment not used in Korean medicine
  - Stock photo feel
```

**Agent action**: Analyze collected photos + Naver Place data. Write style card to `.agent/style-card.yaml` (local, not core-tracked).

### 2b. Program Planning

From blog content analysis, map keywords to programs:

```bash
# If blog already extracted to JSON:
cat extracted-blogs.json | node -e "
  const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const keywords = {};
  data.forEach(p => {
    // Extract treatment-related keywords from titles
    const matches = p.title.match(/(추나|침|한약|부항|물리치료|교정|통증|비염|피부|소화|두통|어지럼|불면|여성|산후|소아|성장)/g);
    if (matches) matches.forEach(k => keywords[k] = (keywords[k]||0) + 1);
  });
  console.log(JSON.stringify(keywords, null, 2));
"
```

**Program structure** (target 4-8 programs):
| Program | Slug | Typical Sections |
|---------|------|-----------------|
| 통증·근골격 | pain-musculoskeletal | Hero, Mechanism, Solution, DoctorIntro, FAQ |
| 소화기 | digestive | Hero, Mechanism, Solution, DoctorIntro |
| 피부질환 | skin-dermatology | Hero, Solution, DoctorIntro, FAQ |
| 비염·호흡기 | rhinitis-respiratory | Hero, Mechanism, DoctorIntro |
| 여성건강 | womens-health | Hero, Solution, DoctorIntro |
| ... | ... | ... |

**Agent action**: Propose programs based on blog keyword frequency. Get user confirmation before creating.

### 2c. Section Image Matrix

Map which images each program page needs:

```
Sections that RENDER images:
  Hero:        1080×1350px (4:5)  — Required, object-cover, main visual
  Mechanism:   1200×900px  (4:3)  — Optional, treatment technique focus
  Solution:    800×800px   (1:1)  — Optional, flat-lay/product style
  DoctorIntro: 800×1000px  (4:5)  — Auto from staff DB (scale-150%, center_20% crop)

Sections that DO NOT render images (skip):
  Problem, FeatureHighlight, Process, FAQ
```

**Per-program image plan**:
```
Program "추나요법":
  Hero:      Doctor performing chuna therapy, patient on table, warm clinic room
  Mechanism: Close-up of spine alignment technique, equipment visible
  Solution:  Flat-lay of treatment tools, herbal packs, warming equipment

Program "비염치료":
  Hero:      Doctor examining patient's face/nose area, gentle lighting
  Mechanism: Acupuncture needles near sinus points, clean composition
  Solution:  Herbal medicine preparation, nasal treatment supplies
```

**Agent action**: Write image plan with specific prompts per program. Total target: base sources (~5) + per-program (~3 each) ≤ 30 images (HQ quota).

---

## Phase 3: Image Generation (Nano Banana 2)

> **Model**: `gemini-3.1-flash-image-preview` (alias: Nano Banana 2)
> **Script**: `scripts/generate-image.js`
> **Modes**: BYOK (GEMINI_API_KEY in .env) or HQ proxy (clinic.json device_token, 30 image quota)

### 3a. Base Source Cuts

Generate consistent base images first. These serve as references for all subsequent images.

```bash
GEN="node scripts/generate-image.js"

# Doctor portrait (from real photo reference)
$GEN \
  --prompt "Studio portrait of Korean medicine doctor in white coat, warm smile, clean background, professional headshot, soft natural lighting" \
  --ref public/local/assets/doctor-original.jpg \
  --aspect "3:4" \
  --save-path "images/base/doctor-portrait.png"

# Clinic room (from interior photo reference)
$GEN \
  --prompt "Modern Korean medicine clinic treatment room, warm wood tones, treatment bed, clean and organized, professional medical setting, natural daylight from window" \
  --ref public/local/assets/clinic-interior-1.jpg \
  --ref public/local/assets/clinic-interior-2.jpg \
  --aspect "16:9" \
  --save-path "images/base/clinic-room.png"

# Equipment (from equipment photo reference)
$GEN \
  --prompt "Korean medicine treatment equipment arranged on clean surface, acupuncture supplies, cupping tools, professional medical grade, warm neutral background" \
  --ref public/local/assets/equipment.jpg \
  --aspect "4:3" \
  --save-path "images/base/equipment.png"

# Herbal products (if applicable)
$GEN \
  --prompt "Korean herbal medicine preparations, traditional medicine packets, warm natural tones, editorial flat-lay style" \
  --ref public/local/assets/herbs.jpg \
  --aspect "1:1" \
  --save-path "images/base/herbal-products.png"
```

**Budget**: ~5 images for base sources

### 3b. Page-Specific Images

Use base source cuts as references to maintain tone consistency.

```bash
# Per program — Hero (4:5)
$GEN \
  --prompt "Korean medicine doctor performing chuna spinal therapy on patient, warm clinic room, professional and caring atmosphere, natural lighting" \
  --ref public/local/images/base/doctor-portrait.png \
  --ref public/local/images/base/clinic-room.png \
  --aspect "4:5" \
  --save-path "images/programs/pain/hero.png"

# Per program — Mechanism (4:3)
$GEN \
  --prompt "Close-up of acupuncture treatment on back, precise needle placement, clean medical setting, professional technique focus" \
  --ref public/local/images/base/equipment.png \
  --aspect "4:3" \
  --save-path "images/programs/pain/mechanism.png"

# Per program — Solution (1:1)
$GEN \
  --prompt "Flat-lay editorial arrangement of Korean medicine treatment preparation, herbal packs and warming equipment on clean surface, soft natural light from above" \
  --ref public/local/images/base/herbal-products.png \
  --aspect "1:1" \
  --save-path "images/programs/pain/solution.png"
```

**Budget**: ~3 images per program × N programs

**Prompt rules**:
- Always append: `Do not include any text, words, letters, numbers, signage, labels, captions, watermarks, or logos in the image.` (auto-added by script)
- Use `--ref` with 2-3 reference images for tone consistency
- Hero angles: vary between programs (eye-level, slight above, side angle)
- Mechanism: differentiate from Hero (different angle, tighter crop)
- Solution: flat-lay/editorial style, never lineup/catalog style

### 3c. Branding Assets

```bash
# OG image (1200x630)
$GEN \
  --template og \
  --save-path "images/og-image.png"

# If no logo provided — use generic or generate stylized
# Logo should be SVG (create manually or use existing template)
# Favicon — convert from logo:
# sips -s format png --resampleWidth 32 --resampleHeight 32 logo.png --out public/favicon-32x32.png
```

### Image Deployment

After generation, deploy images:

```bash
# For direct install — images are in public/local/images/, served statically
# Nothing more needed

# For delegated flow — upload to R2:
npx wrangler r2 object put BUCKET/programs/pain/hero.png \
  --file=public/local/images/programs/pain/hero.png --remote

# Update DB sections JSON with image paths
# Use admin API or direct SQL:
# UPDATE programs SET sections = json_set(sections, '$.hero.image', '/api/files/programs/pain/hero.png') WHERE slug='pain'
```

---

## Phase 4: Blog Import

### 4a. Extract

```bash
# Full extraction with image download
node scripts/extract-naver.js \
  --blog-id=BLOG_ID \
  --output=json

# Output: extracted-BLOG_ID.json with title, content (HTML), date, images
```

**For delegated**: Run from master repo with `--db` and `--cf-token` flags pointing to client's D1.

### 4b. Clean

Two import paths — decide before proceeding:

**Path A: Markdown conversion** (recommended for most)
- HTML → Markdown conversion
- Naver boilerplate removal (이웃추가, 공유하기, 본문 폰트 크기, URL복사, 신고하기, 출처)
- Empty line consolidation (≤2 consecutive)
- Map/embed section removal
- **Bold text → heading conversion**: `**소제목 텍스트**` → `## 소제목 텍스트` (enables TOC)
- SE editor comment removal

**Path B: HTML preservation** (for complex formatting)
- Set `content_type = 'html'` in posts table
- Strip only Naver chrome (navigation, footer, profile)
- Keep HTML structure, tables, styling intact
- Use HTML editor mode in admin (`/admin/posts/[id]`)

**Cleaning process** (Path A):
```
1. Test with 1 post first:
   - Apply cleaning rules
   - Verify in browser (/blog/[slug])
   - Adjust rules if needed

2. Apply to all posts:
   - Batch SQL UPDATE via wrangler d1 execute
   - Or API bulk update

3. Second pass — refinement:
   - Check for remaining Naver UI remnants
   - Fix broken line spacing
   - Verify heading hierarchy
```

### 4c. Metadata

After import, enrich posts with:

```sql
-- 1. Assign doctor_id to all posts (single-doctor clinics)
UPDATE posts SET doctor_id = 'staff-SLUG' WHERE doctor_id IS NULL AND is_sample = 0;

-- 2. Map categories to program slugs (keyword-based)
UPDATE posts SET category = 'pain-musculoskeletal'
  WHERE (title LIKE '%추나%' OR title LIKE '%통증%' OR title LIKE '%허리%' OR title LIKE '%목%' OR title LIKE '%어깨%')
  AND is_sample = 0;

UPDATE posts SET category = 'digestive'
  WHERE (title LIKE '%소화%' OR title LIKE '%위장%' OR title LIKE '%식욕%' OR title LIKE '%변비%')
  AND is_sample = 0;

-- ... repeat for each program
-- Posts that don't match any keyword → leave as '건강정보' (general health)
```

**Agent action**: Generate mapping SQL based on actual program slugs and blog content keywords. Test with `SELECT COUNT(*)` before applying.

### 4d. Image R2 Migration (Optional)

For blogs with external images (pstatic.net, etc.):

```bash
# Option A: extract-naver.js with image pipeline (during initial import)
node scripts/extract-naver.js \
  --blog-id=BLOG_ID \
  --env=production

# Option B: Standalone migration for already-imported posts
# Use scripts/migrate-blog-images-r2.js (queries DB → downloads → R2 → replaces URLs)
node scripts/migrate-blog-images-r2.js

# Check remaining external images:
npx wrangler d1 execute DB_NAME --remote --command \
  "SELECT COUNT(*) FROM posts WHERE type='blog' AND content LIKE '%pstatic.net%';"
```

**R2 public paths** (no auth required): `blog-images/`, `programs/`, `staff/`, `homepage/`

**Note**: Naver image download requires URL conversion:
- `mblogthumb-phinf.pstatic.net/...` → `postfiles.pstatic.net/...?type=w773`
- Use `Referer: https://m.blog.naver.com/` + Mozilla User-Agent header
- Rate limit: concurrency 3, 2s delay between chunks, 30s per-image timeout
- Failed images: remove `<img>` tag or `![image](url)` reference from content
- R2 key format: `blog-imports/YYYY-MM/{uuid}.{ext}`
- R2 public paths (no auth): `blog-images/`, `programs/`, `staff/`, `homepage/`

**For delegated flow** (operating on client's remote DB from master repo):
```bash
# Set in client's wrangler.toml or pass as args:
DB_NAME=cos-{client_id_short}-db
BUCKET=cos-{client_id_short}-uploads

# Run from client project directory (delegated-clients/{slug}/)
cd delegated-clients/{slug}
node scripts/migrate-blog-images-r2.js
```

---

## Phase 5: Site Configuration

### 5a. Basic Info & Contact

Set via admin API or direct DB:

```bash
# Via onboarding flow (interactive):
# Agent asks for: clinic name, representative, phone, address, email, kakao, hours

# Via API:
curl -X PUT "$SITE_URL/api/admin/settings" \
  -H "Cookie: admin_session=..." \
  -d '{"category":"general","key":"site_name","value":"바로한의원"}'
```

**Key settings**:
| Category | Key | Example |
|----------|-----|---------|
| general | site_name | 바로한의원 |
| general | site_url | https://baro-clinic.pages.dev |
| general | representative | 원장 홍길동 |
| contact | phone | 02-1234-5678 |
| contact | address | 서울시 ... |
| contact | email | info@baro-clinic.com |
| contact | kakao_channel | @baroclinic |
| info | business_number | 123-45-67890 |

### 5b. Terms & Policies

4 standard terms (auto-generated with `{{clinic_name}}` substitution):
1. `privacy` — 개인정보 처리방침
2. `terms` — 이용약관
3. `medical` — 의료정보 면책
4. `marketing` — 마케팅 수신동의

```sql
INSERT OR REPLACE INTO terms (type, title, content, version, is_required, language)
VALUES ('privacy', '개인정보 처리방침', '...', '1.0', 1, 'ko');
```

**i18n**: For multilingual sites, add `language` variants (en, ja, zh-hans, vi).

### 5c. Programs & Staff

**Staff**: From clinic-profile or user input.
```sql
INSERT INTO staff (id, name, title, bio, image, sort_order)
VALUES ('staff-hong', '홍길동', '대표원장', '...약력...', '/api/files/staff/hong.png', 1);
```

**Program sections**: Each program has a `sections` JSON array. Recommended structure:

| 섹션 | 목적 | 이미지 가이드 |
|------|------|-------------|
| Hero | 첫인상, 프로그램 대표 비주얼 | 원장 상담/시술 실사 (가로형 권장) |
| Problem | 환자 공감 — "이런 증상이 있으신가요?" | 이미지 불필요 (카드형) |
| FeatureHighlight | 차별점 강조 — "왜 우리 한의원인가?" | 강연/학회/시설 실사 |
| Mechanism | 치료 원리 — 단계별 설명 | 시술 장면 또는 장비 실사 |
| Solution | 치료 수단 — 구체적 치료법 목록 | 치료 도구/약재 실사 |
| DoctorIntro | 담당 의료진 소개 | 원장 포트레이트 실사 (Hero와 다른 컷) |
| Process | 진료 절차 4단계 | 이미지 불필요 (스텝형) |
| YouTube | 시술 영상 | 자동 임베드 |
| FAQ | 자주 묻는 질문 3~5개 | 이미지 불필요 |
| RelatedPosts | 관련 블로그 글 | 자동 (featured_image 폴백) |
| RelatedReviews | 치료 후기 | 자동 |

**이미지 원칙**:
- 같은 프로그램 내 동일 사진 중복 최소화 (Hero ≠ DoctorIntro)
- 디자인 카드(텍스트 오버레이) 사용 금지 — 섹션 안에서 너무 작게 보임
- 실사 우선, AI 생성은 실사가 없을 때만
- 블로그 포스트에서 고퀄 진료 사진 추출 가능 (Phase 6b 참조)

**featured_image 자동 폴백**: 블로그 목록/RelatedPosts에서 `featured_image`가 없으면 content의 첫 이미지를 자동 추출하여 표시합니다 (코어 내장 기능).

### 5d. Theme & Skin

```sql
-- Set skin (see skin-definitions.ts for options)
INSERT OR REPLACE INTO site_settings (category, key, value)
VALUES ('branding', 'skin', 'clinicLight');

-- Set brand hue
INSERT OR REPLACE INTO site_settings (category, key, value)
VALUES ('branding', 'brandHue', 'teal');
```

**Available skins**: clinicLight, wellnessWarm, premiumDark, orientalHerb, freshNature, medicalTrust
**Aliases**: modern→clinicLight+teal, professional→clinicLight+blue, warm→wellnessWarm+brown

### 5e. YouTube, Forms, Navigation

```sql
-- YouTube sections (lowercase 'youtube' type in sections JSON)
-- Add to program sections: {"type": "youtube", "videoId": "YOUTUBE_ID", "title": "..."}

-- Navigation menu (auto-generated from programs, can customize)
INSERT OR REPLACE INTO site_settings (category, key, value)
VALUES ('config', 'navigation', '[{"label":"진료프로그램","children":[...]},{"label":"블로그","href":"/blog"}]');

-- Intake form
INSERT OR REPLACE INTO site_settings (category, key, value)
VALUES ('features', 'intake_enabled', 'true');
```

---

## Phase 6: Custom Homepage

### 6a. Preset Selection

`src/plugins/custom-homepage/presets/`에 두 가지 프리셋이 있습니다:

| 프리셋 | 스타일 | 권장 스킨 | 주요 섹션 |
|--------|--------|-----------|-----------|
| **classic** | SectionRenderer 기반, 심플 | clinicLight | MainHero, Bridge, NarrativeFlow, ServiceTiles, Philosophy, HomeInfo |
| **editorial** | 잡지형, 풀스크린 히어로 | editorialCalm | EditorialHero, Highlights, Bridge, Credentials, Papers, NarrativeFlow, YouTube, ServiceTiles, DoctorIntro, HomeInfo |

```bash
# 프리셋 복사 → 활성화
cp src/plugins/custom-homepage/presets/editorial.astro src/plugins/custom-homepage/pages/index.astro

# 스타터킷에서는 core/ 접두사 필수
cp core/src/plugins/custom-homepage/presets/editorial.astro core/src/plugins/custom-homepage/pages/index.astro
```

프리셋은 시작점입니다. 복사 후 콘텐츠 데이터(hero, credentials, papers 등)를 자유롭게 수정하세요.
빈 배열/빈 문자열로 설정하면 해당 섹션이 자동으로 숨겨집니다.

**또는** `_local/index.astro`로 완전히 자유로운 커스텀 홈페이지를 직접 작성할 수도 있습니다.

### 6b. Real Photo Sourcing

블로그 포스트에서 프로 촬영 사진을 추출하여 에셋으로 활용합니다:

```
1. 블로그에서 진료/장비/원장 사진이 포함된 포스트 식별
   → 키워드: 초음파, 시술, 장비, 자격증, 학회
2. R2 이미지 URL로 다운로드
   → curl -sL "https://SITE/api/files/blog-imports/2026-03/HASH.jpg" -o photo.jpg
3. 화질 확인 (773px 이상이면 사용 가능, Hero는 1200px+ 권장)
4. 의미 있는 파일명으로 저장
   → consult-ats.jpg, procedure-mjh.jpg, explain-ats.jpg 등
5. core/public/homepage/optimized/에 배치
```

**이미지 선별 기준**:
- 프로 촬영 (조명, 구도가 좋은 것)
- 원장님 얼굴이 선명하게 보이는 것
- VARO CLINIC 등 한의원 로고/명찰이 보이면 좋음
- 디자인 카드(텍스트 오버레이) 제외

### 6c. Content Customization

프리셋 복사 후 상단의 콘텐츠 데이터를 클라이언트 정보로 교체:
- `hero`: 배지, 제목, 설명, CTA, 배경 이미지
- `credentials`: 자격증 이미지/소지자/설명 (배열 — 비우면 섹션 숨김)
- `papers`: 논문 표지/제목/저널명/연도 (배열 — 비우면 섹션 숨김)
- `narrative`: 3단계 스토리텔링 (문제→치료→결과)
- `youtube`: 소개 영상 URL (빈 문자열이면 섹션 숨김)
- `highlights`: 주요 강점 키워드 배지

### 6d. Asset Metadata

에셋 폴더에 `asset-metadata.json`을 생성하여 이미지 카탈로그를 관리합니다:

```json
{
  "version": "1.0",
  "updated": "2026-03-24",
  "categories": {
    "portrait_real": {
      "description": "프로 촬영 원장 사진 (실사)",
      "assets": [
        {"file": "consult-ats.jpg", "size": "773x515", "person": "안태석", "scene": "초음파 상담"}
      ]
    }
  }
}
```

**카테고리**: `portrait_real` (실사), `portrait_ai` (나노바나나), `herbal_real` (첩약 실사), `equipment` (장비), `interior` (인테리어)

### 스타터킷 구조 주의사항

스타터킷에서는 빌드가 `core/` 안에서 실행되므로:

```
파일 위치:     core/src/pages/_local/index.astro
플러그인:      core/src/plugins/custom-homepage/pages/index.astro
정적 에셋:     core/public/homepage/optimized/
```

**Import 경로**: alias 사용 필수 (`@components/`, `@lib/`)
```astro
import BaseLayout from "@components/layout/BaseLayout.astro";   ✅
import BaseLayout from "../../components/...";                   ❌ resolve 실패
```

---

## Execution Checklist

```
[ ] Phase 1: Data collected (Place + Blog + Assets)
[ ] Phase 2: Style card written, programs planned, image matrix ready
[ ] Phase 3: Base sources generated (~5), program images generated (~18-25)
[ ] Phase 4: Blog imported, cleaned, metadata assigned, images migrated
[ ] Phase 5: Settings configured, programs with sections + real photos, theme applied
[ ] Phase 6a: Homepage preset selected (classic/editorial), content customized
[ ] Phase 6b: Real photos sourced from blog → optimized/, asset-metadata.json created
[ ] Phase 6c: Design cards removed, all images verified (no AI where real exists)
[ ] Final: Build + deploy + browser verification (all programs, blog, homepage)
```

**Total image budget**: ~5 base + ~3/program × 6 programs = ~23 images (within 30 quota)

**Post-bootstrap**: Refer to `delegated-handoff.md` (for delegated) or continue with remaining onboarding tiers.

---

## Quick Reference — Commands

| Task | Command |
|------|---------|
| Extract Naver | `node scripts/extract-naver.js --blog-id=X --place-url=Y` |
| Generate image | `node scripts/generate-image.js --prompt "..." --ref X --aspect "4:5"` |
| Image templates | `node scripts/generate-image.js --list-styles` |
| Check quota | HQ API: `GET /api/v1/image-quota?device_token=TOKEN` |
| Migrate blog images | `node scripts/migrate-blog-images-r2.js [--dry-run] [--limit=N]` |
| Build | `npm run build` |
| Deploy | `npm run deploy` |
| Health check | `npm run health` |

---

## Cross-References

- **Onboarding flow**: `.agent/workflows/onboarding.md` — Tier 1-5 feature setup
- **Delegated setup**: `.agent/workflows/delegated-setup.md` — Phase 3.5 references this file
- **Image generation details**: `memory/workflow_image_generation.md` — style card format, section matrix
- **Post-handoff checklist**: `.agent/workflows/delegated-handoff.md` — SEO/AEO/domain tasks
- **Naver extraction**: `scripts/extract-naver.js` + `scripts/lib/naver-blog-extractor.js`
- **Image generation**: `scripts/generate-image.js` + `scripts/lib/image-prompt-guide.js`
