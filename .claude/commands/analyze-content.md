# /analyze-content — Content Analysis + Planning Materials + Writer Persona Extraction

> **Role**: Content Analyst
> **Cognitive mode**: Extract patterns from existing content — keywords, tone, visual identity, AND the writer's voice. Everything downstream (copy, blog, homepage) uses this output.

Runs after /extract-content + /curate-images. Performs blog keyword analysis, card text extraction, tone & manner analysis, and writer persona extraction.

## When to Use

- After `/extract-content` has imported blog posts into the DB
- When preparing for copy writing or homepage setup
- When the writer's voice and tone need to be captured for consistency
- As part of the content pipeline (extract → analyze → plan → write)
- When assessing data sufficiency before proceeding with content creation

## Prerequisites

- `/extract-content` completed (blog posts in DB)
- `/curate-images` completed (image classification + asset-metadata.json) — skip Step 2 if not available

## Procedure

### Step 0 — Data sufficiency check & reference collection

Before analysis, assess available data and collect references if needed.

```bash
# Count blog posts with actual content
npx wrangler d1 execute DB --local --command \
  "SELECT COUNT(*) as total, SUM(CASE WHEN length(COALESCE(content,'')) > 200 THEN 1 ELSE 0 END) as with_content FROM posts WHERE type='blog' AND is_sample=0;"

# Check clinic profile
cat .agent/clinic-profile.json 2>/dev/null | head -c 500

# Check if references already collected
cat .agent/references.yaml 2>/dev/null | head -c 200

# Check place data
npx wrangler d1 execute DB --local --command \
  "SELECT key, value FROM site_settings WHERE key IN ('clinic_name', 'clinic_phone', 'clinic_address', 'business_hours');"
```

**Sufficiency assessment:**

| Data | Sufficient | Thin | Missing |
|------|-----------|------|---------|
| Blog posts (with content) | 10+ | 5-9 | <5 |
| Place data (name+addr+phone) | All present | Partial | None |
| Specialties (distinct keywords) | 5+ | 3-4 | <3 |

**If data is thin or missing, ask the user:**

```
📊 Data Status Check

Blog: {N} posts (with content: {M})
Place data: {present/partial/missing}
{if thin}

Data is insufficient — analysis accuracy may be reduced.
Can you supplement with any of the following?

1. Additional blog IDs (if there are more Naver blogs)
2. Existing website URL (site being migrated)
3. Competitor clinic sites (benchmark targets)
4. Directly input key specialties
5. Proceed as-is
```

If user provides reference URLs → invoke /collect-references logic:
- For each URL, WebFetch and extract relevant data
- Save to `.agent/references.yaml`

If user provides specialties directly → note them for Step 1 keyword analysis.

### Step 1 — Blog keyword analysis

```bash
# Extract blog titles + categories
npx wrangler d1 execute DB --local --command \
  "SELECT title, category FROM posts WHERE type='blog' AND is_sample=0;"

# Content samples (top 10, for persona analysis)
npx wrangler d1 execute DB --local --command \
  "SELECT title, content FROM posts WHERE type='blog' AND is_sample=0 ORDER BY created_at DESC LIMIT 10;"
```

Analyze keyword frequency for treatments/symptoms from titles and content:

```
Keyword analysis results:
  Chuna/correction: 15 posts → program candidate
  Pain/back/neck: 12 posts → program candidate
  Rhinitis/respiratory: 8 posts → program candidate
  Digestive/stomach: 6 posts → program candidate
  Lifestyle/health info: 20 posts → blog category
```

**Reference cross-check** (if `.agent/references.yaml` exists):

```bash
cat .agent/references.yaml 2>/dev/null
```

- If existing site has programs not found in blog keywords, add as candidates with `source: reference_site`
- If competitors emphasize services we don't cover, note as `competitive_gap`
- Compare our keyword distribution vs competitors

### Step 2 — Card image text extraction

Read `design_card` category images from asset-metadata.json and extract text from images:

- Headlines/headcopy → clinic USP (unique selling point) candidates
- Subcopy → program description materials
- Credentials/career listings → Credentials section materials
- Treatment processes → Process section materials

### Step 3 — Writer persona extraction

**Read 10~20 blog posts and analyze the writer's unique voice.**

Analysis dimensions:

| Dimension | Method |
|-----------|--------|
| **Voice** | Honorific style (~합니다/~해요/~다). Honorific level. Reader address |
| **Sentence style** | Average sentence length. Short choppy vs. long flowing |
| **Structure** | Intro (empathy/question/case) → Body (explanation) → Closing (summary/visit CTA) pattern |
| **Vocabulary level** | Technical term frequency. Simplification degree. Use of metaphors/examples |
| **Emotional tone** | Educational/friendly/authoritative/empathetic/humorous |
| **Signature patterns** | Frequently used conjunctions, closing phrases, emphasis patterns |
| **Medical depth** | Shallow (lifestyle tips) / Medium (TCM concept explanation) / Deep (paper citations) |

**Representative sentence extraction:** Select 5~7 sentences that best represent the writer's voice.

**Reference tone comparison** (if references exist):
- Compare extracted blog tone with existing site tone
- Note differences: "Existing site: {formal/warm}, Blog: {detected}"
- Recommend direction for new site: "Recommend the new site follow the blog tone (more approachable)" or ask user

### Step 4 — Generate style-card.yaml

