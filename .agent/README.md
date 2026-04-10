# Clinic-OS Agent Documentation

> Primary entry point: `CLAUDE.md` (auto-loaded). This file supplements with agent-specific navigation.

## Entry Points

| Agent | Entry | Auto-loaded? |
|-------|-------|-------------|
| Claude Code | `CLAUDE.md` + `.claude/rules/*.md` | Yes |

## Task → Document Navigation

See `CLAUDE.md` §Document Map for full routing. Quick reference:

| Task | Start Here |
|------|-----------|
| First contact (auto-detect phase) | `.agent/workflows/first-contact-v2.md` |
| Setup | `npm run setup:agent` → `.agent/workflows/setup-clinic.md` |
| Onboarding | `.agent/onboarding-registry.json` → `onboarding-state.json` → `workflows/onboarding-agentic.md` |
| Core update | `workflows/core-update-agentic.md` + `smart-migration.md` |
| Error recovery | `.agent/last-error.json` (if exists) → `workflows/troubleshooting.md` |
| Diagnostics | `npm run agent:doctor -- --json` → `npm run agent:sync -- --dry-run` |
| Lifecycle check | `npm run agent:lifecycle -- --json` |
| File modification | `.agent/manifests/local-workspaces.json` → `workflows/local-customization-agentic.md` |

## Phase Detection (first-contact)

```
Project opened → check .agent/setup-progress.json
  ├── pending/in_progress → resume setup
  └── all done → check onboarding-state.json
        ├── features incomplete → resume onboarding
        └── all done → operational mode

Priority override: .agent/last-error.json exists → troubleshooting FIRST
```

## Protection Rules (SOT chain)

```
.docking/protection-manifest.yaml     ← SOT
  → .claude/rules/clinic-os-safety.md ← Claude Code (auto-loaded)
  → CLAUDE.md §Hard Rules             ← Execution guide
```

## State Files

See `CLAUDE.md` §State Files for full list. Key additions:

| File | Purpose | Writer |
|------|---------|--------|
| `.agent/runtime-context.json` | Workspace snapshot (app root, local overrides) | `npm run agent:context` |
| `.agent/support-status.json` | Doctor diagnosis results | `npm run agent:doctor` |
| `.agent/lifecycle-status.json` | Install scenario detection | `npm run agent:lifecycle` |
| `.agent/restore-status.json` | Restore plan results | `npm run agent:restore` |
| `.agent/deployment-target.json` | Last deploy target record | deploy script |
| `.agent/manifests/*.json` | Core-deployed rules (change-strategy, local-workspaces, admin-public-bindings, command-safety, lifecycle-scenarios) | core:push |

## Agent Execution Principles

1. Safe non-interactive commands → agent executes directly
2. Destructive/external commands → explain impact, propose (don't dump commands for user to paste)
3. Wrong command requested → explain safer alternative
4. Error → `.agent/workflows/troubleshooting.md`. 2+ failures → escalate to user
