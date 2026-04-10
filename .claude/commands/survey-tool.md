# /survey-tool — Survey Tool Manager

Collaboratively create, test, and publish survey tools (health questionnaires) with the client.
Designed for non-developers who want custom health questionnaires for their clinic.

## When to Use

- When the clinic wants to create a new patient self-assessment tool
- When managing existing survey tools (list, edit, test, publish)
- When publishing a local survey tool to HQ for other clinics
- Onboarding Tier 3 (patient services) — survey tool setup

## Source of Truth

- Tool loader: `src/lib/survey-tools-loader.ts`
- Plugin router: `src/plugins/survey-tools/pages/[...tool].astro`
- Submit API: `src/pages/api/survey-tools/submit.ts`
- Reference tool: `src/survey-tools/stress-check/` (manifest + custom renderers)
- Local tool path: `src/survey-tools/local/{tool-id}/`
- HQ API: `GET/POST /api/survey-tools/*`

## Modes

Detect user intent and route to the appropriate mode:

| Intent | Mode |
|--------|------|
| 만들기, 새 검사, create | `create` |
| 목록, 어떤 검사가 있어, list | `list` |
| 수정, 편집, edit | `edit` |
| 테스트, 미리보기, test | `test` |
| 공개, 퍼블리시, publish | `publish` |
| 삭제, remove | `delete` |

If unclear, ask:
```
What would you like to do?
[A] Create a new survey tool
[B] View/edit existing survey tools
[C] Publish to HQ
```

---

## Mode: create

### Step 1 — Discovery (conversation)

DO NOT immediately generate files. First, have a conversation:

```
What kind of assessment would you like to create?

Examples:
• Stress self-assessment
• Digestive health check
• Sleep quality evaluation
• Pain self-assessment (NRS)
• Constitutional classification survey
• Lifestyle diagnosis

Describe freely. Tell me about the target audience, purpose, question count, etc. and I'll design it.
```

Gather at minimum:
- **Purpose**: What does this survey diagnose/measure?
- **Target audience**: Patients? General public? Specific condition?
- **Question count**: Suggest 5-15 for self-diagnosis (too many = drop-off)
- **Scoring approach**: Sum score with ranges? Category-based? Pass/fail?
- **Result interpretation**: What do score ranges mean clinically?

### Step 2 — Design Review

Present the design before generating:

```
📋 Survey Tool Design
━━━━━━━━━━━━━━━━━

Name: {name}
ID: {tool-id}
Questions: {N}
Estimated time: {time}
Scoring method: {scoringType}

📝 Question structure:
  Q1. {question text} [{type}]
  Q2. {question text} [{type}]
  ...

📊 Result interpretation:
  0-{n} points: {label} — {description}
  {n}-{m} points: {label} — {description}
  ...

Shall we proceed? Let me know if anything needs to be changed.
```

Iterate until the user approves.

### Step 3 — Generate Files

Create files in `src/survey-tools/local/{tool-id}/`:

**manifest.json** (always required):

```json
{
  "id": "{tool-id}",
  "name": "{name}",
  "description": "{description}",
  "version": "1.0.0",
  "author": "{clinic name or user}",
  "source": "local",
  "questionCount": {N},
  "scoringType": "{likert-5|likert-7|binary|nrs|custom}",
  "estimatedTime": "{time}",
  "tags": ["{tag1}", "{tag2}"],
  "questions": [...],
  "scoring": {
    "maxScore": {max},
    "interpretation": [...]
  }
}
```

**Question types available:**

| Type | Use case | Options |
|------|----------|---------|
| `info` | Intro/instruction screen | No scoring |
| `radio` | Single choice (most common) | `options: [{value, label}]` |
| `text` | Short text input | Free text |
| `textarea` | Long text input | Free text |
| `nrs` | 0-10 numeric scale | Pain/severity |

**Custom renderers** (only if the user wants special UI):

Ask: "The default UI should be sufficient — do you need any special design?"

If yes, generate `survey.astro` and/or `result.astro`:
- Use `BaseLayout` or `IntakeLayout` from the project
- Follow the pattern in `src/survey-tools/stress-check/survey.astro`
- Include proper form submission to `/api/survey-tools/submit`

If no, the default typeform-style renderer handles everything automatically.

### Step 4 — Build & Test

```bash
npm run build
```

If build succeeds:

