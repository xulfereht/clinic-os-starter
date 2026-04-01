# /write-copy — Marketing Copy Writing

> **Role**: Copywriter
> **Cognitive mode**: Write compelling, on-brand copy for this clinic. Every word serves the edge profile and speaks to the target patient.

This skill writes copy for any clinic marketing surface — homepage, programs, blog, campaigns, announcements, social posts.

## When to Use

- When homepage hero copy, program descriptions, or CTA text is needed
- After `/discover-edge` provides positioning and messaging direction
- When preparing blog drafts, campaign messages, or social posts
- Before `/setup-homepage` or `/setup-programs` (copy feeds into these)
- When refreshing or improving existing marketing text

## Data Sources

- `.agent/edge-profile.yaml` — edge, target, positioning, message direction (from /discover-edge)
- `.agent/style-card.yaml` — tone & manner, keywords
- `.agent/references.yaml` — competitor copy for differentiation (from /collect-references)
- `.agent/pipeline-context.yaml` — data quality and pipeline state
- `.agent/site-plan.yaml` — program blog_post_ids and content_seeds for copy source
- `site_settings` DB — clinic name, contact, hours
- Existing content in DB — for consistency
- **`docs/SECTION_SCHEMAS.md`** — **MUST READ when writing `program` or `homepage` type copy.** Section content you produce flows into setup-programs/setup-homepage as-is. Wrong JSON structure = broken rendering.

## Procedure

### Step 1 — Determine copy type

Ask or detect what needs to be written:

| Type | Output | Reference |
|------|--------|-----------|
| `homepage` | Hero copy, highlights, narrative, CTA | edge-profile → hero_direction |
| `program` | Program title, description, section copy, FAQ | edge-profile → program_angles |
| `blog` | Blog post draft from clinic data | edge-profile → tone, keywords |
| `campaign` | SMS/KakaoTalk campaign message | edge-profile → target, pain_points |
| `announcement` | Cafe/community post | edge-profile → positioning |
| `social` | Short-form social media copy | edge-profile → one_liner |

### Step 2 — Load context

```bash
cat .agent/edge-profile.yaml
cat .agent/style-card.yaml 2>/dev/null

# References and pipeline context
cat .agent/references.yaml 2>/dev/null
cat .agent/pipeline-context.yaml 2>/dev/null

# Site plan with blog deep links
cat .agent/site-plan.yaml 2>/dev/null
```

### Step 3 — Write copy

**Homepage hero example:**
```
Input (edge-profile):
  primary_edge: "Chuna specialist, musculoskeletal focus"
  hero_direction: "Aligned body, healthy life"
  target: "30-50s office workers with chronic pain"

Output:
  badge: "Musculoskeletal Specialist Clinic"
  title: "A balanced body creates a healthy life"
  description: "We find the root cause of chronic pain in postural imbalance.\nWith a systematic program combining chuna therapy and Korean medicine,\nescape daily discomfort."
  cta: "Book a Consultation"
```

**Program copy example:**
```
Input:
  program: "Chuna/Posture Correction"
  angle: "Root correction, data-driven"
  target_pain: "Chronic back pain, forward head posture"

Output:
  Hero title: "Chuna/Posture Correction"
  Hero description: "Recurring pain may be a posture problem..."
  Problem cards: ["Back hurts when sitting", "Forward head posture getting worse", ...]
  Mechanism: "3-step program: Posture analysis → Corrective treatment → Maintenance"
  FAQ: [Q&A pairs based on blog content]
```

**Blog content as copy source:**
- Read `site-plan.yaml` → each program's `blog_post_ids` and `content_seeds`
- For programs with blog coverage, use the doctor's actual language from blog posts:
  - Problem section cards → symptoms and concerns mentioned in blogs
  - Mechanism section → treatment explanations from blog content
  - FAQ items → questions patients ask (extract from blog context)
- Use `writer_persona.representative_sentences` from style-card.yaml to match tone
- For programs WITHOUT blog coverage (`blog_coverage: "thin"`), use generic but on-brand copy

**Reference-aware differentiation:**
- If competitors exist in references.yaml, ensure our copy takes a different angle
- If competitor hero says "{X}", our hero should avoid similar phrasing
- Note competitive gaps we can exploit in copy

### Step 4 — Tone check

Every piece of copy must match:
- Tone from edge-profile (professional / warm / trustworthy, etc.)
- Brand mood from style-card
- Clinic-specific expressions (reference how the doctor actually writes in their blog)

