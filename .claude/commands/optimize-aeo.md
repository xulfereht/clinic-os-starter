# /optimize-aeo — AEO/SEO Optimization

> **Role**: AEO/SEO Optimization Specialist
> **Cognitive mode**: Context-aware routing. Detect master vs local repo and provide appropriate AEO optimization for each context.

Manages AI search engine optimization (AEO) and SEO configuration in a unified way.
In the master repo, optimizes workshop/platform pages; in local repos, optimizes clinic sites.

## When to Use

- Onboarding Tier 5 (Advanced optimization)
- After publishing new content that needs metadata verification
- Setting up structured data (Schema.org) for the clinic
- Configuring AI discovery endpoints (ai.json, llms.txt)
- During the `/onboarding` "aeo-optimization" step

## Prerequisites

- `/setup-clinic-info` completed (clinic basic information)
- `/setup-homepage` or blog content exists
- Master mode: HQ server deployment completed

## Context Detection

```bash
# Check repo context
if [ -d "hq" ] && [ -d "docs" ]; then
  MODE="master"
  echo "🎯 Master mode: platform/workshop page AEO"
elif [ -d "core" ] || ([ -d "src/pages" ] && [ ! -d "hq" ]); then
  MODE="local"
  echo "🏥 Local mode: clinic site AEO"
else
  echo "❌ Unknown context."
  exit 1
fi
```

## Procedure

### Step 1 — AEO Health Check

```bash
# Check existing AEO configuration
echo "=== AEO Status Check ==="

# Check schema files
ls -la src/lib/aeo*.ts 2>/dev/null | head -5

# Check AI discovery endpoints
curl -s http://localhost:4321/.well-known/ai.json 2>/dev/null | head -20
curl -s http://localhost:4321/llms.txt 2>/dev/null | head -10

# Check DB tables (local mode)
npx wrangler d1 execute DB --local --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%aeo%';" 2>/dev/null

# Check content metadata coverage
npx wrangler d1 execute DB --local --command \
  "SELECT
    COUNT(*) as total_posts,
    SUM(CASE WHEN publish_ready = 1 THEN 1 ELSE 0 END) as ready_count
   FROM content_aeo_metadata;" 2>/dev/null
```

### Step 2 — Identify Gaps

**Master Mode (platform):**
- Workshop landing page Schema.org
- Class page structured data
- llms.txt / ai.json update
- HQ Topic/FAQ structuring

**Local Mode (clinic):**
- Clinic Schema (MedicalClinic, Physician)
- OG image + meta tags
- Blog AEO metadata
- Naver/Kakao + AI search simultaneous optimization

```bash
# Check what's missing
echo "=== Missing Items Check ==="

# Check clinic schema components
npx wrangler d1 execute DB --local --command \
  "SELECT key, value FROM site_settings WHERE category='contact';" 2>/dev/null

# Check OG setup
ls public/local/og-image.png 2>/dev/null || echo "⚠️ OG image missing"

# Check for schema injection
grep -r "json+ld" src/layouts/ 2>/dev/null | head -3 || echo "⚠️ Schema not injected"
```

### Step 3 — Present Options

**Master mode options:**

```
🤖 Platform AEO Optimization (Master Mode)

Current status:
  ✅ ai.json — configured
  ✅ llms.txt — configured
  ⚠️  Workshop page Schema — missing
  ⚠️  Class structured data — missing

Options:
  [A] Full optimization — create/update all AEO components
  [B] Workshop pages only — add landing page Schema
  [C] HQ content metadata — Topic/FAQ structuring
  [D] AI discovery — refresh ai.json, llms.txt

Which option?
```

**Local mode options:**

```
🏥 Clinic Site AEO Optimization (Local Mode)

Current status:
  ✅ Clinic basic info — configured
  ⚠️  Schema.org — MedicalClinic missing
  ⚠️  OG image — missing
  ⚠️  Blog AEO metadata — 0 of 3 completed

Options:
  [A] Full optimization — Schema + OG + metadata
  [B] Schema only — MedicalClinic, Physician structured data
  [C] Social meta — OG image, Naver/Kakao tags
  [D] Content metadata — blog/topic AEO metadata backfill
  [E] Validation — diagnose current AEO configuration

Which option?
```

### Step 4 — Execute (Local Mode Example: Full Optimization)

**4A. Schema.org Generation:**

```bash
# Verify clinic info is complete
npx wrangler d1 execute DB --local --command \
  "SELECT key, value FROM site_settings
   WHERE category IN ('general', 'contact', 'info')
   AND key IN ('site_name', 'address', 'phone', 'representative');"

# If complete, schemas are auto-generated via src/lib/aeo.ts
# Just verify the AEOScript component is in layout
grep -r "AEOScript" src/layouts/BaseLayout.astro 2>/dev/null || echo "⚠️ AEOScript component check needed"
```

**4B. OG Image Setup:**

```bash
# Delegate to /setup-og if needed
# Or create minimal OG if not exists
if [ ! -f "public/local/og-image.png" ]; then
  echo "OG image not found. Run /setup-og first,"
  echo "or a simple text-based OG can be generated."
fi
```

