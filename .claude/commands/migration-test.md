# /migration-test — Core Update Dry-Run Simulation

Simulates a `core:pull` update without making any actual changes.
Analyzes what files would be added, modified, deleted, or merged.
Primarily for client repos, but also works in master.

## Source of Truth

- Core pull engine: `.docking/engine/fetch.js` (--dry-run flag)
- Protection manifest: `.docking/protection-manifest.yaml`
- Dry-run report: `.docking/dry-run-report.json` (generated output)

## Procedure

### 1. Determine target channel

Ask user which channel to simulate against:

```
[A] stable (default) — production releases
[B] beta — pre-release testing
[C] specific version — e.g., v1.23.0
```

### 2. Run dry-run simulation

```bash
# Stable channel (default)
node .docking/engine/fetch.js --dry-run

# Beta channel
node .docking/engine/fetch.js --dry-run --beta

# Specific version
node .docking/engine/fetch.js --dry-run v1.23.0
```

The engine will:
1. Fetch upstream tags without modifying local files
2. Compare current version against target
3. Classify every changed file into protection categories
4. Output detailed report
5. Save JSON report to `.docking/dry-run-report.json`

### 3. Read and analyze the JSON report

```bash
cat .docking/dry-run-report.json
```

Report structure:
```json
{
  "from": "v1.22.0",
  "to": "v1.23.0",
  "timestamp": "2026-02-26T...",
  "protected": [{"status": "M", "path": "wrangler.toml"}],
  "local": [{"status": "M", "path": "src/lib/local/helper.ts"}],
  "willApply": [{"status": "M", "path": "src/pages/index.astro"}],
  "willDelete": [{"status": "D", "path": "src/old-file.ts"}],
  "willMerge": [{"status": "M", "path": "package.json"}],
  "engine": [{"status": "M", "path": ".docking/engine/fetch.js"}]
}
```

### 4. Risk analysis

Evaluate the update impact:

**Check for potential conflicts:**
- Files in `willApply` that the client has also modified in `src/pages/_local/`
- Files in `willDelete` that the client might depend on
- `willMerge` items (package.json) — check for dependency changes
- Engine updates — note self-update behavior

**Check for migration needs:**
- New files in `migrations/` → DB schema changes expected
- Changes to `seeds/` → default data updates
- Changes to `.agent/` → workflow updates

### 5. Present impact report

```
🔍 Core Update Impact Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Version: v1.22.0 → v1.23.0

🔒 Protected (no change): N files
   - wrangler.toml
   - clinic.json
   ...

📁 Local (untouched): N files
   - src/lib/local/...
   - src/plugins/local/...

📝 Will Apply (add/modify): N files
   - src/pages/index.astro [M]
   - src/components/new-widget.astro [A]
   ...

🗑️ Will Delete: N files
   - src/old-deprecated.ts [D]

🔀 Will Merge: N files
   - package.json (smart merge)

⚙️ Engine Update: N files
   - .docking/engine/fetch.js [M]

⚠️ Potential Concerns:
   - 3 new migrations detected → DB schema changes
   - package.json adds 2 new dependencies
   - [conflict risk] src/pages/doctors/index.astro modified
     (you have _local override → safe)

✅ Overall: Safe to proceed
   Run: npm run core:pull [--beta]
```

## Rules

- All user-facing output in Korean
- **Never modify files** — this is read-only analysis
- Read `.docking/dry-run-report.json` for structured data
- Cross-reference with `src/pages/_local/` to detect override conflicts
- Mention migration count if `migrations/` files changed
- Recommend `npm run db:backup` before actual update
