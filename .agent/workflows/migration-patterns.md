---
description: Migration pattern dictionary — common scenarios with solutions
category: dev
---

# Migration Patterns

Common migration scenarios during core/starter updates.

## 1. Core Component → _local Migration

User modified `src/components/ui/Button.tsx` directly.

```bash
cp src/components/ui/Button.tsx .backups/migration/Button.tsx.original
mkdir -p src/components/_local/ui
cp src/components/ui/Button.tsx src/components/_local/ui/Button.tsx
# Fix imports: @/components/ui/Button → @/components/_local/ui/Button
git checkout upstream/main -- src/components/ui/Button.tsx
```

Result: custom in `_local/` (preserved), original updated from upstream.

## 2. wrangler.toml Config Merge

Local added ALIGO_API_KEY + CUSTOM_DOMAIN. Upstream changed [vars] structure.

Strategy: three-way merge — keep local vars, adopt upstream structure + new settings.
```
merged.vars = { ...upstream.vars, ...local_custom_vars }
merged.d1_databases = upstream.d1_databases
merged.compatibility_date = upstream.compatibility_date
```

## 3. DB Custom Table Compatibility

User created `custom_patient_extra`. New version changes `patients` schema.

```sql
CREATE TABLE custom_patient_extra_backup AS SELECT * FROM custom_patient_extra;
-- Apply new migration
-- Verify: SELECT CASE WHEN EXISTS (SELECT 1 FROM pragma_table_info('patients') WHERE name='new_column') THEN 'compatible' END;
```

## 4. Plugin Compatibility Check

Verify plugin works with new core version:
```javascript
// Read manifest.minCoreVersion / maxCoreVersion
// semver.satisfies(currentCore, `${min} - ${max}`)
```

## 5. Git-less Environment Update

Starter Kit from ZIP, no git history:
```bash
diff -r .backups/pre-update/ . --exclude=node_modules > changes.patch
# Apply new version files
patch -p1 < changes.patch
```

## 6. Merge Priority Rules

| Priority | Files | Strategy |
|----------|-------|----------|
| Local first | `wrangler.toml[vars]`, `.env`, `src/config.ts`, `src/styles/global.css` | Keep local values |
| Upstream first | `package.json[deps]`, `astro.config.mjs`, `tsconfig.json`, `migrations/*.sql` | Accept upstream |
| Manual decision | `src/components/**`, `src/lib/**`, `README.md` | Show diff, user decides |
