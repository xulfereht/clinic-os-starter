# /discover-edge — Clinic Strengths Discovery + Positioning

> **Role**: Marketing Strategist
> **Cognitive mode**: Find what makes this clinic unique. Define target patients, competitive positioning, and key messages.

This skill is used during onboarding (homepage planning) and anytime the clinic needs to articulate its edge — new programs, campaigns, content strategy.

## When to Use

- During onboarding when defining the clinic's unique value proposition for the homepage
- When the clinic needs to articulate its strengths, target audience, or competitive positioning
- When planning marketing campaigns, content strategy, or new programs
- When competitive analysis data is available and you need to find open positioning slots

## Data Sources

- `.agent/style-card.yaml` — if /analyze-content was run (blog keywords, card copy, tone)
- `.agent/clinic-profile.json` — clinic basic info
- `site_settings` DB — current clinic configuration
- Blog posts in DB — what topics the doctor writes about
- Naver Place reviews — what patients say
- `.agent/references.yaml` — competitor analysis, existing site data (from /collect-references)
- `.agent/pipeline-context.yaml` — data quality and sufficiency info

## Procedure

### Step 1 — Gather raw materials

```bash
# Clinic profile
cat .agent/clinic-profile.json 2>/dev/null | head -c 1000

# Style card (if exists)
cat .agent/style-card.yaml 2>/dev/null

# Blog topics distribution
npx wrangler d1 execute DB --local --command \
  "SELECT category, COUNT(*) as cnt FROM posts WHERE type='blog' AND is_sample=0 GROUP BY category ORDER BY cnt DESC;"

# Doctor info
npx wrangler d1 execute DB --local --command \
  "SELECT name, title, bio FROM staff LIMIT 5;"

# References (if collected)
cat .agent/references.yaml 2>/dev/null

# Pipeline context
cat .agent/pipeline-context.yaml 2>/dev/null
```

### Step 1.5 — Competitive positioning analysis

If `.agent/references.yaml` has competitors, build a positioning matrix:

```
| Dimension        | Us            | Competitor A  | Competitor B  |
|-----------------|-------------|-------------|-------------|
| Core programs    | (blog analysis) | (ref analysis) | (ref analysis) |
| Trust signals    | N blog posts  | N papers     | N reviews    |
| Design tone      | (TBD)        | (ref analysis) | (ref analysis) |
| Target patients  | (interview)  | (ref analysis) | (ref analysis) |
```

Use this matrix to identify:
- Open positioning slots (categories where no competitor dominates)
- Differentiation opportunities
- Must-have trust signals we're missing

### Step 2 — Interview the clinic owner

**Data sufficiency check**: Read `pipeline-context.yaml`. If `extraction.sufficiency.overall` is `needs-supplement` or `insufficient`, expand the interview with additional questions:

```
Additional questions (data supplement):
7. List your 3-5 main treatment programs
8. What are the doctor's education and key career highlights?
9. Describe your treatment philosophy or approach
```

If references have competitors, add competitive context to the interview:
```
Based on competitor analysis:
- {competitor_name}: {positioning} (strengths: {strengths})

Compared to these, what differentiates our clinic?
```

Ask focused questions (only what's not already in the data):

```
다음 질문에 간단히 답해주세요:

1. 우리 한의원을 한 문장으로 소개한다면?
2. 환자분들이 우리 한의원에 오시는 가장 큰 이유는?
3. 다른 한의원과 비교했을 때 우리만의 차별점은?
4. 가장 자신 있는 진료 분야는?
5. 원장님의 특별한 경력이나 자격이 있다면?
6. 주 타겟 환자층은? (연령, 성별, 증상)
```

### Step 3 — Synthesize edge profile

Combine data + interview into a structured edge profile:

```yaml
# .agent/edge-profile.yaml

clinic_name: ""
one_liner: ""  # One-sentence introduction

edge:
  primary: ""      # Core differentiator (1)
  secondary: []    # Supporting differentiators (2-3)
  credentials: []  # Credentials/career to highlight

target:
  primary_audience: ""   # Primary target (e.g., "30-50s office workers with chronic pain")
  pain_points: []        # Target's concerns
  decision_factors: []   # Criteria for choosing a clinic

positioning:
  category: ""           # What category to be #1 in
  versus: ""             # Alternatives (Western medicine, other clinics, self-care)
  why_us: ""             # Why us

messages:
  hero_direction: ""     # Hero copy direction
  program_angles: {}     # Per-program message angles
  trust_signals: []      # Trust signals (papers, credentials, career, review count)

# === Competitive Context (if references analyzed) ===
competitive_context:
  analyzed_competitors: 0
  open_positioning_slots: []   # unclaimed positioning categories
  differentiation_from: []     # [{competitor, our_advantage}]
  must_have_signals: []        # trust signals competitors have that we should match
```

### Step 4 — Present and confirm

```
🎯 한의원 엣지 프로파일

핵심 강점: "추나 전문, 근골격 특화 — 교정 전후 변화를 데이터로 보여주는 한의원"

타겟: 30-50대 직장인, 만성 허리/목 통증, "이제 좀 제대로 치료받고 싶다"

포지셔닝: 동네 한의원이 아닌, 근골격 전문 클리닉
  vs 양방 정형외과: 수술 없이 근본 교정
  vs 다른 한의원: 체계적 프로그램 + 데이터 기반

히어로 방향: "바른 체형, 건강한 삶" 계열
신뢰 시그널: 대한추나의학회 정회원, 논문 3편, 블로그 45편

이 방향으로 카피를 잡을까요? 수정할 부분이 있으면 말씀해주세요.
```

### Step 5 — Save

```bash
# Save as .agent/edge-profile.yaml
# /write-copy, /plan-content, /setup-homepage reference this file
```

Update `.agent/pipeline-context.yaml` discovery section:
```yaml
discovery:
  edge_defined: true
  positioning_confirmed: {true/false}
  target_audience: ""
  competitive_analysis: {true/false}
  completed_at: "{ISO date}"
```

## Onboarding State Sync

`discover-edge` is a pipeline skill that feeds into downstream skills (write-copy, plan-content, setup-homepage).
It does not directly map to an onboarding feature — its value is captured when homepage/programs are set up.
No `onboarding:done` call needed here.

## Output

- `.agent/edge-profile.yaml` — strengths, target, positioning, message direction

## Used By

- `/write-copy` — writes actual copy based on edge-profile
- `/plan-content` — determines site structure based on positioning
- `/setup-homepage` — hero/narrative content
- Anytime marketing content is created (blog, campaign, announcement)

## Triggers

- "강점 분석", "우리 한의원 뭐가 강해?", "포지셔닝", "엣지"
- "타겟 환자", "차별점", "USP"
- "마케팅 전략", "어떤 메시지로 가야 해?"

## All user-facing output in Korean.
