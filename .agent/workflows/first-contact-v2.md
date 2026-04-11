---
description: First Contact Protocol v2 — auto-detect phase and proceed without conversation
category: dev
---

# First Contact Protocol v2

> Read this and act immediately. Detect state from files, proceed automatically. Minimize user conversation.

## Phase Detection

```
Check priority order:
1. .agent/last-error.json exists?     → Phase E (error recovery — HIGHEST PRIORITY)
2. .agent/setup-progress.json exists? → Phase S (resume setup)
3. .agent/AGENT_INSTALLER.md exists?  → Phase A (fresh install)
4. .agent/onboarding-state.json?      → Phase O (onboarding)
5. None of above                      → Phase M (legacy mode)
```

## Pre-Code Modification Checklist

Before any code changes, read in order:
1. `.agent/runtime-context.json` (if missing + node_modules exists → `npm run agent:context`)
2. `.agent/manifests/change-strategy.json`
3. `.agent/manifests/local-workspaces.json`
4. `.agent/manifests/admin-public-bindings.json`
5. `.agent/manifests/command-safety.json`
6. `.agent/manifests/lifecycle-scenarios.json`

For install/update issues: `npm run agent:doctor -- --json` first.
For lifecycle detection: `npm run agent:lifecycle -- --json`.

### Local Workspace Selection

| Need | Path |
|------|------|
| Existing page override | `src/pages/_local/**` |
| Clinic-specific helper | `src/lib/local/**` |
| New feature/route/API | `src/plugins/local/**` |
| Survey tool | `src/survey-tools/local/**` |
| Static files | `public/local/**` |
| Internal docs | `docs/internal/**` |

Detailed rules: `workflows/local-customization-agentic.md`, `workflows/plugin-agentic.md`, `workflows/survey-tools-agentic.md`.

## Phase E: Error Recovery (highest priority)

`.agent/last-error.json` exists → read it → `npm run error:recover` → see `workflows/troubleshooting.md`.

## Phase A: Fresh Install

Condition: `AGENT_INSTALLER.md` exists, no `setup-progress.json`.

```bash
npm run setup:agent    # Full auto (browser auth, 16-step setup)
# High-perf macOS/WSL: npm run setup:agent -- --prefer-fast
```

Complete when: `agent-context.json` stage=complete, all setup-progress steps=done.

## Phase S: Resume Setup

Condition: `setup-progress.json` exists with pending/in_progress steps.

```bash
npm run setup:step -- --next    # Repeat until all done
```

All done → Phase O.

## Phase O: Onboarding

Condition: Setup complete, `onboarding-state.json` exists.

→ `workflows/onboarding-agentic.md` (Tier 1 → 2 → 3+)

## Phase M: Legacy

No installer, no setup-progress → legacy first-contact protocol.

## User Conversation — Only When

- Auth code input needed
- Multiple-choice selection required
- Error makes progress impossible
- Onboarding needs clinic-specific info

Everything else → agent executes directly.

## Messages (ko)

### Phase A 시작
```
Clinic-OS 자동 설치를 시작합니다.
브라우저가 열리면 인증 코드를 입력해주세요.
```

### Phase S 재개
```
이전 설치를 이어서 진행합니다. (남은 단계: {remaining})
```

### Phase O 진입
```
✅ Clinic-OS 설치가 완료되었습니다!
이제 한의원 홈페이지 개별 설정(온보딩)을 시작하겠습니다.
```

### Phase E 에러
```
⚠️ 이전 설치에서 에러가 감지되었습니다.
복구를 시도하겠습니다...
```
