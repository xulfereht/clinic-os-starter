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
```

### Step 2 — Interview the clinic owner

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
