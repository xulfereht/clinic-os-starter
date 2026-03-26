# /plan-content — Web Content Planning

> **Role**: Web Content Strategist
> **Cognitive mode**: Plan content structure, page composition, and editorial direction for any web surface.

Used during onboarding (full site planning) and ongoing operations (new programs, blog strategy, landing pages, campaigns).

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

## Procedure

### Step 1 — Gather inputs

```bash
cat .agent/edge-profile.yaml 2>/dev/null
cat .agent/style-card.yaml 2>/dev/null
cat public/local/assets/asset-metadata.json 2>/dev/null | \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); \
  console.log(JSON.stringify(d.summary, null, 2))"
```

### Step 2 — Plan by mode

#### Mode: `site` (onboarding)

Plan full site structure based on edge-profile + style-card:

```yaml
# .agent/content-plan.yaml

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

#### Mode: `program`

Plan a single new program page:

```
Input: "소아성장 프로그램 추가하고 싶어요"

Output:
  slug: pediatric-growth
  angle: (from edge-profile or new interview)
  sections: [hero, problem, mechanism, solution, doctor_intro, faq]
  copy_direction: "성장기 아이의 건강한 발달을 돕습니다" 계열
  image_needs: Hero 1, Mechanism 1 → /generate-scenes
  blog_topics: ["소아 성장 한방치료", "성장판 검사", ...]
```

#### Mode: `blog-strategy`

Plan blog content strategy:

```
Output:
  topic_clusters:
    - cluster: "추나/체형교정"
      existing: 15 posts
      gaps: ["추나 치료 주기", "교정 전후 관리"]
      target: 2 posts/month

    - cluster: "비염"
      existing: 8 posts
      gaps: ["소아 비염", "환절기 관리"]
      target: 1 post/month

  aeo_targets: ["OO동 한의원", "추나요법 효과", ...]
  posting_cadence: 주 1회 권장
```

#### Mode: `landing`

Plan a single landing page for a campaign:

```
Input: "봄철 비염 캠페인 랜딩페이지"

Output:
  structure: Hero → Problem → Solution → Testimonial → CTA
  copy_direction: 계절성 소구, 긴급성
  cta: "비염 상담 예약"
  implementation: _local/ page or custom-homepage override
```

#### Mode: `content-audit`

Review existing content for gaps and improvements:

```
Output:
  total_pages: 4 programs, 45 blog posts, 1 homepage
  gaps: FAQ 미작성, 후기 페이지 미활용, AEO 콘텐츠 부족
  improvements: 블로그 카테고리 미매핑 16건, featured_image 누락 22건
  consolidation: 유사 주제 블로그 3쌍 → 통합 추천
```

### Step 3 — Present and confirm

Show the plan with clear next steps:

```
📋 콘텐츠 기획안 (site 모드)

홈페이지: editorial 프리셋
  Hero(엣지 강조) → Highlights → Credentials → Narrative → Programs → DoctorIntro

프로그램 4개:
  1. 추나/체형교정 — "바른 체형, 건강한 삶" (15 blog posts)
  2. 비염치료 — "코가 편해야 삶이 편합니다" (8 posts)
  3. 소화기 — "속이 편해야 일상이 편합니다" (6 posts)
  4. 일반진료 — 기타 (16 posts)

이미지: 실물 13장, AI 필요 9장
카피: /write-copy로 작성 → /review-compliance 검토

이 기획으로 진행할까요?
```

### Step 4 — Save

```bash
# Save to .agent/content-plan.yaml
# Referenced by /write-copy, /setup-homepage, /setup-programs, etc.
```

## Output

- `.agent/content-plan.yaml` — content plan (mode-specific sections)

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
