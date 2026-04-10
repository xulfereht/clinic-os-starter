---
description: Apply docking package (.zip) to project with conflict resolution
category: dev
---

# Package Apply (Unpack Docking)

Apply downloaded `.zip` package with intelligent merge — not blind overwrite.

## Quick Start

```bash
npm run upgrade
```

Auto: detect .zip → staging → conflict analysis → backup → apply → migrate → record.

## Process

### 1. Package Detection
Scans project root and `.docking/incoming/` for `.zip` files. No package → guide to `npm run core:pull` or manual placement.

### 2. Staging
Extract to `.docking/staging/`.

### 3. Manifest Analysis
Read `staging/manifest.yaml`: version info, package type (full/patch), changed file list.

### 4. Conflict Analysis

| Conflict | Action |
|----------|--------|
| No local changes | Auto-apply |
| Local file modified | User choice: A) merge (recommended), B) package version, C) keep local |

### 5. Backup
```bash
git add -A && git commit -m "Backup before package apply"
```

### 6. Apply
- New files → copy
- Changed files → replace or merge (per step 4 decision)
- Deleted files → user confirmation before removal

### 7. Migration
```bash
npm run db:migrate    # If new migrations included
```
Failure → `.agent/last-error.json` generated. See `troubleshooting.md` scenario 6.

### 8. Record
Append to `.docking/.applied`: `[date] v[version] [type] applied`

### 9. Complete
```bash
npm install    # If dependencies changed
npm run dev    # Local test
npm run deploy # Production (if ready)
```

## Update Methods Comparison

| Method | Command | Source |
|--------|---------|--------|
| Core update | `npm run core:pull` | HQ app package |
| Starter update | `npm run update:starter` | HQ infra files |
| Manual package | `npm run upgrade` | Local .zip file |

## Rollback

```bash
git checkout HEAD~1           # Undo last apply
git checkout backup-{date}    # Restore from backup branch
```
