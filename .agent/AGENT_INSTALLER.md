# Agent Installer Guide

> Starter kit auto-install. User says "설치해줘" → agent handles everything.

## Quick Start

```bash
npm run setup:agent              # Full auto (browser auth opens)
npm run setup:agent -- --token=X # Pre-issued token (CI/CD)
npm run setup:agent -- --skip-auth  # Offline/local only (no core download)
npm run setup:agent -- --status  # Check current progress
npm run setup:agent -- --reauth  # Re-authenticate
npm run setup:agent -- --reset   # Start from scratch
```

## Auto-Detection Protocol

```
Agent opens project → check .agent/setup-progress.json
  ├── exists → resume from last step
  └── not exists → check .agent/AGENT_INSTALLER.md
        ├── exists → starter kit initial state → npm run setup:agent
        └── not exists → legacy mode
```

## What setup:agent Does

1. ✅ Detect current state
2. ✅ HQ authentication (browser opens)
3. ✅ Starter kit download
4. ✅ Dependencies install
5. ✅ 16-step setup auto-progression

Interrupted? Re-run `npm run setup:agent` → resumes from last step.

## Diagnostics

```bash
npm run agent:doctor -- --json     # Install/version/error diagnosis + recommended actions
npm run agent:sync -- --dry-run    # Preview safe auto-fixes
npm run agent:sync                 # Execute safe auto-fixes
npm run agent:lifecycle -- --json  # Fresh/resume/update/reinstall scenario detection
npm run agent:context              # Regenerate runtime-context.json
```

## State Files

| File | Purpose |
|------|---------|
| `.agent/agent-context.json` | Installer state (stage, mode, setup progress) |
| `.agent/setup-progress.json` | 16-step progress (per-step status) |
| `.agent/runtime-context.json` | Workspace snapshot (app root, manifests, local overrides) |
| `.agent/support-status.json` | Doctor diagnosis results |
| `.agent/lifecycle-status.json` | Scenario detection results |

## Recovery

| Problem | Fix |
|---------|-----|
| Install interrupted | `npm run setup:agent` (auto-resume) |
| Auth failed | `npm run setup:agent -- --reauth` |
| Context stale | `npm run agent:context` |
| Install/update keeps breaking | `npm run agent:doctor -- --json` → `npm run agent:sync -- --dry-run` |
| Too old to update | `npm run agent:lifecycle -- --json` → snapshot + fresh install |
| Backup from sibling folder needed | `npm run agent:restore -- --dry-run --json` |
| Start over | `rm .agent/agent-context.json .agent/setup-progress.json && npm run setup:agent -- --reset` |

## Requirements

- Node.js v18+
- Network access (HQ server for auth/core download)
- 5-15 min for full install
- Browser opens for auth (unless `--token` provided)