Synthesize all collected data into style-card.yaml:

```yaml
# .agent/style-card.yaml
# Generated by /analyze-content

brand:
  name: ""
  slogan: ""
  primary_keywords: []  # Top 5 blog keywords
  tone: ""  # e.g., "Professional yet warm"

space:
  wall: ""
  floor: ""
  accent: ""
  lighting: ""
  mood: ""

people:
  doctor_appearance: ""
  uniform: ""

programs:
  suggested: []
  # Each item: {name, slug, keyword_count, description_from_cards}

credentials:
  items: []

copy_materials:
  headlines: []
  descriptions: []
  usps: []

# === Writer Persona ===
writer_persona:
  voice: ""
  # e.g., "Formal polite style, addresses patients as 'patients', polite yet warm tone"

  sentence_style: ""
  # e.g., "Prefers short sentences (avg 15-20 chars), frequent line breaks"

  structure: ""
  # e.g., "Symptom empathy → Cause explanation → Korean medicine approach → Treatment intro → Visit CTA"

  vocabulary: ""
  # e.g., "Uses technical terms with simple explanation in parentheses, frequent metaphors"

  emotional_tone: ""
  # e.g., "Educational + empathetic. Acknowledges patient's discomfort first, then presents solution"

  medical_depth: ""
  # e.g., "Medium — explains Korean medicine concepts (qi, meridians) but rarely cites papers"

  signature_patterns: []
  # e.g.:
  #   - "Always ends with a wellness greeting"
  #   - "Tends to start first sentence as a question"
  #   - "Frequently uses conjunctions like 'actually', 'however'"

  representative_sentences: []
  # 5~7 sentences that best represent the writer's voice

  do_not:
  # Anti-patterns the writer never uses
  # e.g.:
  #   - "Never uses emojis or internet slang"
  #   - "Never disparages or compares with other clinics"
  #   - "Avoids exaggerated expressions ('groundbreaking', 'amazing', etc.)"

# === Data Quality ===
data_quality:
  blog_count: 0
  blog_with_substance: 0  # posts with >200 chars content
  quality_tier: ""  # "thin" | "adequate" | "rich"
  supplemented_by: []  # ["reference_site", "user_input", "competitor_analysis"]

# === Reference Context (if /collect-references was run) ===
reference_context:
  existing_site_tone: ""
  competitor_gaps: []  # services competitors emphasize that we lack
  design_direction: ""  # from design refs or competitor analysis
  programs_from_references: []  # program candidates from existing/competitor sites
```

### Step 4.5 — Initialize pipeline context

Create/update the pipeline context for downstream skills:

```yaml
# .agent/pipeline-context.yaml
# Accumulates through the content pipeline. Each skill reads + updates its section.

extraction:
  blog_count: {N}
  blog_with_content: {M}
  place_data: {true/false}
  place_reviews_count: {N}
  clinic_name: ""
  sufficiency:
    blog: ""      # thin | adequate | rich
    place: ""     # missing | partial | ok
    images: ""    # none | few | adequate
    overall: ""   # ready | needs-supplement | insufficient

references:
  has_existing_site: {true/false}
  competitor_count: {N}
  design_ref_count: {N}

analysis:
  specialties: []
  specialty_count: {N}
  writer_persona_quality: ""  # none | thin | adequate | rich
  suggested_programs: {N}
  completed_at: "{ISO date}"
```

Save to `.agent/pipeline-context.yaml`.

### Step 5 — Onboarding state sync

After generating style-card.yaml and pipeline-context.yaml, mark the onboarding feature as done.
This runs regardless of entry point (demo, delegated, onboarding, standalone).

```bash
npm run onboarding:done -- --feature=content-analysis --note="analyze-content completed"
```

> Skip silently if onboarding-state.json doesn't exist.

### Step 6 — Report

```
📊 Content Analysis Results

Blog: {N} posts analyzed
  Key keywords: Chuna(15), Pain(12), Rhinitis(8), Digestive(6)
  Program candidates: 4-5

Card text: {N} images extracted
  Headlines {N}, Credentials {N}

Tone & manner:
  Professional yet warm tone. Balance of Korean medicine tradition and modern approach.

Writer persona:
  Style: Formal polite, respectful yet approachable
  Structure: Symptom empathy → Cause → Treatment → Visit CTA
  Signature: Question-style openings, technical terms + simple explanations
  Representative: "When your back hurts, daily life falls apart."

Generated files:
  .agent/style-card.yaml

Recommended next steps:
  → /discover-edge (strength discovery + positioning)
  → /write-blog (write new blog posts in this persona)
```

## Output

- `.agent/style-card.yaml` — Tone & manner + program candidates + copy materials + **writer persona** + data quality + reference context
- `.agent/pipeline-context.yaml` — Pipeline context for downstream skills (extraction + references + analysis sections)

## Used By

- `/discover-edge` — references tone, USP
- `/write-copy` — references tone, headlines, persona
- `/write-blog` — **reproduces writer's voice via writer_persona**
- `/plan-content` — references keywords, programs
- `/setup-homepage` — references credentials, copy_materials
- `/frontend-code` — references mood, space (design direction)

## Triggers

- "콘텐츠 분석", "블로그 분석", "키워드 분석"
- "톤앤매너", "스타일카드", "기획 재료"
- "페르소나 분석", "글쓰기 스타일 분석"

## All user-facing output in Korean.
