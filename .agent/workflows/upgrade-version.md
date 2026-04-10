---
description: Version upgrade — Core + Starter update procedure with post-upgrade checks
category: dev
---

# Version Upgrade

Safe upgrade procedure for Core (app code) and Starter (infra) updates.
For agent-first guided flow, see `core-update-agentic.md`.

## Pre-Check

```bash
npm run agent:lifecycle -- --json
```
- `safe_update_in_place` → snapshot then update
- `legacy_reinstall_migration` → fresh starter-kit install + snapshot transfer
- `production_binding_drift` → review wrangler bindings before proceeding

## Upgrade Phases

### 1. Backup
```bash
npm run agent:snapshot -- --reason=pre-update
git add -A && git commit -m "Backup before upgrade"
```

### 2. Core Update
```bash
npm run core:pull -- --auto    # HQ → latest app package → auto-apply
```

### 3. Starter Update (if needed)
```bash
npm run update:starter         # Re-download infra (scripts/, .docking/engine/)
```

### 4. Docking Package (manual ZIP)
```bash
npm run upgrade                # Apply external .zip package
```

### 5. DB Migration
core:pull auto-applies DDL migrations to local DB (v1.29.7+).
- `migrations/` = DDL only. Auto-applied locally + on deploy (deploy-guard).
- `seeds/` = DML only. Initial setup only. Production data protected.
- Remote DB: deploy-guard applies gap migrations at deploy time. core:pull does NOT touch remote.
- Manual: `npm run db:migrate`

Note: fetch.js fixes apply on NEXT core:pull (chicken-and-egg). Emergency: `npm run update:starter && npm run core:pull`.

### 6. Test
```bash
npm run dev
```
Check: homepage loads, admin login, existing customizations intact, new features work.

### 6.5. Post-Upgrade Auto-Check

**Custom homepage data contamination (v1.31.4)**:
Master-specific data (바로한의원) may have leaked into client homepages in versions <v1.31.3. PROTECTED_PREFIXES prevents core:pull from auto-fixing.

```bash
# Detect contamination
grep -l "안태석\|문지현\|RDMS\|RMSK\|lystKvO0_q8\|국가대표 진료" \
  src/plugins/custom-homepage/pages/index.astro \
  src/plugins/local/custom-homepage/pages/index.astro 2>/dev/null
```

If found:
- **Not customized yet**: `cp src/plugins/custom-homepage/presets/editorial.astro src/plugins/custom-homepage/pages/index.astro`
- **Already customized**: Replace 바로한의원 data (names, credentials, papers, YouTube, badges) with clinic-specific data or empty arrays/strings
- **Best practice**: Move to `src/plugins/local/custom-homepage/` for full core:pull protection

### 7. Complete
```bash
git add -A && git commit -m "Upgrade to v[VERSION]"
npm run deploy    # If deployment needed
```

## Rollback
```bash
npm run core:rollback    # Restore from .core-backup/
# Or: git checkout backup-{date}
```

## Command Summary

| Command | Purpose |
|---------|---------|
| `npm run core:pull -- --auto` | App code update from HQ |
| `npm run update:starter` | Infra files update |
| `npm run upgrade` | Manual docking package |
| `npm run db:migrate` | DB schema migration |
| `npm run doctor` | DB validation + repair |
| `npm run health` | Environment health (0-100) |
| `npm run core:rollback` | Restore previous core |

## Related
- Error recovery: `troubleshooting.md`
- Agent-first guided flow: `core-update-agentic.md`
- Smart migration (preserve work): `smart-migration.md`
