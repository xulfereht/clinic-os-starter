# /extract-tacit-product

**Extract practitioner's implicit product knowledge (7-axis)**

## Triggers

- "콘텐츠에 결(骨)이 없는 것 같아요" — 일반적인 카피, 원장의 철학이 안 느껴질 때
- "다른 한의원이랑 뭐가 다른지 모르겠어요" — 차별점이 모호할 때
- 블로그/프로그램 내용이 제품 실제와 다른 것 같을 때
- `/analyze-content` + `/discover-edge` 완료 후 콘텐츠 '결' 결정이 필요할 때

원장의 제품/임상 설계 철학을 7축으로 체계적으로 추출하여 clinic-specific한 콘텐츠 기반을 마련합니다.

## Scope

- **Type:** skill
- **Scope:** local (client repo only)
- **Tier:** 4-5 (post-launch, requires clinic-profile + style-card + discover-edge)
- **Input:** Practitioner interview (structured Q&A, voice or text)
- **Output:** `.agent/tacit-product.yaml`

## When to Use

- Clinic-profile과 style-card가 완성된 후
- Discover-edge로 텍스트 기반 포지셔닝을 했지만 "결"이 부족할 때
- 원장의 임상 철학/제품 설계가 콘텐츠에 반영되지 않는다고 느낄 때
- 백록담 사례처럼 제품 사실 오류가 의심될 때

## Prerequisites

```bash
# 필수 선행 데이터 확인
REQUIRED=(".agent/clinic-profile.json" ".agent/style-card.yaml")
for f in "${REQUIRED[@]}"; do
  [ -f "$f" ] || { echo "⚠️ $f 없음. 선행 스킬 실행 필요: /extract-content, /analyze-content"; exit 1; }
done
```

## 7-Axis Framework

### Axis 1: Product Definition (프로덕트 정의)

**질문:**
1. "이 한약/처방은 어떻게 만드시나요? (재료선택 → 배합 → 추출 → 제형)"
2. "이 설계가 다른 곳과 달라지는 이유가 뭐예요?"
3. "이 처방으로 뭘 목표로 하시나요? (증상 완화? 체질 개선? 장기 건강?)"

**Capture as:**
```yaml
definition:
  core_offering: ""
  manufacturing_logic: ""
  unique_design: ""
  clinical_target: ""
```

### Axis 2: Clinical Philosophy (의학적 근거 프레임)

**질문:**
1. "체질 분류를 어떻게 하세요? (사상의학? 8체질? 커스텀?)"
2. "증상만으로는 부족한 이유가 뭐예요?"
3. "이 환자는 뭘 기준으로 다른 환자와 다르게 처방하세요?"

**Capture as:**
```yaml
clinical_framework:
  constitution_system: ""
  diagnosis_depth: ""
  prescription_logic: ""
  evidence_source: ""
```

### Axis 3: Personalization Strategy (개인화 전략)

**질문:**
1. "두 환자가 같은 증상이라도 처방이 다른 경우가 있나요?"
2. "뭘 기준으로 그렇게 다르게 하세요? (나이? 성별? 직업? 체형?)"
3. "약의 강도나 속도는 어떻게 조정하나요?"

**Capture as:**
```yaml
personalization:
  axes:
    - dimension: ""
      variants: []
      strategy: ""
  implementation:
    timing: ""
    communication: ""
```

### Axis 4: Competitive Positioning (경쟁 포지셔닝)

**질문:**
1. "우리 한약이 보건용품(홍삼, 루테인 등)과 뭐가 다른가요?"
2. "양약과는요?"
3. "근처 다른 한의원은 어떻게 다르세요?"

**Capture as:**
```yaml
positioning:
  vs_supplement:
    claim: ""
    proof: ""
  vs_pharmaceutical:
    claim: ""
    proof: ""
  vs_peer_clinics:
    claim: ""
    proof: ""
```

### Axis 5: Patient Communication Design (환자 커뮤니케이션 프레임)

**질문:**
1. "환자한테 체질 설명을 어떻게 해요?"
2. "약을 먹게 할 때 뭘 강조하세요?"
3. "복약 거부할 때 어떤 말이 가장 먹히나요?"

**Capture as:**
```yaml
communication:
  intake:
    frame: ""
    hook: ""
  education:
    goal: ""
    tactics: []
  objection_handling: {}
```

### Axis 6: Formulation Evolution History (제형 진화 이력)

**질문:**
1. "이 약을 처음 만들 때부터 지금 형태인가요?"
2. "왜 이렇게 바뀌었어요?"
3. "환자 피드백이 반영된 사례가 있나요?"

**Capture as:**
```yaml
evolution:
  v1_initial:
    description: ""
    decision: ""
  v2_current:
    description: ""
    decision: ""
  future_consideration: ""
  feedback_loop: ""
```

### Axis 7: Productization & E-commerce Strategy (프로덕트화/이커머스 전략)

**질문:**
1. "환자가 직접 사갈 수 있도록 팔아요?"
2. "처방약 vs 일반의약품처럼 파나요?"
3. "온라인/오프라인 채널은요?"

**Capture as:**
```yaml
productization:
  model: ""
  prescription_only:
    channel: ""
    revenue: ""
    advantage: ""
  retail_expansion:
    channel: ""
    positioning: ""
    risk: ""
  current_strategy: ""
```

## Execution Steps

### Step 1: Setup

1. Verify prerequisites (clinic-profile.json, style-card.yaml)
2. Check pipeline-context.yaml for discover-edge completion
3. Prepare interview environment (voice recording or text input)

