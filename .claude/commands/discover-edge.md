# /discover-edge — 한의원 강점 발굴 + 포지셔닝

> **Role**: Marketing Strategist
> **Cognitive mode**: Find what makes this clinic unique. Define target patients, competitive positioning, and key messages.

This skill is used during onboarding (homepage planning) and anytime the clinic needs to articulate its edge — new programs, campaigns, content strategy.

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
| 차원           | 우리          | 경쟁A         | 경쟁B         |
|---------------|-------------|-------------|-------------|
| 핵심 프로그램   | (blog분석)   | (ref분석)    | (ref분석)    |
| 신뢰 시그널    | 블로그 N편   | 논문 N편     | 후기 N건     |
| 디자인 톤      | (미정)       | (ref분석)    | (ref분석)    |
| 타겟 환자층    | (인터뷰)     | (ref분석)    | (ref분석)    |
```

Use this matrix to identify:
- Open positioning slots (categories where no competitor dominates)
- Differentiation opportunities
- Must-have trust signals we're missing

### Step 2 — Interview the clinic owner

**Data sufficiency check**: Read `pipeline-context.yaml`. If `extraction.sufficiency.overall` is `needs-supplement` or `insufficient`, expand the interview with additional questions:

```
추가 질문 (데이터 보충):
7. 주요 진료 프로그램을 3-5개 나열해주세요
8. 원장님의 학력과 주요 경력은?
9. 진료 철학이나 치료 방침을 설명해주세요
```

If references have competitors, add competitive context to the interview:
```
참고로 주변 경쟁 한의원 분석 결과:
- {competitor_name}: {positioning} (강점: {strengths})

우리 한의원은 이와 비교했을 때 어떤 차별점이 있을까요?
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
one_liner: ""  # 한 문장 소개

edge:
  primary: ""      # 핵심 차별점 1개
  secondary: []    # 보조 차별점 2-3개
  credentials: []  # 자격/경력 중 강조할 것

target:
  primary_audience: ""   # 주 타겟 (예: "30-50대 직장인 만성통증")
  pain_points: []        # 타겟의 고민
  decision_factors: []   # 한의원 선택 기준

positioning:
  category: ""           # 어떤 카테고리에서 1등을 할 것인가
  versus: ""             # 대안 (양방, 다른 한의원, 자가관리)
  why_us: ""             # 왜 우리인가

messages:
  hero_direction: ""     # 히어로 카피 방향
  program_angles: {}     # 프로그램별 메시지 각도
  trust_signals: []      # 신뢰 시그널 (논문, 자격, 경력, 후기 수)

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
# .agent/edge-profile.yaml로 저장
# /write-copy, /plan-site, /setup-homepage가 이 파일을 참조
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

## Output

- `.agent/edge-profile.yaml` — 강점, 타겟, 포지셔닝, 메시지 방향

## Used By

- `/write-copy` — edge-profile 기반으로 실제 문구 작성
- `/plan-site` — 포지셔닝 기반 사이트 구조 결정
- `/setup-homepage` — 히어로/내러티브 콘텐츠
- Anytime marketing content is created (blog, campaign, announcement)

## Triggers

- "강점 분석", "우리 한의원 뭐가 강해?", "포지셔닝", "엣지"
- "타겟 환자", "차별점", "USP"
- "마케팅 전략", "어떤 메시지로 가야 해?"

## All user-facing output in Korean.
