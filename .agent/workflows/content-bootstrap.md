---
description: Content bootstrap pipeline — data collection → image generation → site launch
category: content
---

# Content Bootstrap Pipeline

End-to-end workflow for populating a clinic site with real content.
Usable from both **onboarding** (direct install) and **delegated setup** flows.

**Prerequisite**: Setup complete, admin accessible, DB initialized.

## Pipeline Overview

```
Phase 1:   Data Collection (Naver Place + Blog + client assets)
Phase 1.5: Reference Collection (competitor/design sites → references.yaml)
Phase 2:   Analysis & Planning (style card + programs + image matrix)
Phase 3:   Image Generation (Nano Banana 2 — base sources + per-program)
Phase 4:   Blog Import (extract → clean → metadata → R2 migration)
Phase 5:   Site Configuration (info, terms, programs, staff, theme)
Phase 6:   Custom Homepage (preset → real photos → content → asset-metadata)
```

## Artifact Paths (phase handoff)

| Artifact | Path | Created | Consumed |
|----------|------|---------|----------|
| Clinic profile | `.agent/clinic-profile.json` | Phase 1 | 2, 5 |
| Style card | `.agent/style-card.yaml` | Phase 2 | 3, 6 |
| Edge profile | `.agent/edge-profile.yaml` | Phase 2 | 4, 6 |
| References | `.agent/references.yaml` | Phase 1.5 | 2, 5, 6 |
| Pipeline context | `.agent/pipeline-context.yaml` | Phase 2+ | All (cumulative) |
| Site plan | `.agent/site-plan.yaml` | Phase 2 | 5, 6 |
| Homepage assets | `public/local/homepage/` | Phase 6b | 6c |
| Asset metadata | `public/local/homepage/asset-metadata.json` | Phase 6d | Agent ref |

All `.agent/*.yaml` files are local (core:pull protected).

---

## Phase 1: Data Collection

### 1a. Naver Place
```bash
node scripts/extract-naver.js --place-url="https://naver.me/XXXXX" --dry-run
```
Extracts: name, address, phone, hours, photos, categories, reviews → patches clinic-profile.json

### 1b. Naver Blog
```bash
node scripts/extract-naver.js --blog-id=BLOG_ID --limit=100 --dry-run --output=json
# Multiple blogs: --blog-id=X --blog-id=Y
# Delegated (remote DB): --db=CLIENT_DB --cf-token=TOKEN --skip-images --env=production
```

### 1c. Client Assets
| Category | Required | Purpose |
|----------|----------|---------|
| Doctor profile photo | Yes | DoctorIntro, staff.image |
| Clinic interior photos | Yes | Space tone reference |
| Equipment photos | Optional | Mechanism section |
| Treatment scene photos | Optional | Hero section |
| Logo file (SVG/PNG) | Optional | Header, favicon |
| Certificates | Optional | Credibility content |

Store in `public/local/assets/`.

## Phase 1.5: Reference Collection

Ask for: existing site URL, competitor sites (1-3), design references.
If provided → `/collect-references` → `.agent/references.yaml`.

**Sufficiency checkpoint** (after Phase 1+1.5):
- Blog posts: thin (<5) / adequate (5-30) / rich (30+)
- `needs-supplement` → proceed but note gaps | `insufficient` → warn user

## Phase 2: Analysis & Planning

### 2a. Style Card
From collected assets, write `.agent/style-card.yaml`:
```yaml
space: { wall, floor, accent, lighting, furniture }
people: { doctor_appearance, uniform }
brand: { primary_color, secondary_color, mood, logo_style }
dont: [elements not in actual clinic, text/letters, overly saturated, stock photo feel]
```

### 2b. Program Planning
Map blog keywords → programs (target 4-8). Get user confirmation.
```bash
# Keyword frequency analysis from extracted blog JSON
```

### 2c. Section Image Matrix
| Section | Size | Required | Style |
|---------|------|----------|-------|
| Hero | 1080×1350 (4:5) | Yes | object-cover, main visual |
| Mechanism | 1200×900 (4:3) | Optional | treatment technique focus |
| Solution | 800×800 (1:1) | Optional | flat-lay/product style |
| DoctorIntro | 800×1000 (4:5) | Auto from staff DB | scale-150%, center_20% crop |

Sections WITHOUT images (skip): Problem, FeatureHighlight, Process, FAQ.

Per-program: write specific prompts. Budget: ~5 base + ~3/program × N programs ≤ 30 images.

---

## Phase 3: Image Generation

**Model**: `gemini-3.1-flash-image-preview` (Nano Banana 2)
**Script**: `scripts/generate-image.js`
**Modes**: BYOK (GEMINI_API_KEY in .env) or HQ proxy (device_token, 30 quota)

```bash
GEN="node scripts/generate-image.js"

# Base sources (~5 images)
$GEN --prompt "..." --ref public/local/assets/doctor.jpg --aspect "3:4" --save-path "images/base/doctor-portrait.png"
$GEN --prompt "..." --ref public/local/assets/interior.jpg --aspect "16:9" --save-path "images/base/clinic-room.png"

# Per-program images (~3 each)
$GEN --prompt "..." --ref images/base/doctor-portrait.png --ref images/base/clinic-room.png --aspect "4:5" --save-path "images/programs/pain/hero.png"
```

**Prompt rules**: always use `--ref` with 2-3 refs for consistency. Auto-appends "no text/letters/watermarks". Vary Hero angles between programs. Mechanism ≠ Hero (different angle/crop). Solution = flat-lay/editorial.