### Step 2: Conduct Interview

Present the 7-axis questions to the practitioner. For each axis:

1. **Ask the core questions** — Let practitioner speak freely
2. **Probe for specifics** — "예를 들어 어떤 환자가 있었나요?"
3. **Capture verbatim notes** — Keep original expressions
4. **Confirm understanding** — "그러니까 ~ 맞나요?"

**Interview modes:**
- **Sync:** Live voice conversation → real-time note capture
- **Async:** Recorded voice → transcript → structuring
- **Text:** Written responses → direct parsing

### Step 3: Parse & Structure

Use LLM to convert free-form responses to structured YAML:

```
Input: Verbatim interview notes
↓
LLM extracts key concepts per axis
↓
Map to YAML schema
↓
Validate completeness
```

### Step 4: Validation

For each axis, check:

| Check | Criteria |
|-------|----------|
| Completeness | All required fields populated |
| Specificity | Concrete examples, not generic claims |
| Consistency | No contradictions between axes |
| Actionability | Can be used in downstream copywriting |

**Confidence scoring:**
- 0.9-1.0: Rich detail, specific examples, clear logic
- 0.7-0.9: Good coverage, some gaps
- 0.5-0.7: Partial information, needs follow-up
- <0.5: Insufficient, re-interview recommended

### Step 5: Output Generation

Generate `.agent/tacit-product.yaml`:

```yaml
extracted_at: "2026-04-05T10:30:00+09:00"
clinic_id: "[from clinic.json]"
version: "1.0"
source: "practitioner interview"
confidence: 0.85
gaps: []

definition:
  core_offering: "..."
  manufacturing_logic: "..."
  unique_design: "..."
  clinical_target: "..."

clinical_framework:
  constitution_system: "..."
  diagnosis_depth: "..."
  prescription_logic: "..."
  evidence_source: "..."

personalization:
  axes:
    - dimension: "체질"
      variants: ["太陰人", "少陰人", "太陽人", "少陽人"]
      strategy: "..."
  implementation:
    timing: "..."
    communication: "..."

positioning:
  vs_supplement:
    claim: "..."
    proof: "..."
  vs_pharmaceutical:
    claim: "..."
    proof: "..."
  vs_peer_clinics:
    claim: "..."
    proof: "..."

communication:
  intake:
    frame: "..."
    hook: "..."
  education:
    goal: "..."
    tactics: [...]
  objection_handling:
    "비싼데요?": "..."
    "한약 맛이 안 좋아요": "..."

evolution:
  v1_initial:
    description: "..."
    decision: "..."
  v2_current:
    description: "..."
    decision: "..."
  future_consideration: "..."
  feedback_loop: "..."

productization:
  model: "처방 기반"
  current_strategy: "..."
```

### Step 6: Pipeline Integration

Update `pipeline-context.yaml`:

```yaml
tacit_product:
  status: complete
  last_updated: "2026-04-05T10:30:00+09:00"
  file: ".agent/tacit-product.yaml"
  confidence: 0.85
  axes_complete: [definition, clinical_framework, personalization, positioning, communication, evolution, productization]
  axes_gaps: []
```

## Downstream Usage

Skills that consume tacit-product.yaml:

| Skill | Uses | Section |
|-------|------|---------|
| /write-copy | positioning.claim, communication.hook | 메인 메시지 |
| /setup-homepage | positioning, communication | Hero/Problem 섹션 |
| /setup-programs | personalization.axes, definition | 프로그램 설명 |
| /discover-edge | clinical_framework, evolution | 차별화 포인트 보강 |

## Example: Baekrokdam Application

**Input (interview excerpt):**
> "우리 진청은 원재료 선별부터 다릅니다. 같은 황기라도 산지가 다르면 성분이 달라요. 배합 비율도 체질에 따라 조정하고, 추출 온도도 약재별로 다르게 설정했어요."

**Structured output:**
```yaml
definition:
  core_offering: "산지별 원재료 선별 + 체질 맞춤 배합 + 최적 추출 온도 진청"
  manufacturing_logic: "원재료 선별(산지/등급) → 체질별 배합 비율 조정 → 약재별 최적 추출 온도 → 진청 제형"
  unique_design: "동일 처방이라도 환자 체질에 따라 배합 비율 20-40% 조정"
  clinical_target: "체질 개선 기반 증상 완화"
```

## Verification

After completion:

1. **File check:** `ls .agent/tacit-product.yaml`
2. **Schema validation:** YAML parses correctly
3. **Completeness:** All 7 axes have non-empty values
4. **Consistency:** No contradictions with clinic-profile.json
5. **Confidence:** ≥ 0.75 recommended

## Troubleshooting

| Issue | Resolution |
|-------|------------|
| 원장이 설명을 못 함 | 구체적 사례 묻기: "최근 어떤 환자가 있었나요?" |
| 응답이 모호함 | 재질문: "~와 ~ 중에 어떤 게 더 가까운가요?" |
| 축 간에 모순 | LLM이 flag → 원장에게 확인 요청 |
| 정보 부족 | gaps[]에 기록 → follow-up interview 예약 |

## References

- Memory: `~/.claude/projects/-Users-mua-projects-clinic-os/memory/skill_design_implicit_knowledge_extraction.md`
- Baekrokdam case: `~/.claude/projects/-Users-mua-projects-baekrokdam-clinic/memory/project_tacit-knowledge-skill.md`
- Pipeline: `.agent/workflows/content-bootstrap.md`
