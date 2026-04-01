# /dev-survey — Survey Tool Development Partner

> **Role**: Survey Tool Architect + Medical Content Designer
> **Cognitive mode**: Guided co-creation. Agent drives structure, clinician drives clinical judgment.
> **Philosophy**: Agent as Producer, Plugin as Format (SPEC Section 0)

The **only primary production path** for survey tools. Converse with the clinic owner to understand the medical context,
then automate from question design → scoring logic → result messages → manifest.json generation → DB registration → program linking.

The admin UI is for "management only" — new tool creation is only possible through this skill.

## When to Use

- "I want to create a survey tool" / "Create a self-diagnosis"
- "I want to add a mini-diagnosis to a program"
- "I want to add a standardized scale like PHQ-9"
- "I want to modify an existing mini-diagnosis"
- When a custom survey tool is needed beyond the existing stress-check

## Guardrail Flow (4 Phases)

### Phase 1 — Context Collection

```
📋 검사도구를 함께 만들어보겠습니다.

몇 가지 여쭤볼게요:

1. What symptom/condition are you trying to diagnose?
   (e.g., stress, digestive, pain, constitution, etc.)

2. Do you need a standalone test page or embed in a program?
   - Standalone: separate URL at /ext/survey-tools/{id}
   - Mini-diagnosis (mini): embedded in program page
   - Hybrid: both options

3. Do you have an existing questionnaire?
   (If so, paste the text and we'll analyze the structure)

4. Are you using a standardized scale (PHQ-9, GAD-7, PSS, etc.)?
```

**Information to collect:**
| Item | Required | Example |
|------|----------|---------|
| Purpose/target symptom | O | "Digestive problem screening" |
| Tool type | O | standalone / mini / hybrid |
| Approximate question count | O | 4~10 |
| Program to link | △ | "digestive" program |
| Existing questionnaire | △ | text/image |
| Standardized scale | △ | PHQ-9, GAD-7, etc. |

### Phase 2 — Design (Agent + Clinician Co-creation)

**The agent proposes a draft and the clinic owner reviews/modifies.**

```
📝 Draft created for review.

[Tool name]: {tool_name}
[Type]: {standalone | mini | hybrid}
[Questions]: {n}
[Estimated time]: {n} min

--- Questions ---

Q1. {question_text}
   ① {option_1} (0 pts)
   ② {option_2} (2 pts)
   ③ {option_3} (3 pts)
   ④ {option_4} (5 pts) ⚠️ Red Flag

Q2. ...

--- Scoring ---

Total: 0~{maxScore} pts
  0~{n} pts: {level_1} — {label_1}
  {n+1}~{m} pts: {level_2} — {label_2}
  {m+1}~{maxScore} pts: {level_3} — {label_3}

--- Result Messages (for mini) ---

[Good] {title} / {subtitle}
  {description}
  CTA: {headline} — {body}

[Caution] ...

[Warning] ...

Any modifications needed?
- "Change question order"
- "This question doesn't fit our patients"
- "Adjust score ranges"
- "Change result message tone"
- "Looks good, proceed"
```

**Design principles:**
- Minimum 4 questions recommended (mini: 4, standalone: 5~15)
- Every question option must have a score (value) assigned
- Red flag options are marked with `"redFlag": true` + immediate visit recommendation
- Result messages should encourage visits without causing patient anxiety
- Score ranges should use balanced cutoffs to avoid over/under-diagnosis

### Phase 3 — Generate + Register (Automated)

When the clinic owner says "Looks good, proceed":

**3.1. Determine Tool ID**
```
ID rules:
- standalone: {slug} (e.g., stress-check, phq9)
- mini: {programSlug}-mini (e.g., diet-mini, pain-mini)
- hybrid: {slug} (e.g., digestion-check)
```

**3.2. Generate manifest.json**

File location:
- Master repo core: `src/survey-tools/{id}/manifest.json`
- Client local: `src/survey-tools/local/{id}/manifest.json`

```json
{
  "id": "{tool_id}",
  "name": "{tool_name}",
  "description": "{description}",
  "version": "1.0.0",
  "source": "core|local",
  "questionCount": {n},
  "estimatedTime": "{n}분",
  "tags": [...],
  "questions": [
    {
      "id": "q1",
      "type": "radio",
      "question": "...",
      "options": [
        { "label": "...", "value": 0 },
        { "label": "...", "value": 2 },
        { "label": "...", "value": 3 },
        { "label": "...", "value": 5, "redFlag": true }
      ]
    }
  ],
  "scoring": {
    "maxScore": {max},
    "interpretation": [
      { "min": 0, "max": {n}, "level": "low", "label": "...", "description": "..." },
      ...
    ]
  }
}
```