**Prohibited:**
- Exaggerated marketing tone ("Amazing!", "Revolutionary!", "Groundbreaking!")
- Expressions that may violate medical advertising law → hand off to /review-compliance
- Writing style the doctor does not actually use

### Step 5 — Present and iterate

```
✍️ Copy Draft

[Hero]
  Badge: Musculoskeletal Specialist Clinic
  Title: A balanced body creates a healthy life
  Description: We find the root cause of chronic pain in postural imbalance.
  CTA: Book a Consultation

[Chuna/Posture Correction Program]
  Hero: "Recurring pain may be a posture problem"
  Problem: 3 cards
  ...

Please review and let me know what to change.
⚠️ Run /review-compliance if medical advertising review is needed.
```

## Output

- Copy text ready to be used by /setup-homepage, /setup-programs, or any content surface
- Stored in `.agent/site-plan.yaml` (homepage/program copy fields)

## Used By

- `/setup-homepage` — hero, narrative, highlights copy
- `/setup-programs` — program descriptions, FAQ, section copy
- Marketing content creation (blog, campaign, announcement)

## Medical Compliance Auto-Check

**Must run after copy writing is complete, before delivering to user.**
Reference: Medical Act Article 56, Ministry of Health and Welfare Medical Advertising Guidelines (2nd ed.), Korean Medical Association Advertising Review Standards.

### "Specialist" Claim Rules (Korean Medicine)

The Korean medicine specialist system exists (8 specialties: Internal Korean Medicine, Korean OB/GYN, Korean Pediatrics, Korean Neuropsychiatry, Acupuncture & Moxibustion, Korean Ophthalmology/ENT/Dermatology, Korean Rehabilitation Medicine, Sasang Constitutional Medicine).

| Situation | Allowed? | Example |
|-----------|----------|--------|
| Has specialist qualification + displays specialty | ✅ Allowed | "Korean Rehabilitation Medicine Specialist" |
| Claims "OO specialist" without qualification | ❌ Violation | "Traffic Accident Specialist", "Infertility Specialist" |
| Implied specialist expressions like "OO expert" | ❌ Violation | Misleading as specialist |

**When writing**: If the doctor holds specialist qualification, the specific specialty can be stated. Without qualification, use "OO-focused practice" or "OO-centered care" instead.

### Prohibited Pattern Checklist

| Violation Pattern | Correction Direction | Severity |
|-------------------|---------------------|----------|
| "OO specialist" (without qualification) | "OO-focused practice" / "OO-centered care" | 🔴 |
| "Complete cure", "100% effective", "Guaranteed" | Remove or use "aims to improve" | 🔴 |
| "Best", "First", "Only", "Top in Korea" | Remove — objectively unverifiable | 🔴 |
| Guaranteed treatment efficacy ("cures~", "eliminates~") | "helps with~", "supports~" | 🔴 |
| Comparative advertising ("unlike other clinics", "what Western medicine couldn't fix") | Describe own strengths only, remove comparisons | 🔴 |
| Academic "recognized/confirmed/proven" | "Published in" / "Reported in" | 🔴 |
| Legally unfounded titles/credentials | Remove — accredited qualifications only | 🔴 |
| Fear-inducing assertions ("it will become chronic if~") | "it may become~" | 🟡 |
| "Essential", "core" (exaggeration) | "Commonly utilized" | 🟡 |
| "Verified" (unclear standard) | "Carefully selected" or state specific criteria | 🟡 |

### Execution Method

Scan the entire written copy against the patterns above.
If 🔴 items are found, fix them before delivering.
For 🟡 items, recommend correction and give the user the choice.
When correcting, include the note "Adjusted to comply with medical advertising regulations" with the changes shown.

> Reference: Medical Act Article 56, Ministry of Health and Welfare Medical Advertising Guidelines (2nd ed., 2025), Korean Medical Association Advertising Review (ad.akom.org)

## Onboarding State Sync

After copy is written and confirmed by user, mark the onboarding feature as done.
This runs regardless of entry point (demo, delegated, onboarding, standalone).

```bash
npm run onboarding:done -- --feature=copy-writing --note="write-copy completed"
```

> Skip silently if onboarding-state.json doesn't exist.

## Triggers

- "카피 써줘", "문구 만들어줘", "히어로 카피"
- "프로그램 설명", "블로그 초안", "캠페인 문구"
- "홈페이지 문구", "광고 문구"

## Pipeline Context Update

Update `.agent/pipeline-context.yaml`:
```yaml
copy:
  homepage_copy_written: true
  program_copy_count: {N}
  blog_sourced: true  # copy was informed by actual blog content
  completed_at: "{ISO date}"
```

## All user-facing output in Korean.
