# Clinic-OS File Safety Rules

> Auto-loaded by Claude Code. Violation causes data loss on core:pull.

## HARD Rules

### Core Paths (core:pull overwrites — NEVER modify directly)

- `src/pages/` (except `_local/`), `src/components/`, `src/layouts/`
- `src/styles/` (except `global.css` — PROTECTED_EXACT)
- `src/lib/` (except `local/`), `src/skins/` (except `local/`)
- `src/plugins/survey-tools/`, `src/survey-tools/stress-check/`, `src/content/aeo/`
- `migrations/`, `seeds/`, `docs/`, `scripts/`, `.docking/engine/`
- `.agent/manifests/`, `.agent/workflows/`, `.claude/commands/`, `.claude/rules/`
- Single files: `CLAUDE.local.md`, `SOUL.local.md`, `MANIFEST.local.md`, `.agent/README.md`, `.agent/onboarding-registry.json`, `package.json`, `astro.config.mjs`, `tsconfig.json`

### Protected Files (NEVER modify — forbidden even at Tier 3)

- `wrangler.toml` — client D1/R2/secrets config
- `clinic.json` — client license/identity
- `.docking/config.yaml` — client docking config
- `src/config.ts`, `src/styles/global.css`, `.agent/onboarding-state.json`

### Safe Zones (local/ — core:pull never touches these)

- `src/lib/local/`, `src/skins/local/`, `src/plugins/local/`
- `src/pages/_local/`, `src/survey-tools/local/`
- `public/local/`, `docs/internal/`
- `.agent/issues/`, `.agent/core-patches.log`

### Page Override Convention

src/pages/_local/{same-path}.astro overrides src/pages/{same-path}.astro
(`clinicLocalOverrides` Vite plugin makes `_local/` take priority)

### Additional Protection

Check `.docking/config.yaml` for `protected_pages:` and `protected_prefixes:`.

## Why These Rules Exist

`core:pull` overwrites core files from upstream. `local/`/`_local/` directories are never touched. `PROTECTED_EXACT` files are skipped. Everything else in core paths gets overwritten. If you modify a core file directly, the change will be lost.

## Safe Patterns

```bash
# Page override
cp src/pages/doctors/index.astro src/pages/_local/doctors/index.astro
# Edit _local/ copy — it takes priority at build time

# New feature plugin
mkdir -p src/plugins/local/my-feature
# Create manifest.json + pages/ in the local plugin

# Client utilities — src/lib/local/my-helper.ts (safe from core:pull)

# DB schema — custom_ prefix, NEVER ALTER existing core tables
# CREATE TABLE custom_my_data (...);
```