# /plan-content — Web Content Planning

> **Role**: Web Content Strategist
> **Cognitive mode**: Plan content structure, page composition, and editorial direction for any web surface.

Used during onboarding (full site planning) and ongoing operations (new programs, blog strategy, landing pages, campaigns).

## When to Use

- During onboarding for full site structure planning (homepage + programs + blog)
- Adding a new treatment program and designing its page
- Planning blog content strategy with topic clusters and posting cadence
- Designing a campaign landing page
- Auditing existing content for gaps and improvement opportunities

## Modes

| Mode | When | Output |
|------|------|--------|
| `site` | Onboarding — full site planning | Homepage + programs + blog structure |
| `program` | Adding a new treatment program | Program page sections + copy direction |
| `blog-strategy` | Content calendar planning | Topic clusters, posting cadence, SEO/AEO targets |
| `landing` | Campaign landing page | Single-page structure + copy + CTA |
| `content-audit` | Reviewing existing content | Gaps, improvements, consolidation opportunities |

When called without a mode, default to `site` if during onboarding, otherwise ask.

## Data Sources

- `.agent/edge-profile.yaml` — positioning, target, USP (from /discover-edge)
- `.agent/style-card.yaml` — tone, keywords, copy materials (from /analyze-content)
- `public/local/assets/asset-metadata.json` — available images + gaps
- `site_settings` DB — current configuration
- Blog posts in DB — existing content inventory
- `.agent/references.yaml` — competitor/design references (from /collect-references)
- `.agent/pipeline-context.yaml` — accumulated pipeline context

## Procedure

### Step 1 — Gather inputs

```bash
cat .agent/edge-profile.yaml 2>/dev/null
cat .agent/style-card.yaml 2>/dev/null
# References and pipeline context
cat .agent/references.yaml 2>/dev/null
cat .agent/pipeline-context.yaml 2>/dev/null

# Available images (may not exist if /curate-images not run yet)
ls public/local/assets/ 2>/dev/null || echo "⚠️ No images — recommend running /curate-images first"

# Blog posts with content for program matching
# NOTE: posts.type is 'column' by default, 'blog' for imported posts
npx wrangler d1 execute DB --local --command \
  "SELECT id, title, category, LENGTH(COALESCE(content,'')) as clen FROM posts WHERE type IN ('blog','column') AND is_sample=0 AND LENGTH(COALESCE(content,'')) > 200 ORDER BY created_at DESC LIMIT 100;"
```

### Step 2 — Plan by mode

#### Mode: `site` (onboarding)

Plan full site structure based on edge-profile + style-card:

```yaml
# .agent/site-plan.yaml

homepage:
  preset: editorial  # or classic
  sections:
    - type: hero
      direction: ""  # from edge-profile.messages.hero_direction
    - type: highlights
      items: []  # from edge-profile.edge.secondary
    - type: credentials
      items: []  # from edge-profile.credentials
    - type: narrative
      steps: []  # problem → treatment → result
    - type: service_tiles
      programs: []
    - type: doctor_intro
    - type: youtube  # if available
    - type: home_info

programs:
  - name: ""
    slug: ""
    angle: ""  # from edge-profile.messages.program_angles
    sections: [hero, problem, mechanism, solution, doctor_intro, faq, related_posts]
    image_status: ""  # available / needs-generation

blog_strategy:
  categories: []  # mapped from program slugs
  existing_posts: 0
  topic_gaps: []  # programs without blog coverage

image_plan:
  available: 0
  needs_enhancement: 0  # → /enhance-portrait
  needs_generation: []  # → /generate-scenes
```

**Reference-informed planning** (if `.agent/references.yaml` exists):
- If design references suggest a hero style → recommend matching preset (editorial for fullscreen, classic for traditional)
- If existing site had programs → ensure all are represented in the plan (migration continuity)
- If competitors emphasize specific sections (credentials, YouTube) → include them if data available

**Blog → Program deep linking:**
For each planned program, query matching blog posts:
```bash
npx wrangler d1 execute DB --local --command \
  "SELECT id, title FROM posts WHERE type='blog' AND is_sample=0 AND (title LIKE '%{keyword}%' OR content LIKE '%{keyword}%') LIMIT 10;"
```

