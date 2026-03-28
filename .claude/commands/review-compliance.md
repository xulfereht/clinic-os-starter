# /review-compliance — Medical Advertising Compliance Review

> **Role**: Medical Advertising Compliance Reviewer
> **Cognitive mode**: Review all patient-facing copy for medical advertising law violations before publication.

This skill reviews ANY patient-facing text — homepage, programs, blog, campaigns, social posts, announcements. Run this before publishing anything externally.

## Scope

Korean medical advertising regulations (의료법 제56조, 의료광고 심의 기준):

### Must Check

| Category | Violation Examples | Correct Alternative |
|----------|-------------------|-------------------|
| **Comparison/Superlative** | "최고의", "최초", "유일한", "가장 뛰어난" | "전문", "특화", specific factual descriptions |
| **Guaranteed efficacy** | "완치", "100% 효과", "반드시 나아집니다" | "개선을 목표로", "도움이 될 수 있습니다" |
| **Before/after comparison** | Before/after procedure photos (restricted) | Treatment process explanation, staff photos |
| **Patient solicitation** | "무료 시술", "50% 할인", excessive giveaways | Fair pricing info, health information |
| **Disparagement** | "다른 한의원과 달리", "양방에서 못 고친" | Describe own strengths without comparison |
| **Credential exaggeration** | Unverifiable credentials, excessive modifiers | Objective facts only (degrees, societies, papers) |
| **Non-covered pricing** | Inaccurate pricing, discount emphasis | Exact pricing + "상담 시 안내" |
| **Patient testimonials** | Testimonials asserting treatment efficacy | Personal experience framing, no guarantee |
| **Title claims** | "명의", "신의", non-accredited titles | Accredited titles only (전문의, society member) |

### Severity Levels

| Level | Action |
|-------|--------|
| 🔴 **BLOCK** | Must fix before publishing. Legal risk. |
| 🟡 **WARN** | Recommend fixing. May be flagged during review. |
| 🟢 **PASS** | No issues. |

## Procedure

### Step 1 — Input

Review target can be:
- `/write-copy` output (homepage, program copy)
- Blog post draft
- Campaign message
- Any text before external publication

### Step 2 — Line-by-line review

Check every sentence against the violation categories above.

Output format:

```
🏥 의료광고 심의 검토 결과

검토 대상: 홈페이지 히어로 + 프로그램 카피

🔴 BLOCK (2건)
  Line: "만성통증을 완치합니다"
  → 효과 보장 표현. 수정: "만성통증 개선을 목표로 치료합니다"

  Line: "지역 최고의 추나 전문"
  → 최상급 비교 표현. 수정: "추나 특화 한의원"

🟡 WARN (1건)
  Line: "다른 치료에서 효과를 못 보셨다면"
  → 간접적 타 의료기관 비방 가능. 수정: "만성적인 불편함이 계속된다면"

🟢 PASS (15건)
  나머지 문구 — 문제 없음

총평: BLOCK 2건 수정 필요. 수정 후 재검토 권장.
```

### Step 3 — Auto-fix suggestion

Provide a concrete fix for each BLOCK/WARN item.
Verify that the suggested fix also passes the review rules.

### Step 4 — Re-review (if needed)

After fixes are applied, run `/review-compliance` again to confirm PASS.

## Integration

- Recommended to run automatically after `/write-copy` completes
- Verify copy has passed before `/setup-homepage` or `/setup-programs`
- Run before blog post publishing
- Run before campaign message delivery

## Triggers

- "심의 검토", "의료법 검토", "광고 심의"
- "이거 괜찮아?", "법적으로 문제 없어?"
- "compliance", "review copy"
- Auto-suggested after `/write-copy` completes

## All user-facing output in Korean.
