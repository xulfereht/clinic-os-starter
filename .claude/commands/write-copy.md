# /write-copy — Marketing Copy Writing

> **Role**: Copywriter
> **Cognitive mode**: Write compelling, on-brand copy for this clinic. Every word serves the edge profile and speaks to the target patient.

This skill writes copy for any clinic marketing surface — homepage, programs, blog, campaigns, announcements, social posts.

## Data Sources

- `.agent/edge-profile.yaml` — edge, target, positioning, message direction (from /discover-edge)
- `.agent/style-card.yaml` — tone & manner, keywords
- `.agent/references.yaml` — competitor copy for differentiation (from /collect-references)
- `.agent/pipeline-context.yaml` — data quality and pipeline state
- `.agent/site-plan.yaml` — program blog_post_ids and content_seeds for copy source
- `site_settings` DB — clinic name, contact, hours
- Existing content in DB — for consistency

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
  primary_edge: "추나 전문, 근골격 특화"
  hero_direction: "바른 체형, 건강한 삶"
  target: "30-50대 만성통증 직장인"

Output:
  badge: "근골격 특화 한의원"
  title: "바른 체형이 건강한 삶을 만듭니다"
  description: "만성 통증의 근본 원인, 체형 불균형에서 찾습니다.\n추나요법과 한방 치료를 결합한 체계적 프로그램으로\n일상의 불편함에서 벗어나세요."
  cta: "진료 상담 예약"
```

**Program copy example:**
```
Input:
  program: "추나/체형교정"
  angle: "근본 교정, 데이터 기반"
  target_pain: "만성 허리통증, 거북목"

Output:
  Hero title: "추나/체형교정"
  Hero description: "반복되는 통증, 자세의 문제일 수 있습니다..."
  Problem cards: ["앉아있으면 허리가 아프다", "거북목이 심해졌다", ...]
  Mechanism: "체형 분석 → 교정 치료 → 유지 관리 3단계 프로그램"
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
- Exaggerated marketing tone ("놀라운!", "혁신적!", "획기적!")
- Expressions that may violate medical advertising law → hand off to /review-compliance
- Writing style the doctor does not actually use

### Step 5 — Present and iterate

```
✍️ 카피 초안

[히어로]
  뱃지: 근골격 특화 한의원
  제목: 바른 체형이 건강한 삶을 만듭니다
  설명: 만성 통증의 근본 원인, 체형 불균형에서 찾습니다.
  CTA: 진료 상담 예약

[추나/체형교정 프로그램]
  Hero: "반복되는 통증, 자세의 문제일 수 있습니다"
  Problem: 3개 카드
  ...

검토 후 수정할 부분 말씀해주세요.
⚠️ 의료법 검토가 필요하면 /review-compliance를 실행합니다.
```

## Output

- Copy text ready to be used by /setup-homepage, /setup-programs, or any content surface
- Stored in `.agent/site-plan.yaml` (homepage/program copy fields)

## Used By

- `/setup-homepage` — hero, narrative, highlights copy
- `/setup-programs` — program descriptions, FAQ, section copy
- Marketing content creation (blog, campaign, announcement)

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
