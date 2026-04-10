---
description: Smart Migration — preserve user work during core/starter updates
category: dev
---

# Smart Migration

Intelligent update system that auto-detects, preserves, and migrates existing client work during core:pull or update:starter.

**Before starting**: Run `npm run agent:lifecycle -- --json` to determine scenario:
- `legacy_reinstall_migration` → fresh install + snapshot transfer (prefer over in-place update)
- `safe_update_in_place` → snapshot then proceed with core/starter update

For legacy reinstall: `npm run agent:snapshot -- --reason=legacy-migration` then `npm run agent:restore -- --dry-run --json`.

## 6-Gate Process

### Gate 1: Discovery
Auto-scan for user work:

| Category | Scan Target | Risk |
|----------|-------------|------|
| 🟢 Safe Zone | `src/lib/local/`, `src/plugins/local/`, `src/pages/_local/`, `migrations/local/` | Low (auto-preserve) |
| 🟡 Merge Required | `wrangler.toml`, `.env`, `package.json` | Medium (merge needed) |
| 🔴 High Risk | Core files directly modified (e.g., `src/components/Button.tsx`) | High (will be overwritten) |
| ⚠️ Unknown | Unrecognized files outside safe zones | Needs confirmation |

Report findings to user with category breakdown.

### Gate 2: Preservation Planning
Generate migration strategy per category:
- **Safe Zone** → `action: keep` (no intervention needed)
- **Merge Required** → `action: three-way-merge` with strategy (local-priority / upstream-priority / manual)
- **Core file modified** → `action: move-and-patch-imports` → move to `_local/` equivalent, auto-fix imports
- **Custom DB tables** → `action: preserve-and-verify` compatibility with new schema

Present plan → user approves or adjusts merge strategy.

### Gate 3: Snapshot Backup
```bash
npm run agent:snapshot -- --reason=pre-update
npm run db:backup -- --label="pre-update-$(date +%Y%m%d)"
```
Also: git stash + git tag `before-core-update-{date}`. Save state to `.agent/migration-state.json`.

### Gate 4: Update Execution
Sequential steps: fetch upstream → checkout new version → restore safe zones → execute merges → migrate core files to `_local/` → `npm install` → run DB migrations.

Report progress per step.

### Gate 5: Conflict Resolution
If merge conflicts occur, offer:
1. Upstream priority (recommended) — new settings + move local values to .env
2. Local priority — keep existing, add new as comments
3. Manual merge — show diff
4. Split to new file — create `*.local.*` variant

**Auto-resolvable**: package.json deps (semver), wrangler.toml [vars] (local priority), .env.example (upstream), README/CHANGELOG.

### Gate 6: Verification
```bash
npm run build              # Build test
npm run dev                # Dev server starts
npm run doctor             # DB schema validation
curl localhost:4321        # Homepage responds
curl localhost:4321/admin  # Admin accessible
```
Check: all local files present, imports resolved, custom tables compatible. If verification fails → offer rollback.

## Migration Types

| Type | Example | Strategy |
|------|---------|----------|
| A: Safe Zone | `src/lib/local/*` | Keep as-is (100% auto) |
| B: Config Merge | `wrangler.toml` | Three-way merge |
| C: Core File | Modified `src/components/X.tsx` | Move to `_local/` + patch imports |
| D: DB Schema | Custom tables | Backup → migrate → verify compatibility |

## Rollback

```bash
npm run smart:rollback -- --to=<snapshot-id>
npm run smart:rollback -- --last
# Or via git:
git reset --hard before-core-update-{date}
git stash pop
```

**Auto-rollback triggers**: build_failed, db_migration_failed, custom_plugin_load_failed, critical_file_missing, import_resolution_failed.

## Commands

```bash
npm run smart:update                          # Full auto
npm run smart:update -- --phase=discovery     # Single gate
npm run smart:update -- --dry-run             # Preview only
npm run smart:rollback -- --last              # Rollback
npm run smart:snapshots -- --list             # List snapshots
npm run smart:snapshots -- --clean            # Remove >30d old
```

## State File

`.agent/migration-state.json` tracks: phase (discovery→completed/rolled_back), source/target versions, discovery results, plan, backup refs, execution steps, conflicts + resolutions, verification results.