**4C. Content Metadata Backfill:**

```bash
# Run AEO backfill for existing content
echo "Generating AEO metadata for existing content..."

# Check backfill script
node -e "const backfill = require('./src/lib/aeo-backfill.ts'); console.log('Backfill module exists');" 2>/dev/null || echo "Backfill via admin panel recommended"

# Trigger via API if available
curl -s -X POST http://localhost:4321/api/admin/aeo/backfill-metadata \
  -H "Content-Type: application/json" \
  -d '{"mode": "auto", "contentTypes": ["post", "topic"]}' 2>/dev/null || echo "API not available, use admin panel: /admin/aeo"
```

**4D. Validation:**

```bash
# Validate generated metadata
npx wrangler d1 execute DB --local --command \
  "SELECT
    content_type,
    COUNT(*) as total,
    SUM(CASE WHEN publish_ready = 1 THEN 1 ELSE 0 END) as ready,
    SUM(CASE WHEN validation_errors IS NOT NULL THEN 1 ELSE 0 END) as errors
   FROM content_aeo_metadata
   GROUP BY content_type;"
```

### Step 5 — Verification

```bash
echo "=== AEO Optimization Verification ==="

# Build and check
npm run build 2>/dev/null || echo "Build needed for full verification"

# Check schema in built output
grep -o '<script type="application/ld+json">[^<]*</script>' dist/index.html 2>/dev/null | head -1 || echo "Schema not found in build"

# Check AI discovery endpoints
echo "AI Manifest:"
curl -s http://localhost:4321/.well-known/ai.json 2>/dev/null | head -5

echo ""
echo "LLMs.txt:"
curl -s http://localhost:4321/llms.txt 2>/dev/null | head -3
```

**Completion Report:**

```
✅ AEO/SEO Optimization Complete

📊 Schema Status:
   MedicalClinic: ✅ configured
   Physician: ✅ configured
   WebSite: ✅ configured

🤖 AI Discovery:
   ai.json: ✅ accessible
   llms.txt: ✅ accessible
   /for-ai: ✅ {N} content packs

📝 Content Metadata:
   Blog: {ready}/{total} completed
   Topic: {ready}/{total} completed

🔗 Social Meta:
   OG image: {status}
   Naver: ✅
   Kakao: ✅

Validation tools:
  - Google Rich Results: https://search.google.com/test/rich-results
  - Kakao Sharing: https://developers.kakao.com/tool/debugger/sharing
```

## Master Mode Specifics

**HQ Platform AEO:**

```bash
# Master mode focuses on:
# 1. Workshop landing pages
echo "Checking workshop page Schema..."
ls src/pages/workshops/ 2>/dev/null | head -5

# 2. Class pages structure
echo "Checking class page structure..."
ls src/pages/classes/ 2>/dev/null | head -5

# 3. Platform-level discovery
echo "Checking platform AI discovery..."
cat public/.well-known/ai.json 2>/dev/null | head -10
```

**HQ Admin Integration:**
- `/admin/aeo` — AEO Health Check panel
- `/api/admin/aeo/backfill-metadata` — batch metadata generation
- `/api/admin/aeo/rebuild-related-links` — related links rebuild

## Local Mode Specifics

**Clinic Site AEO:**

```bash
# Local mode focuses on:
# 1. Clinic-specific schemas (MedicalClinic, Physician)
# 2. Naver/Kakao meta tags
# 3. Blog AEO metadata
# 4. OG image for social sharing

# Check Naver-specific meta
grep -r "naver" src/layouts/ 2>/dev/null | head -3

# Check Kakao-specific meta
grep -r "kakao" src/layouts/ 2>/dev/null | head -3
```

## Integration

| Skill | Relationship |
|-------|-------------|
| `/setup-og` | OG image setup integration (Local mode) |
| `/write-blog` | AEO metadata generation after blog writing |
| `/setup-homepage` | Homepage Schema integration |
| `/onboarding` | Tier 5 "aeo-optimization" step |
| `/hq-admin` | HQ content management (Master mode) |

## Handoff

**To /setup-homepage:**
```json
{
  "from": "optimize-aeo",
  "to": "setup-homepage",
  "schemas_ready": true,
  "recommendations": [
    "Schema.org markup has been activated.",
    "Add FAQPage schema to homepage sections."
  ]
}
```

**To /write-blog:**
```json
{
  "from": "optimize-aeo",
  "to": "write-blog",
  "aeo_ready": true,
  "templates": {
    "citations": true,
    "supervisor": true,
    "key_claims": true
  }
}
```

## Triggers

- "AEO", "SEO", "AI 검색", "구조화 데이터", "Schema.org"
- "네이버에 뜨게", "구글 검색", "AI가 추천"
- "메타데이터", "llms.txt", "ai.json"
- "에이전트가 찾을 수 있게"

## Safety

- Read: DB queries and file checks run freely
- Write: User confirmation before metadata creation/modification
- Production: Explicit confirmation for `--remote` flag
- Local only: All generated files go to `local/` or `_local/` paths

## All user-facing output in Korean.
