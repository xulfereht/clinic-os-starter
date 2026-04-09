# /align-programs

**Verify program/content alignment with tacit-product.yaml (7-axis)**

## Triggers

- 월 1회 정기 콘텐츠 검토 — "이번 달 콘텐츠가 우리 방향성과 맞나?"
- `/extract-tacit-product` 업데이트 후 — 기존 프로그램이 새 tacit과 정렬되는지 확인
- 신규 프로그램/카피 작성 전 사전 검증 (`--preview`)
- "콘텐츠가 점점 흐려지는 것 같아요" — 드리프트 의심될 때

 tacit-product.yaml의 7축 암묵지를 기준으로 기존 프로그램/콘텐츠의 정렬 상태를 검증하고, 불일치 항목을 감지 및 수정 제안합니다.

## Scope

- **Type:** skill
- **Scope:** local (client repo only)
- **Tier:** 4-5 (post-tacit-extraction)
- **Input:** tacit-product.yaml + programs DB data
- **Output:** `.agent/alignment-report.yaml`

## When to Use

1. **주기적 검증** — 월 1회 프로그램 콘텐츠 정렬 상태 체크
2. **tacit 업데이트 후** — `/extract-tacit-product` 완료 후 기존 프로그램 검증
3. **신규 콘텐츠 작성 전** — draft 콘텐츠가 tacit 기준에 맞는지 사전 검증
4. **콘텐츠 드리프트 의심** — "우리 메시지가 흐려진 것 같다"는 느낌이 들 때

## Prerequisites

```bash
# 필수 선행 데이터 확인
REQUIRED=(".agent/tacit-product.yaml")
for f in "${REQUIRED[@]}"; do
  [ -f "$f" ] || { echo "⚠️ $f 없음. 먼저 /extract-tacit-product 실행 필요"; exit 1; }
done
```

## Execution Modes

### Mode 1: Full Alignment Check (기본)
모든 프로그램을 7축 기준으로 전수 검증:

```bash
/align-programs
```

### Mode 2: Tacit Update Verification
tacit-product.yaml 업데이트 후 기존 프로그램 검증:

```bash
/align-programs --since-tacit-update
```

### Mode 3: Preview (신규 콘텐츠 사전 검증)
작성 중인 콘텐츠가 tacit 기준에 맞는지 미리 확인:

```bash
/align-programs --preview "{draft_content}"
```

### Mode 4: Single Program Check
특정 프로그램만 상세 검증:

```bash
/align-programs --program "digestive-health"
```

## 7-Axis Alignment Rules

### Axis 1: Product Definition
**tacit 필드:** `definition.core_offering`, `definition.clinical_target`

**검증 패턴:**
- 프로그램 설명에 `core_offering` 키워드 포함 여부
- `clinical_target` (급성+만성) 메시지 반영 여부

**Mismatch 예시:**
```yaml
# tacit:
definition:
  core_offering: "체질 맞춤 한약"
  clinical_target: "급성 증상+만성 체질 개선 동시 추구"

# program (❌):
description: "일반적인 피로회복 프로그램입니다."  # '체질' 언급 없음

# program (⚠️):
description: "피로를 개선하는 한약 프로그램입니다."  # '맞춤'은 있지만 '체질' 없음
```

**Scoring:**
- 1.0: 핵심 키워드 모두 포함
- 0.5-0.8: 일부 키워드 포함
- <0.5: 핵심 메시지 누락

---

### Axis 2: Clinical Philosophy
**tacit 필드:** `clinical_framework.constitution_system`, `clinical_framework.diagnosis_depth`

**검증 패턴:**
- 체질 분류 시스템 언급 (사상의학/8체질/커스텀)
- 진단 깊이 반영 (설진+맥진+과거력 종합)

**Mismatch 예시:**
```yaml
# tacit:
clinical_framework:
  constitution_system: "사상의학 + 한의학회 표준 진단"
  diagnosis_depth: "설진(혀)→맥진(맥)→증상→과거력→생활패턴 종합"

# program (❌):
description: "증상에 따른 처방을 드립니다."  # 체질 진단 언급 없음

# program (⚠️):
description: "체질을 고려한 처방을 드립니다."  # '사상의학' 특정 언급 없음
```

**Scoring:**
- 1.0: constitution_system + diagnosis_depth 모두 반영
- 0.5-0.8: 체질 언급 있으나 구체성 부족
- <0.5: 체질/진단 철학 누락

---

### Axis 3: Personalization Strategy
**tacit 필드:** `personalization.axes[]`

**검증 패턴:**
- 개인화 축 언급 (나이/성별/체형/직업/생활패턴)
- 구체적 조정 전략 언급