Include in site-plan.yaml per program:
```yaml
programs:
  - slug: "{slug}"
    name: ""
    angle: ""
    sections: [hero, problem, mechanism, solution, doctor_intro, faq, related_posts]
    blog_post_ids: [12, 15, 23]     # matched blog posts
    blog_coverage: ""               # "rich" (5+) | "adequate" (2-4) | "thin" (0-1)
    content_seeds: []               # key quotes/insights from matched blogs for section copy
    image_status: ""
```

**Readiness assessment:**
Before finalizing, check what data actually exists for each section:
```yaml
readiness:
  hero: ready              # has copy direction from edge-profile
  highlights: ready        # has edge.secondary
  credentials: skip        # no credential data → section auto-hides
  narrative: ready         # has treatment philosophy
  programs: partial        # 2 of 3 have blog content
  doctor_intro: blocked    # no doctor photo → flag for user
  youtube: skip            # no video URL
  notes: ["doctor photo needed for DoctorIntro section"]
```

#### Mode: `program`

Plan a single new program page:

```
Input: "I want to add a pediatric growth program"

Output:
  slug: pediatric-growth
  angle: (from edge-profile or new interview)
  sections: [hero, problem, mechanism, solution, doctor_intro, faq]
  copy_direction: "Supporting healthy development during growth years" theme
  image_needs: Hero 1, Mechanism 1 → /generate-scenes
  blog_topics: ["pediatric growth Korean medicine treatment", "growth plate exam", ...]
```

#### Mode: `blog-strategy`

Plan blog content strategy:

```
Output:
  topic_clusters:
    - cluster: "Chuna/Postural Correction"
      existing: 15 posts
      gaps: ["chuna treatment frequency", "pre/post correction care"]
      target: 2 posts/month

    - cluster: "Rhinitis"
      existing: 8 posts
      gaps: ["pediatric rhinitis", "seasonal management"]
      target: 1 post/month

  aeo_targets: ["OO-dong Korean medicine clinic", "chuna therapy effects", ...]
  posting_cadence: recommended 1 per week
```

#### Mode: `landing`

Plan a single landing page for a campaign:

```
Input: "Spring rhinitis campaign landing page"

Output:
  structure: Hero → Problem → Solution → Testimonial → CTA
  copy_direction: seasonal appeal, urgency
  cta: "Book a rhinitis consultation"
  implementation: _local/ page or custom-homepage override
```

#### Mode: `content-audit`

Review existing content for gaps and improvements:

```
Output:
  total_pages: 4 programs, 45 blog posts, 1 homepage
  gaps: FAQ not written, review page unused, AEO content insufficient
  improvements: 16 blog posts with unmapped categories, 22 missing featured_image
  consolidation: 3 pairs of similar-topic blogs → consolidation recommended
```

### Step 2.5 — Update pipeline context

Update `.agent/pipeline-context.yaml` planning section:
```yaml
planning:
  homepage_preset: ""
  program_count: {N}
  sections_planned: true
  readiness_issues: []  # sections that are "skip" or "blocked"
  blog_deep_linked: true
  completed_at: "{ISO date}"
```

### Step 3 — Present and confirm

Show the plan with clear next steps:

```
📋 Content Plan (site mode)

Homepage: editorial preset
  Hero (edge emphasis) → Highlights → Credentials → Narrative → Programs → DoctorIntro

4 Programs:
  1. Chuna/Postural Correction — "Proper posture, healthy life" (15 blog posts)
  2. Rhinitis Treatment — "Breathe easy, live easy" (8 posts)
  3. Digestive Health — "Comfortable stomach, comfortable life" (6 posts)
  4. General Treatment — misc (16 posts)

Images: 13 real photos, 9 need AI generation
Copy: Write with /write-copy → review with /review-compliance

Proceed with this plan?
```

### Step 4 — Save

```bash
# Save to .agent/site-plan.yaml
# Referenced by /write-copy, /setup-homepage, /setup-programs, etc.
```

## Output

- `.agent/site-plan.yaml` — content plan (mode-specific sections)

## Used By

- `/write-copy` — references copy direction from the plan
- `/setup-homepage` — references homepage section plan
- `/setup-programs` — references program plan
- `/generate-scenes` — references image needs
- `/content-calendar` — incorporates blog strategy into delivery schedule

## Triggers

- "기획", "콘텐츠 기획", "사이트 기획", "블로그 전략"
- "프로그램 추가하고 싶어", "새 페이지 기획"
- "콘텐츠 현황 파악", "뭐가 부족해?"

## All user-facing output in Korean.
