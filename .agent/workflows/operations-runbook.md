---
description: Post-install operations SOT — update, deploy, backup, monitoring
category: ops
---

# Operations Runbook

## Core Update (core:pull)

```bash
npm run core:status              # Current version
git commit -am "pre-update"      # Checkpoint
npm run db:backup                # DB snapshot
npm run core:pull                # Fetch + apply (DDL auto, seeds auto)
npm run build                    # Verify build
npm run health && npm run doctor # Health check
```

**Auto on core:pull**: DDL migrations (d1_migrations tracked), unapplied seeds (d1_seeds tracked), skill updates (.claude/commands/), agent docs (SOUL/MANIFEST/workflows).

**Manual after**: `npm run deploy` (deploy-guard applies remote migrations), `npm install` if deps changed, `npm run doctor` if migration conflicts.

## Deploy

```bash
npm run build && npm run deploy
```

**deploy-guard auto-checks**: D1/R2 binding access, remote migration gap (auto-apply), ADMIN_PASSWORD default warning, security settings.

**Pre-deploy checklist**: build passes, health ≥ 80, changes committed, wrangler.toml database_id valid.

## Backup

```bash
npm run db:backup                # D1 snapshot (before risky ops)
npm run agent:snapshot           # Full state (code + DB + config)
git commit -am "checkpoint"      # Code checkpoint
```

Auto-snapshots: `.agent/protection-snapshots/` on deploy, `.core-backup/` on core:pull.

## Daily Commands

| Need | Command |
|------|---------|
| Environment health | `npm run health` |
| DB schema check | `npm run doctor` |
| Core version | `npm run core:status` |
| Onboarding | `/onboarding` skill |
| Blog writing | `/write-blog` skill |
| Dashboard | `/status` skill |
| Troubleshoot | `/troubleshoot` skill |

## Quick Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build fails | `npm install && npm run build` |
| Page 500 | `npm run doctor` → `npm run db:migrate` |
| Migration "already exists" | Normal — PRAGMA auto-skips |
| Seed duplicate | `npm run db:seed` (idempotent) |
| No data after deploy | deploy-guard applies DDL only; seeds are initial-setup only |
| Error after core:pull | `npm install` (new deps) |

Detailed: `workflows/troubleshooting.md`

## Related Scripts

| Script | Purpose |
|--------|---------|
| `scripts/deploy-guard.js` | Deploy safety gate |
| `scripts/health-audit.js` | Health score |
| `scripts/doctor.js` | DB schema validation |
| `scripts/db-backup.js` | DB backup/restore |
| `.docking/engine/fetch.js` | core:pull engine |
| `.docking/engine/migrate.js` | Migration engine |
