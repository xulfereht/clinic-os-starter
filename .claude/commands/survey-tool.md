# /survey-tool — Survey Tool Manager

Collaboratively create, test, and publish survey tools (검사도구) with the client.
Designed for non-developers who want custom health questionnaires for their clinic.

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
어떤 작업을 하시겠어요?
[A] 새 검사도구 만들기
[B] 기존 검사도구 보기/수정
[C] HQ에 공개하기
```

---

## Mode: create

### Step 1 — Discovery (conversation)

DO NOT immediately generate files. First, have a conversation:

```
어떤 종류의 검사를 만들고 싶으신가요?

예시:
• 스트레스 자가진단
• 소화기 건강 체크
• 수면 품질 평가
• 통증 자가평가 (NRS)
• 체질 분류 설문
• 생활습관 진단

자유롭게 설명해주세요. 대상, 목적, 문항 수 등을 알려주시면 맞춤 설계합니다.
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
📋 검사도구 설계안
━━━━━━━━━━━━━━━━━

이름: {name}
ID: {tool-id}
문항 수: {N}개
예상 소요: {time}
채점 방식: {scoringType}

📝 문항 구성:
  Q1. {question text} [{type}]
  Q2. {question text} [{type}]
  ...

📊 결과 해석:
  0-{n}점: {label} — {description}
  {n}-{m}점: {label} — {description}
  ...

이대로 진행할까요? 수정할 부분이 있으면 말씀해주세요.
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

Ask: "기본 UI로 충분한데, 혹시 특별한 디자인이 필요하신가요?"

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
✅ 검사도구 생성 완료!

📂 위치: src/survey-tools/local/{tool-id}/
🔗 검사 URL: /ext/survey-tools/{tool-id}
🔗 관리 페이지: /admin/surveys/tools

다음 단계:
  1. npm run dev 로 로컬에서 테스트
  2. 배포 후 /ext/survey-tools/{tool-id} 에서 확인
  3. 원하시면 HQ에 공개하여 다른 병원과 공유 가능
```

### Step 5 — Deploy Offer

```
검사도구를 배포하시겠습니까?
[A] 로컬만 (우리 병원에서만 사용)
[B] HQ에 공개 (다른 병원도 사용 가능)
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
📋 등록된 검사도구
━━━━━━━━━━━━━━━━━

🔵 코어 (core:pull로 관리)
  • stress-check — 스트레스 자가진단 (10문항)

🟢 로컬 (우리 병원 전용)
  • {tool-id} — {name} ({N}문항)

🟣 스토어 (HQ에서 설치)
  • (없음)

총 {N}개 검사도구
```

---

## Mode: edit

1. List existing tools (same as `list` mode)
2. User selects a tool to edit
3. Read the manifest.json
4. Only edit tools in `local/` — core tools require override:
   - "코어 도구는 직접 수정하면 core:pull 시 덮어쓰기됩니다."
   - "local/에 같은 ID로 복사하여 수정할까요?" (local overrides core)
5. Present current design, apply changes, rebuild

---

## Mode: test

Run a simulated walkthrough of the survey:

1. Read manifest.json questions
2. Present each question as the user would see it
3. Simulate scoring with sample answers
4. Show the result interpretation

```
🧪 검사 시뮬레이션: {name}
━━━━━━━━━━━━━━━━━━━━━━━━

Q1. {question} [radio]
  → 시뮬레이션 응답: {option} (3점)

Q2. {question} [radio]
  → 시뮬레이션 응답: {option} (2점)
  ...

📊 시뮬레이션 결과:
  총점: 15 / 40
  판정: 경미한 수준
  해석: "약간의 스트레스가 감지되지만..."
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
📦 HQ 공개 준비
━━━━━━━━━━━━━━

도구: {name} v{version}
문항: {N}개
채점: {scoringType}

HQ에 공개하면 다른 Clinic-OS 사용자가 설치할 수 있습니다.
공개하시겠습니까? [Y/n]
```

If yes:
- Ensure `npm run dev` is running (HQ submit requires dev mode for filesystem access)
- Guide through the admin UI: `/admin/surveys/tools` → select the tool → "HQ에 공개"
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

## All user-facing output in Korean