### Image Deployment
- Direct install: `public/local/images/` → served statically
- Delegated: `npx wrangler r2 object put BUCKET/path --file=local/path --remote`

---

## Phase 4: Blog Import

### 4a-b. Extract & Clean
```bash
node scripts/extract-naver.js --blog-id=BLOG_ID --output=json
```

**Path A (Markdown)**: HTML → Markdown, strip Naver boilerplate, `**bold**` → `## heading`, empty line consolidation.
**Path B (HTML)**: set `content_type='html'`, strip Naver chrome only.

Test with 1 post → verify → batch apply.

### 4c. Metadata
```sql
UPDATE posts SET doctor_id = 'staff-SLUG' WHERE doctor_id IS NULL AND is_sample = 0;
UPDATE posts SET category = 'pain-musculoskeletal'
  WHERE (title LIKE '%추나%' OR title LIKE '%통증%') AND is_sample = 0;
-- Repeat per program. Unmatched → '건강정보'
```

### 4d. Image R2 Migration
```bash
node scripts/migrate-blog-images-r2.js  # queries DB → downloads → R2 → replaces URLs
# Check remaining: SELECT COUNT(*) FROM posts WHERE content LIKE '%pstatic.net%';
```

Naver image conversion: `mblogthumb-phinf` → `postfiles.pstatic.net?type=w773`. Requires `Referer: https://m.blog.naver.com/`. Rate: concurrency 3, 2s delay. Failed → remove broken `<img>` from content.

---

## Phase 5: Site Configuration

### 5a. Basic Info
Via admin API: `PUT /api/admin/settings` with category/key/value.
Key settings: site_name, site_url, representative, phone, address, email, kakao_channel, business_number.

### 5b. Terms (4 types)
privacy, terms, medical, marketing — INSERT OR REPLACE into `terms` table. i18n: add language variants.

### 5c. Programs & Staff
```sql
INSERT INTO staff (id, name, title, bio, image, sort_order) VALUES (...);
```

Program `sections` JSON — recommended: Hero, Problem, FeatureHighlight, Mechanism, Solution, DoctorIntro, Process, YouTube, FAQ, RelatedPosts, RelatedReviews.

**Image rules**: no duplicate photos within same program. No design cards (text overlay). Real photos > AI generated. `featured_image` auto-fallback from content's first image (core built-in).

### 5d. Theme
```sql
INSERT OR REPLACE INTO site_settings (category, key, value) VALUES ('branding', 'skin', 'clinicLight');
INSERT OR REPLACE INTO site_settings (category, key, value) VALUES ('branding', 'brandHue', 'teal');
```
Skins: clinicLight, wellnessWarm, premiumDark, orientalHerb, freshNature, medicalTrust.

### 5e. YouTube, Forms, Navigation
YouTube in sections JSON: `{"type": "youtube", "videoId": "ID"}`. Navigation: `config/navigation` setting. Intake: `features/intake_enabled`.

---

## Phase 6: Custom Homepage

### 6a. Preset Selection
| Preset | Style | Sections |
|--------|-------|----------|
| classic | SectionRenderer, simple | MainHero, Bridge, NarrativeFlow, ServiceTiles, Philosophy, HomeInfo |
| editorial | Magazine, fullscreen hero | EditorialHero, Highlights, Bridge, Credentials, Papers, NarrativeFlow, YouTube, ServiceTiles, DoctorIntro, HomeInfo |

```bash
mkdir -p src/plugins/local/custom-homepage/pages
cp src/plugins/custom-homepage/presets/editorial.astro src/plugins/local/custom-homepage/pages/index.astro
```

Plugin-loader auto-prioritizes `local/custom-homepage/`. Presets are read-only templates. Empty array/string → section auto-hides. Images must be in `public/local/homepage/`.

### 6b. Real Photo Sourcing
Extract pro photos from blog posts → `public/local/homepage/optimized/`. Selection: pro lighting/composition, clear doctor face, clinic branding visible. No design cards.

### 6c. Content Customization
Edit preset copy: hero, credentials, papers, narrative, youtube, highlights. Use `@components/`, `@lib/` import aliases (NOT relative paths).

### 6d. Asset Metadata
Create `public/local/homepage/asset-metadata.json` cataloging all images by category: portrait_real, portrait_ai, herbal_real, equipment, interior.

**Starter kit paths**: files go in `core/src/plugins/...`, `core/public/local/...` (build runs inside `core/`).

---

## Quick Reference

| Task | Command |
|------|---------|
| Extract Naver | `node scripts/extract-naver.js --blog-id=X --place-url=Y` |
| Generate image | `node scripts/generate-image.js --prompt "..." --ref X --aspect "4:5"` |
| Image templates | `node scripts/generate-image.js --list-styles` |
| Check quota | `GET /api/v1/image-quota?device_token=TOKEN` |
| Migrate blog images | `node scripts/migrate-blog-images-r2.js [--dry-run]` |

## Pipeline Context — tacit_product Section

After `/extract-tacit-product`: updates `.agent/pipeline-context.yaml` with status, confidence (0.75+ recommended), completed axes, gaps.
Downstream: `/write-copy` → positioning/communication, `/setup-homepage` → positioning, `/setup-programs` → personalization/definition.

## Alignment Report

`/align-programs` output → `alignment-report.yaml`. Scores: overall + per-axis (definition, clinical_framework, personalization, positioning, communication). Severity: critical/warning/info. Run: monthly, after tacit update, before new content.