**Mismatch 예시:**
```yaml
# tacit:
personalization:
  axes:
    - dimension: "체형/기초대사"
      strategy: "동일 증상도 BMI/근력에 따라 용량 30~50% 조정"

# program (❌):
description: "모든 환자에게 같은 처방을 드립니다."  # 개인화 없음

# program (⚠️):
description: "개인별로 처방을 조정합니다."  # 구체적 축 언급 없음
```

**Scoring:**
- 1.0: 2+ 개인화 축 구체적 언급
- 0.5-0.8: 1개 축 언급 또는 일반적 개인화 표현
- <0.5: 개인화 전략 누락

---

### Axis 4: Positioning
**tacit 필드:** `positioning.vs_supplement.claim`, `positioning.vs_peer_clinics.claim`

**검증 패턴:**
- vs_supplement 메시지 (보건용품과의 차별점)
- vs_peer_clinics 메시지 (경쟁 한의원과의 차별점)

**Mismatch 예시:**
```yaml
# tacit:
positioning:
  vs_supplement:
    claim: "보건용품은 '유지용' vs 우리는 '복구용'"
  vs_peer_clinics:
    claim: "시간 의존 처방(체질 변화 추적) vs 일회성 처방"

# program (❌):
description: "건강을 지키는 프로그램입니다."  # 차별점 없음

# program (⚠️):
description: "다른 곳과 다른 맞춤 처방입니다."  # 구체적 차별점 부재
```

**Scoring:**
- 1.0: vs_supplement + vs_peer 모두 반영
- 0.5-0.8: 한쪽만 반영 또는 일반적 차별화
- <0.5: 포지셔닝 메시지 누락

---

### Axis 5: Communication Design
**tacit 필드:** `communication.intake.hook`, `communication.education.goal`

**검증 패턴:**
- intake hook (맞춤설계 프레임)
- education goal (약이 '도구'로 인식)

**Mismatch 예시:**
```yaml
# tacit:
communication:
  intake:
    hook: "체질 테스트 간단한 설명 + '당신만의 처방' 느낌"
  education:
    goal: "약이 '약'이 아니라 '몸 복구 도구'로 인식"

# program (❌):
description: "병을 치료하는 프로그램입니다."  # 전통적 질병중심 표현

# program (⚠️):
description: "당신에게 맞는 치료를 제공합니다."  # hook 반영되었으나 education goal 약함
```

**Scoring:**
- 1.0: hook + education goal 모두 반영
- 0.5-0.8: 한쪽만 반영
- <0.5: 커뮤니케이션 프레임 누락

---

### Axis 6-7: Evolution, Productization
**주의:** 프로그램별 검증 대상 아님

**적용 대상:**
- About 페이지 (제형 진화 이력)
- 클리닉 소개 (프로덕트화 전략)

**검증 방식:** `/align-programs --scope clinic-info` (선택적)

## Execution Steps

### Step 1: Load Tacit Product
```yaml
# .agent/tacit-product.yaml 로드
# 7축 데이터 추출
tacit_axes:
  definition: {...}
  clinical_framework: {...}
  personalization: {...}
  positioning: {...}
  communication: {...}
```

### Step 2: Fetch Programs from DB
```sql
-- programs 테이블 쿼리
SELECT
  id, slug, title, description,
  sections -- JSON (hero, problem, solution, etc.)
FROM programs
WHERE is_active = 1;
```

### Step 3: Per-Program Analysis
각 프로그램에 대해:

1. **Extract text content** — title + description + sections 텍스트 추출
2. **Keyword matching** — tacit 키워드 포함 여부 체크
3. **Semantic alignment** — LLM을 활용한 의미론적 정렬 평가
4. **Score calculation** — 축별 0.0-1.0 점수 산정
5. **Issue detection** — 임계값(0.7) 미만 항목 플래그

### Step 4: Generate Suggestions
불일치 항목에 대한 수정 제안:

```yaml
suggestion_template:
  axis: "definition"
  current: "{현재 텍스트}"
  expected: "{tacit 기준}"
  rewrite: "{제안 수정본}"
  rationale: "{왜 이게 중요한지}"
```