**3.3. Manifest validation**

After writing manifest.json, validate:

```typescript
import { validateSurveyToolManifest } from '@lib/survey-tool-runtime';
const issues = validateSurveyToolManifest(manifest);
// errors → auto-fix and re-validate
// warnings → notify user
```

Validation items:
- All questions have ids, no duplicates
- radio/checkbox questions have options array
- No duplicate option values
- scoring.interpretation ranges don't overlap
- maxScore matches calculated value from questions

**3.4. DB registration**

```sql
INSERT INTO survey_tools (
  id, name, description, type, source, version,
  questions, scoring, mini_config, program_variants,
  tags, estimated_time, question_count, disclaimer,
  is_active, sort_order
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  questions = excluded.questions,
  scoring = excluded.scoring,
  mini_config = excluded.mini_config,
  program_variants = excluded.program_variants,
  tags = excluded.tags,
  updated_at = unixepoch();
```

Execute with `npx wrangler d1 execute my-clinic-db --local`.

**3.5. Program linking (mini/hybrid, optional)**

Add MiniDiagnosis section to the program's sections JSON:
```json
{
  "type": "MiniDiagnosis",
  "toolId": "{tool_id}",
  "programId": "{program_slug}",
  "title": "미니 진단"
}
```

### Phase 4 — Verify

```
✅ Survey tool registration complete

📋 Tool Info:
   ID: {tool_id}
   Name: {tool_name}
   Type: {standalone | mini | hybrid}
   Questions: {n} / estimated {m} min
   Source: {core | local}

📁 Generated Files:
   src/survey-tools/{local/}{id}/manifest.json

🗄️ DB:
   Registered in survey_tools table
   {If program linked: added to "{program}" program sections}

🔗 Preview:
   Standalone: /ext/survey-tools/{id}
   Program: /programs/{program_slug} (MiniDiagnosis section)

What's next:
- "Modify questions" → update manifest + DB
- "Change result messages" → update mini_config
- "Link to a program" → add section
- "Create custom result page" → generate result.astro
```

## Question Types Reference

| type | Description | Score | Use case |
|------|------------|-------|----------|
| `radio` | Single selection | options[].value | Most common |
| `checkbox` | Multiple selection | Cumulative sum | Complex symptoms |
| `nrs` | Numeric scale (0-10) | Direct value | Pain intensity |
| `number` | Numeric input | Direct value | Blood pressure, weight |
| `text` | Text input | 0 | Free description |
| `textarea` | Long text input | 0 | Detailed description |
| `select` | Dropdown | options[].value | Category |
| `info` | Informational text | Excluded | Intro/guidance |
| `date` | Date input | 0 | Onset date, etc. |

Recommended for mini-diagnosis: `radio` (simple), `nrs` (pain scale)

## Scoring Design Guidelines

- **maxScore**: Sum of max scores for all questions. Validation function auto-calculates and compares.
- **interpretation ranges**: Cover 0~maxScore completely with no overlaps
- **level naming**: low → mild → moderate → high (or good → caution → warning)
- **Red flag**: When a `"redFlag": true` option is selected, emphasize "immediate visit recommended" in results
- **CTA**: headline + body for each result level. Add link when program-linked.

## Safety

- Core tools (master repo): `src/survey-tools/{id}/`
- Client local tools: `src/survey-tools/local/{id}/` (protected from core:pull)
- manifest.json is generated by the agent — not manually edited by humans
- DB registration uses `INSERT OR REPLACE` (idempotent)
- Exercise caution when modifying existing core survey tools (stress-check, 9 minis)

## Integration

| Skill | Relationship |
|-------|-------------|
| `/survey-tool` | Manage/check status of existing tools |
| `/setup-programs` | Link survey tool sections to programs |
| `/frontend-code` | Custom survey.astro/result.astro implementation |

## Triggers

- "검사도구 만들기", "자가진단 만들기", "설문 만들기"
- "미니진단 추가", "프로그램에 진단 넣기"
- "PHQ-9 추가", "표준 척도 넣기"
- "기존 진단 수정"

## All user-facing output in Korean.
