---
description: Troubleshooting & recovery guide — 13 scenarios with diagnostic priority
category: ops
---

# Troubleshooting & Recovery

## Auto-Entry

If `.agent/last-error.json` exists → enter this workflow immediately.
1. Read `last-error.json` → check `phase` field
2. Match `recovery.section` to scenario below
3. Execute `recovery.commands` in order
4. Success → delete `last-error.json` | Failure → report to user

| phase | Meaning | Scenario |
|-------|---------|----------|
| `git-fetch` | Upstream fetch failed | 1, 4 |
| `migration` | DB migration failed | 6 |
| `precondition` | Prereq missing | 3 (wrangler.toml) |
| `unknown` | Unclassified | Start with `npm run health` |

## Diagnostic Priority

```
npm run health          → Environment score (0-100)
npm run core:status     → Core version, backup state
npm run doctor          → DB schema validation
npm run agent:doctor -- --json → Version/error/action priority
→ Identify cause → scenario-specific fix below
```

## Command Reference

| Command | Purpose | Destructive? |
|---------|---------|-------------|
| `npm run agent:doctor -- --json` | Install/version/error diagnosis | No |
| `npm run agent:lifecycle -- --json` | Scenario detection (fresh/update/reinstall) | No |
| `npm run agent:snapshot -- --reason=...` | Protection snapshot | No |
| `npm run agent:restore -- --dry-run --json` | Restore plan from backups | No |
| `npm run agent:sync -- --dry-run` | Auto-fix preview | No |
| `npm run agent:sync` | Execute safe auto-fixes | Partial |
| `npm run health:fix` | Diagnose + auto-repair | Partial |
| `npm run core:repair` | Fix broken core/ submodule | Partial |
| `npm run core:rollback` | Restore previous core version | Yes |
| `npm run update:starter` | Re-download infra from HQ R2 | No |
| `npm run doctor` | DB schema validation + repair | Partial |
| `npm run db:restore` | Restore from latest DB backup | Yes |

## Scenarios

### 1. core:pull "not a git repository"
Root `.git` missing. Fix: `git init && npm run core:pull -- --auto`

### 2. core/ submodule broken
Symptoms: core:pull fails, "embedded git repository" warning.
Fix: `npm run core:repair` → `npm run core:pull`

### 3. Starter infra damaged (scripts broken)
Fix: `npm run update:starter`. If that fails: `node scripts/update-starter-standalone.cjs`. If standalone missing: `curl -o scripts/update-starter-standalone.cjs "https://clinic-os-hq.pages.dev/api/v1/starter-files/update-starter-standalone.cjs"`.
Note: fetch.js fixes apply on NEXT core:pull (chicken-and-egg).

### 4. core:pull interrupted (network/disk)
Fix: `npm run core:rollback` → retry `npm run core:pull`

### 5. .core/version corrupted
Fix: `npm run core:status` → manually write correct version to `.core/version` → or `npm run core:pull --force`

### 6. DB migration/seed all fail
Causes: local D1 not initialized, wrangler.toml missing/placeholder.
- No wrangler.toml → `npm run setup:step -- --next`
- wrangler.toml exists but no DB → `npm run db:init && npm run db:seed`
- `database_id = "local-db-placeholder"` → local dev default, run `npm run db:migrate`
- Orphan DB (ID changed) → v1.24.2+ auto-detects. Manual: `npm run update:starter && npm run core:pull`

### 7a. DB schema errors ("no such column", "table already exists")
Fix: `npm run doctor` → `npm run db:migrate` → if still fails: `npm run db:restore && npm run db:migrate`

### 7b. Core file accidentally modified
Prevention: copy to `_local/` before editing. Already modified: `git diff > patch && git checkout file && cp to _local/ && apply patch`

### 8. _local/ import path error
Rule: `_local/` file imports must use ORIGINAL file position paths (virtual mapping). Use `@components/`, `@lib/` aliases.

### 9. HQ API unreachable
Auto-fallback: HQ API → Git tag fallback → local `.core/version`. Manual: `npm run dev` and `npm run build` work without HQ.

### 10. Device registration limit
Max 5 per client (auto-upgraded from 3). Contact HQ admin or re-run setup.

### 11. Full reinstall (last resort)
```bash
npm run agent:lifecycle -- --json
npm run agent:snapshot -- --reason=legacy-migration
npm run agent:restore -- --dry-run --json
```
Then: backup client data (wrangler.toml, clinic.json, .docking/config.yaml, local/ dirs) → `npm run update:starter && npm run core:pull` → restore client data → `npm install && npm run db:migrate` → `npm run health && npm run build`

### 12. Production rollback
`npx wrangler pages deployment rollback` or Cloudflare dashboard → Deployments → Rollback.

### 13. DB backup missing before migration
Prevention: always `npm run db:backup` before `npm run db:migrate`. Restore: `npm run db:backup --list && npm run db:restore`

## Escalation

2+ failed attempts on any scenario → explain to user + `/troubleshoot` skill re-diagnosis.
Critical: `.docking/config.yaml` corruption, HQ auth failure, CF binding errors.

## FAQ

- **update:starter vs core:pull**: starter = infra files from HQ R2. core:pull = app code by version tag. Run both for full update.
- **Re-running setup**: safe — existing configs preserved, DB is IF NOT EXISTS. Caution with `--fresh`.
- **Backup before core:pull**: auto-snapshot to `.core-backup/`. Extra safety: `git commit` first.