### Step 5: Output Report
```yaml
# .agent/alignment-report.yaml 생성

generated_at: "2026-04-05T15:00:00+09:00"
clinic_id: "..."
tacit_version: "1.0"

summary:
  total_programs: 8
  aligned: 5
  needs_review: 2
  critical: 1
  overall_alignment_score: 0.78

programs:
  - program_id: "digestive-health"
    program_title: "소화건강 클리닉"
    alignment_score: 0.45
    axis_scores:
      definition: 0.3
      clinical_framework: 0.5
      personalization: 0.4
      positioning: 0.3
      communication: 0.8
    issues:
      - axis: definition
        severity: critical
        current: "소화불량을 개선하는 프로그램입니다."
        expected: "체질 기반 脾氣虛 치료"
        suggestion: "'체질'과 '脾氣虛' 언급 추가"
        suggested_rewrite: "太陰人 체질의 脾氣虛를 개선하는 맞춤 한약 프로그램입니다."

recommendations:
  immediate:
    - "digestive-health: definition 축 critical 수정 필요"
  scheduled:
    - "2주 후 전체 재검증"
```

## Severity Levels

| Level | 기준 | Action |
|-------|------|--------|
| **critical** | 핵심 메시지(total 불일치), score < 0.4 | 즉시 수정 권고 |
| **warning** | 중요 요소 부족, score 0.4-0.7 | 검토 후 수정 권장 |
| **info** | 미세한 차이, score 0.7-0.85 | 참고용, 선택적 개선 |
| **aligned** | 충분히 정렬됨, score ≥ 0.85 | 변경 불필요 |

## Output Files

### alignment-report.yaml
경로: `.agent/alignment-report.yaml`

**용도:**
- 콘텐츠 검토 시 우선순위 결정
- `/setup-programs` 수정 시 참조
- 월간 콘텐츠 회의 자료

**보관:**
- 최신 버전만 유지 (덮어쓰기)
- 히스토리 필요시 수동 백업

## Usage Patterns

### Pattern 1: Monthly Review
```
매월 첫째 주:
1. /align-programs
2. critical 항목 즉시 수정
3. warning 항목 검토 후 수정
4. alignment-report.yaml 팀 공유
```

### Pattern 2: Pre-Publish Check
```
신규 프로그램/카피 작성 시:
1. /align-programs --preview "{draft}"
2. alignment score 확인
3. < 0.7이면 tacit 기준으로 재작성
4. ≥ 0.7이면 발행
```

### Pattern 3: Post-Tacit Update
```
/extract-tacit-product 완료 (v1.0 → v1.1):
1. tacit-product.yaml 변경사항 확인
2. /align-programs --since-tacit-update
3. 영향받은 프로그램 목록 확인
4. 순차적 수정
```

## Integration with Other Skills

| Skill | Relationship |
|-------|-------------|
| `/extract-tacit-product` | **입력 제공** — tacit-product.yaml 생성 |
| `/setup-programs` | **출력 소비** — alignment-report 기반 수정 |
| `/write-copy` | **사전 검증** — --preview 모드로 사용 |
| `/discover-edge` | **보조 입력** — edge-profile과 비교 가능 |

## Example Report Interpretation

**Case: Good Alignment**
```yaml
program: "sleep-clinic"
alignment_score: 0.92
# → 수정 불필요, 현재 상태 유지
```

**Case: Needs Review**
```yaml
program: "digestive-health"
alignment_score: 0.45
axis_scores:
  definition: 0.3      # ⚠️ 핵심 메시지 불일치
  positioning: 0.3     # ⚠️ 차별점 부재
# → definition, positioning 축 집중 수정
```

**Case: Critical Drift**
```yaml
program: "general-health"
alignment_score: 0.25
# → 전면 재검토 필요. tacit과 전혀 다른 방향.
# → 프로그램 아카이브 또는 전체 재작성 고려
```

## Troubleshooting

| Issue | Cause | Resolution |
|-------|-------|------------|
| "tacit-product.yaml not found" | 선행 스킬 미실행 | `/extract-tacit-product` 먼저 실행 |
| All scores 1.0 (suspicious) | tacit이 너무 generic | tacit-product.yaml 구체성 재검토 |
| All scores < 0.5 | major drift | 클리닉 방향성 재확인 필요 |
| DB connection error | wrangler 미설정 | `npm run setup:step` 재실행 |

## Verification

After completion:

1. **Report generated:** `ls .agent/alignment-report.yaml`
2. **Valid YAML:** `yq '.' .agent/alignment-report.yaml` (parses correctly)
3. **Summary populated:** Check summary.total_programs > 0
4. **Scores in range:** All scores 0.0-1.0

## References

- `/extract-tacit-product` 스킬: `.claude/commands/extract-tacit-product.md`
- tacit-product.yaml 스키마: `specs/SPEC-20260405-extract-tacit-product-skill.md`
- 7축 프레임워크: `~/.claude/projects/-Users-mua-projects-clinic-os/memory/skill_design_implicit_knowledge_extraction.md`
