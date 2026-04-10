---
description: Survey tools workflow — create/install assessment tools in local workspace
category: dev
---

# Survey Tools

Create or install self-diagnosis, questionnaire, and assessment tools in `src/survey-tools/local/`.

## When to Use

- Self-diagnosis / survey / checklist / intake form needed
- Public link at `/ext/survey-tools/{toolId}` needed
- Result page + printable report needed
- Patient-linked result storage needed

If it's more like a general page or admin feature → use plugin or `_local/` instead.

## Read Before Starting

1. `.agent/runtime-context.json`
2. `.agent/manifests/local-workspaces.json`
3. `src/lib/survey-tools-loader.ts` (runtime SOT)
4. `docs/SURVEY_TOOLS_GUIDE.md`

## Loading Priority

1. `src/survey-tools/local/{toolId}/` (highest)
2. `src/survey-tools/store/{toolId}/`
3. `src/survey-tools/{toolId}/` (core)

## Structure

```
src/survey-tools/local/{toolId}/
├── manifest.json          # Required
├── survey.astro           # Optional (custom survey UI)
├── result.astro           # Optional (custom result page)
└── report.astro           # Optional (printable report)
```

Simple tools: `manifest.json` with `questions` + `scoring` may suffice.
Complex tools: write custom `survey/result/report.astro`.

## Scaffold

```bash
npm run survey-tool:create -- --id {toolId} --mode manifest --dry-run --json
npm run survey-tool:create -- --id {toolId} --mode hybrid --with-report  # Custom rendering
```

## Implementation Modes

| Mode | When | Required |
|------|------|----------|
| Data-driven | Simple MCQ/checklist, score+interpret | `manifest.json` (questions, scoring) |
| Custom rendering | Complex branding/flow/layout | manifest + `survey/result/report.astro` |

Data-driven supports: `options[].score`, `reverseScored`, `weight`, `useCustomSurvey/Result/Report`.

## Result Flow

Submit → `/api/survey-tools/submit` → result ID → `/ext/survey-tools/{toolId}/result/{resultId}` → (optional) `/report/{resultId}`.

Patient-linked: verify `?patient_id=...` flow + admin patient detail entry link.

## Store Install

```bash
npm run survey-tool:install -- --id {toolId} --dry-run --json  # Preview
npm run survey-tool:install -- --id {toolId}                    # Install
```
Or admin UI: `/admin/surveys/tools/store`. Migration/seed SQL in package auto-applied to local D1.

## NEVER

- Modify `src/plugins/survey-tools/**` directly (core path)
- Modify root `migrations/`
- Patch core survey tools for local requirements
- Manually copy manifest.json to `src/survey-tools/store/`

## Completion Checklist

- [ ] toolId doesn't conflict with existing local/store/core
- [ ] Used `survey-tool:create -- --dry-run` for new tools
- [ ] Used `--dry-run --json` for store installs
- [ ] `survey-tool:check -- --id {toolId} --json` passes
- [ ] `npm run build` passes
- [ ] `/ext/survey-tools/{toolId}` loads
- [ ] Result/report flow works
- [ ] Patient-linked flow verified (if applicable)
