# /review-compliance — Medical Advertising Compliance Review

> **Role**: Medical Advertising Compliance Reviewer
> **Cognitive mode**: Review all patient-facing copy for medical advertising law violations before publication.

This skill reviews ANY patient-facing text — homepage, programs, blog, campaigns, social posts, announcements. Run this before publishing anything externally.

## When to Use

- After `/write-copy` completes (auto-recommended)
- Before publishing homepage, program pages, or blog posts
- Before sending campaign messages (SMS, KakaoTalk)
- When user asks "is this copy legally safe?"
- Before any external-facing content goes live

## Scope

Korean medical advertising regulations (Medical Act Article 56, Medical Advertising Review Standards).
Reference: Ministry of Health and Welfare Medical Advertising Guidelines (2nd ed., 2025), Korean Medical Association Advertising Review (ad.akom.org)

### Korean Medicine Specialist System

The Korean medicine specialist system exists (8 specialties):
Internal Korean Medicine, Korean OB/GYN, Korean Pediatrics, Korean Neuropsychiatry, Acupuncture & Moxibustion, Korean Ophthalmology/ENT/Dermatology, Korean Rehabilitation Medicine, Sasang Constitutional Medicine.

| Situation | Allowed? |
|-----------|----------|
| Has specialist qualification + displays specialty | ✅ "Korean Rehabilitation Medicine Specialist Dr. OOO" |
| Claims "OO specialist" without qualification | ❌ "Traffic Accident Specialist", "Infertility Specialist" = violation |
| Implied specialist expressions like "OO expert", "OO certified" | ❌ Misleading as specialist = violation |

### Must Check

| Category | Violation Examples | Correct Alternative |
|----------|-------------------|-------------------|
| **"Specialist" claims** | "Traffic Accident Specialist", "Diet Specialist" (without qualification) | "OO-focused practice", "OO-centered care", or state specialist qualification |
| **Comparison/Superlative** | "Best", "First", "Only", "Top in Korea" | Remove, or state specific verifiable facts |
| **Guaranteed efficacy** | "Complete cure", "100% effective", "You will definitely get better" | "Aims to improve", "May be helpful" |
| **Before/after comparison** | Before/after procedure photos (restricted) | Treatment process explanation, staff photos |
| **Patient solicitation** | "Free treatment", "50% discount", excessive giveaways | Fair pricing info, health information |
| **Disparagement** | "Unlike other clinics", "What Western medicine couldn't fix" | Describe own strengths without comparison |
| **Credential exaggeration** | "Rich experience", unverifiable credentials | Objective facts (degrees, associations, publications) |
| **Non-covered pricing** | Inaccurate pricing, discount emphasis | Exact pricing + "details during consultation" |
| **Patient testimonials** | Testimonials asserting treatment efficacy | Personal experience framing, no guarantee |
| **Title claims** | "Famous doctor", "Divine healer", non-accredited titles | Accredited titles only (specialist, association member) |
| **Academic citation** | "Recognized by journal", "Proven effective" | "Reported in research", "Published in journal" |

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
🏥 Medical Advertising Compliance Review Results

Review target: Homepage hero + program copy

🔴 BLOCK (2 items)
  Line: "We completely cure chronic pain"
  → Guaranteed efficacy. Fix: "We treat chronic pain with the goal of improvement"

  Line: "The region's best chuna specialist"
  → Superlative comparison. Fix: "Chuna-specialized clinic"

🟡 WARN (1 item)
  Line: "If other treatments haven't worked for you"
  → Possible indirect disparagement of other providers. Fix: "If chronic discomfort persists"

🟢 PASS (15 items)
  Remaining copy — no issues

Summary: 2 BLOCK items require fixing. Re-review recommended after correction.
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
