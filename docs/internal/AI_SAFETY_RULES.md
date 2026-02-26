# Clinic-OS File Safety Rules

> These rules are auto-loaded by Claude Code. Violation causes data loss on core:pull.

## HARD Rules (Mandatory)

- **[HARD] NEVER modify core paths directly:**
  - `src/pages/` (except `src/pages/_local/`)
  - `src/components/`
  - `src/layouts/`
  - `src/lib/` (except `src/lib/local/`)
  - `migrations/`

- **[HARD] Use `_local/` for page overrides:**
  ```
  src/pages/_local/{same-path}.astro  →  overrides  src/pages/{same-path}.astro
  ```
  The `clinicLocalOverrides` Vite plugin makes `_local/` take priority at build/dev.

- **[HARD] Use `local/` directories for client code:**
  - `src/lib/local/` — client utilities
  - `src/plugins/local/` — client plugins
  - `src/survey-tools/local/` — client survey tools
  - `public/local/` — client static assets

- **[HARD] NEVER modify protected config files:**
  - `wrangler.toml` — client D1/R2/secrets config
  - `clinic.json` — client license/identity
  - `.docking/config.yaml` — client docking config

- **[HARD] Check `.docking/config.yaml` for additional protected paths:**
  - `protected_pages:` lists client-specific pages that must not be modified
  - `protected_prefixes:` lists path prefixes that are fully protected

## Why These Rules Exist

`core:pull` updates core files from upstream by overwriting them.
Files in `local/` and `_local/` directories are **never touched** by core:pull.
Files in `PROTECTED_EXACT` and `config.yaml protected_pages` are **skipped**.
Everything else in core paths **gets overwritten**.

If you modify a core file directly, the change **will be lost** on next core:pull.

## Safe Patterns

### Customize an existing page
```bash
mkdir -p src/pages/_local/doctors
cp src/pages/doctors/index.astro src/pages/_local/doctors/index.astro
# Edit _local/ copy — it takes priority at build time
```

### Add a new feature
```bash
mkdir -p src/plugins/local/my-feature
# Create manifest.json + pages/ in the local plugin
```

### Add client utilities
```bash
# src/lib/local/my-helper.ts — safe from core:pull
```

### Modify DB schema
```sql
-- Create new tables with custom_ prefix
CREATE TABLE custom_my_data (...);
-- NEVER ALTER existing core tables
```

## Reference Docs

- `docs/CUSTOMIZATION_GUIDE.md` — full guide with examples
- `docs/LOCAL_GIT_ARCHITECTURE.md` — technical spec
- `docs/PLUGIN_DEVELOPMENT_GUIDE.md` — plugin creation guide