```
✅ Survey tool created!

📂 Location: src/survey-tools/local/{tool-id}/
🔗 Survey URL: /ext/survey-tools/{tool-id}
🔗 Admin page: /admin/surveys/tools

Next steps:
  1. Test locally with npm run dev
  2. Verify at /ext/survey-tools/{tool-id} after deploy
  3. Optionally publish to HQ for sharing with other clinics
```

### Step 5 — Deploy Offer

```
Would you like to deploy the survey tool?
[A] Local only (use at our clinic only)
[B] Publish to HQ (available to other clinics)
```

If A: Run deploy per onboarding deploy guardrails.
If B: Proceed to `publish` mode.

---

## Mode: list

Scan survey tools and present:

```bash
# Read all manifests
ls src/survey-tools/*/manifest.json
ls src/survey-tools/local/*/manifest.json
ls src/survey-tools/store/*/manifest.json
```

Present:

```
📋 Registered Survey Tools
━━━━━━━━━━━━━━━━━

🔵 Core (managed via core:pull)
  • stress-check — Stress Self-Assessment (10 questions)

🟢 Local (clinic-specific)
  • {tool-id} — {name} ({N} questions)

🟣 Store (installed from HQ)
  • (none)

Total: {N} survey tools
```

---

## Mode: edit

1. List existing tools (same as `list` mode)
2. User selects a tool to edit
3. Read the manifest.json
4. Only edit tools in `local/` — core tools require override:
   - "Core tools will be overwritten on core:pull if modified directly."
   - "Copy to local/ with the same ID to modify?" (local overrides core)
5. Present current design, apply changes, rebuild

---

## Mode: test

Run a simulated walkthrough of the survey:

1. Read manifest.json questions
2. Present each question as the user would see it
3. Simulate scoring with sample answers
4. Show the result interpretation

```
🧪 Survey Simulation: {name}
━━━━━━━━━━━━━━━━━━━━━━━━

Q1. {question} [radio]
  → Simulated answer: {option} (3 points)

Q2. {question} [radio]
  → Simulated answer: {option} (2 points)
  ...

📊 Simulation Result:
  Total score: 15 / 40
  Assessment: Mild level
  Interpretation: "Some stress detected but..."
```

Also verify:
- manifest.json validity (required fields present)
- Question IDs unique
- Scoring ranges cover full score spectrum (no gaps)
- Build passes

---

## Mode: publish

Publish a local tool to HQ for other clinics to use.

### Pre-check

1. Tool must be in `src/survey-tools/local/`
2. manifest.json must have all required fields
3. Build must pass

### Procedure

```
📦 HQ Publication Preparation
━━━━━━━━━━━━━━

Tool: {name} v{version}
Questions: {N}
Scoring: {scoringType}

Publishing to HQ makes this available for other Clinic-OS users to install.
Proceed? [Y/n]
```

If yes:
- Ensure `npm run dev` is running (HQ submit requires dev mode for filesystem access)
- Guide through the admin UI: `/admin/surveys/tools` → select the tool → "Publish to HQ"
- Or if API is available, use direct submission

---

## Mode: delete

Only local tools can be deleted. Core tools: inform user they come back on core:pull.

```bash
rm -rf src/survey-tools/local/{tool-id}
npm run build
```

---

## manifest.json Validation Rules

| Field | Required | Rule |
|-------|----------|------|
| `id` | Yes | `/^[a-z0-9-]+$/`, must match folder name |
| `name` | Yes | Non-empty string |
| `description` | Yes | Non-empty string |
| `version` | Yes | Semver format |
| `questions` | Yes | Non-empty array |
| `questions[].id` | Yes | Unique within array |
| `questions[].type` | Yes | One of: info, radio, text, textarea, nrs |
| `questions[].question` | Yes | Non-empty string |
| `scoring.maxScore` | Yes | Positive integer |
| `scoring.interpretation` | Yes | Non-empty array covering 0 to maxScore |

## File Safety

- All files go to `src/survey-tools/local/` — safe from core:pull
- Never modify files in `src/survey-tools/stress-check/` or other core paths
- If overriding a core tool, copy to `local/{same-id}/` first

## Triggers

User says: "검사도구", "검사 만들기", "자가진단", "설문", "survey tool", "questionnaire"

## Onboarding State Sync

After survey tool is created and verified, mark the onboarding feature as done.
This runs regardless of entry point (demo, delegated, onboarding, standalone).

```bash
npm run onboarding:done -- --feature=survey-tools --note="survey-tool completed"
```

> Skip silently if onboarding-state.json doesn't exist.

## All user-facing output in Korean
