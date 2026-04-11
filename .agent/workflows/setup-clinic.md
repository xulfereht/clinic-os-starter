---
description: Initial clinic setup — Zero-Touch install from Starter Kit
category: dev
---

# Initial Setup (Zero-Touch)

After client downloads Starter Kit, initialize project and dev environment.

## Prerequisites

- Cloudflare account ([signup](https://dash.cloudflare.com/sign-up), free) — [CF Setup Guide](https://clinic-os-hq.pages.dev/guide/cloudflare-setup)
- Node.js v18+, Git installed

## Setup Methods

### A: Step-by-Step (recommended — memory safe)

```bash
npm install
npm run setup:step -- --status    # Check current state
npm run setup:step -- --next      # Execute next step (repeat until done)
```

17 steps, each idempotent. SIGKILL safe (resumes from failed step). Progress: `.agent/setup-progress.json`.
`setup:agent` uses this path internally; falls back here if fast setup fails.

### B: Fast Batch (high-perf environments)

macOS or WSL Ubuntu, 8GB+ RAM, signed `clinic.json`:

```bash
npm run setup:fast -- --auto
# Or: npm run setup:agent -- --prefer-fast
```

### C: Legacy Batch

```bash
npm run setup
```
Auto: system check → HQ auth → D1/R2 creation → wrangler.toml generation.

### D: Delegated Setup

Central agent builds for client. See `workflows/delegated-setup.md`.

```bash
# Master repo: node scripts/delegated-init.js --client-id=<ID>
# Client dir: npm install → npm run setup:step -- --next → npm run deploy
# Client claim: npm run handoff:claim
```

## Post-Setup

```bash
npm run core:pull    # Fetch latest app package
npm run dev          # Start local dev server → http://localhost:4321
```

Verify: homepage loads, `/admin` accessible, `npm run deploy` for production.

## Next: Onboarding

→ `workflows/onboarding-agentic.md` or say "온보딩 시작":
1. Admin + clinic info + branding → **1st deploy**
2. Staff + programs + homepage → **2nd deploy**
3. Intake + blog + patient management → **operations start**
4. SMS, SEO, multilingual → **optional expansion**

## Troubleshooting

| Problem | Fix |
|---------|-----|
| core:pull "not a git repo" | `git init && npm run core:pull` (v1.24.0+ auto-inits) |
| No clinic.json | Wizard auto-switches to manual/browser auth |
| Wrangler login needed | `npx wrangler login` — [CF Setup Guide](https://clinic-os-hq.pages.dev/guide/cloudflare-setup) |
| DB init error | `npm run db:init && npm run db:seed` (wrangler.toml required) |
| No wrangler.toml | `npm run setup:step -- --next` |
| Error persists | `npm run error:recover` → see `workflows/troubleshooting.md` |

## Commands

| Command | Purpose |
|---------|---------|
| `npm run setup:step -- --next` | Next install step |
| `npm run setup:step -- --status` | Install progress |
| `npm run setup:fast -- --auto` | Fast batch (high-perf) |
| `npm run setup:agent` | Full auto install |
| `npm run status` | Unified status (install + onboarding + health) |
| `npm run error:recover` | Auto error recovery |
| `npm run dev` | Local dev server |
| `npm run deploy` | Production deploy |
