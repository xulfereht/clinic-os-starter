# SPEC-FIX-PLUGIN-UI-001: Plugin Management UI Classification Fix

## Metadata

| Field    | Value                           |
| -------- | ------------------------------- |
| SPEC ID  | SPEC-FIX-PLUGIN-UI-001         |
| Title    | Plugin Management UI Classification Fix |
| Created  | 2026-02-12                      |
| Status   | Planned                         |
| Priority | High                            |
| Lifecycle| spec-first                      |

---

## Environment

- **Platform**: Clinic-OS (Astro + Cloudflare Workers)
- **Database**: Cloudflare D1 (`installed_plugins` table with `source` column: `'hq'` | `'local'`)
- **Build-time Registry**: `src/lib/plugin-loader.ts` uses `import.meta.glob` to detect all plugins under `src/plugins/` and `src/plugins/local/`
- **Plugin Directories**: `src/plugins/` (core), `src/plugins/local/` (local + HQ-installed)
- **Admin UI**: `src/pages/admin/plugins/index.astro` (plugin management), `src/pages/admin/plugins/store.astro` (marketplace)
- **API Endpoints**: `/api/plugins/local` (filesystem scan), `/api/plugins/install-status` (DB + registry merge)

---

## Assumptions

1. HQ-installed plugins are downloaded to `src/plugins/local/` and recorded in the `installed_plugins` DB table with `source = 'hq'`
2. Self-developed plugins exist only in `src/plugins/local/` and do NOT have a corresponding `installed_plugins` DB row with `source = 'hq'`
3. The `installed_plugins` table is the source of truth for distinguishing HQ-installed vs self-developed local plugins
4. Build-time `plugin-loader.ts` assigns `source: 'local'` to ALL plugins found in `src/plugins/local/`, regardless of their actual origin
5. The `/api/plugins/local` endpoint currently scans the filesystem only and does not consult the DB

---

## Requirements

### REQ-001: Local API Must Filter Out HQ-Installed Plugins

**WHEN** the `/api/plugins/local` endpoint scans `src/plugins/local/`, **THEN** the system **shall** cross-reference each plugin ID against the `installed_plugins` DB table and exclude plugins where `source = 'hq'`.

- **File**: `src/pages/api/plugins/local.ts`
- **Rationale**: The "My Plugins" tab should only show plugins the user actually developed, not plugins downloaded from HQ store

### REQ-002: "My Plugins" Tab Must Show Only Self-Developed Plugins

**WHEN** the "My Plugins" (내 플러그인) tab loads in the plugin management page, **THEN** the system **shall** display only plugins that exist in `src/plugins/local/` AND are NOT recorded as `source = 'hq'` in the `installed_plugins` DB table.

- **File**: `src/pages/admin/plugins/index.astro` (line 64-65, tab definition; line 836+, rendering logic)
- **Rationale**: Prevents confusion between self-developed and store-downloaded plugins

### REQ-003: HQ-Installed Plugins Must Appear in "Installed Plugins" Tab

**WHEN** the "Installed Plugins" (설치된 플러그인) tab renders, **THEN** the system **shall** include HQ-installed plugins that reside in `src/plugins/local/` with an "HQ에서 설치됨" badge alongside their existing information.

- **File**: `src/pages/admin/plugins/index.astro` (line 71-149, installed tab rendering)
- **Rationale**: Users need to see all installed plugins in one consolidated view, with clear source attribution

### REQ-004: HQ Submit Button Must Not Appear for HQ-Downloaded Plugins

**WHEN** rendering a plugin in the "My Plugins" tab, **IF** the plugin was originally downloaded from HQ (i.e., `source = 'hq'` in DB), **THEN** the system **shall not** display the "HQ에 제출" submit button for that plugin.

- **File**: `src/pages/admin/plugins/index.astro` (line 876, submit button)
- **Rationale**: HQ-downloaded plugins already exist on the marketplace; submitting them again is redundant and confusing

### REQ-005: Store Page Must Correctly Show Install Status Badges

**WHEN** the store page calls `/api/plugins/install-status` to check installed plugins, **THEN** the system **shall** correctly identify all installed plugins including those registered at build-time from `src/plugins/local/`, and display "Installed" badges on matching marketplace cards.

- **File**: `src/pages/admin/plugins/store.astro` (line 786, `checkInstallStatus()`)
- **File**: `src/pages/api/plugins/install-status.ts` (line 103-122, registry merge logic)
- **Rationale**: Users need accurate visual feedback on which store plugins they already have installed

### REQ-006: Source Attribution Must Be Accurate

The system **shall** display accurate developer/source attribution for all plugins:

- Self-developed plugins in "My Plugins": show manifest `author` with "내 플러그인" badge
- HQ-installed plugins in "Installed Plugins": show manifest `author` with "HQ에서 설치됨" badge
- Core plugins in "Installed Plugins": show manifest `author` with "Core" badge

- **File**: `src/pages/admin/plugins/index.astro` (line 867, author display; line 864, badge)
- **Rationale**: Clear source attribution prevents users from mistakenly believing HQ plugins are their own

### REQ-007: Install Status API Must Include HQ Source Information

**WHEN** the `/api/plugins/install-status` endpoint merges build-time registry data with DB data, **THEN** the system **shall** prefer the DB `source` value (`'hq'`) over the build-time registry `source` value (`'local'`) for plugins that exist in both.

- **File**: `src/pages/api/plugins/install-status.ts` (line 103-122)
- **Rationale**: The DB is the source of truth for plugin origin; the build-time registry does not distinguish HQ-installed from self-developed

---

## Specifications

### SPEC-A: `/api/plugins/local` DB Cross-Reference

1. Accept optional DB access via `locals.runtime?.env?.DB`
2. If DB is available, query `SELECT id FROM installed_plugins WHERE source = 'hq'` to get HQ plugin IDs
3. After scanning filesystem, filter out plugins whose ID matches the HQ set
4. If DB is not available, fall back to current behavior (show all local plugins)
5. Return additional `source` field in response: `'local'` for self-developed

### SPEC-B: Plugin Management Page Tab Restructuring

1. "설치된 플러그인" tab: show ALL `loadInstalledPlugins()` results with source badges
   - `source: 'core'` -> "Core" badge
   - `source: 'local'` AND in DB with `source = 'hq'` -> "HQ에서 설치됨" badge
   - `source: 'local'` AND NOT in DB as HQ -> no special badge (these are self-developed, shown in "내 플러그인" tab)
2. "내 플러그인" tab: fetch from `/api/plugins/local` (which now excludes HQ plugins)
   - Show "내 플러그인" badge only for genuinely self-developed plugins
   - Show "HQ에 제출" button only for these filtered plugins

### SPEC-C: Store Page Install Status Fix

1. `checkInstallStatus()` must match plugin IDs correctly between marketplace cards and install-status response
2. The `/api/plugins/install-status` endpoint must set correct `source` for build-time registry entries by checking DB first
3. If a registry plugin exists in DB, use DB values (especially `source` and `installed_version`)

---

## Constraints

- **Build-time vs Runtime**: `plugin-loader.ts` runs at build time; DB queries run at runtime. The `/api/plugins/local` endpoint runs at dev-mode runtime only.
- **Backward Compatibility**: Changes must not break plugin installation, uninstallation, or toggle functionality
- **Dev-mode Only**: The `/api/plugins/local` endpoint is already restricted to dev mode (`import.meta.env.DEV`)
- **No Schema Changes**: The `installed_plugins` table schema is not modified; we only query existing `source` column

---

## Traceability

| Requirement | Files Modified                                    | Acceptance Criteria |
| ----------- | ------------------------------------------------- | ------------------- |
| REQ-001     | `src/pages/api/plugins/local.ts`                  | AC-001              |
| REQ-002     | `src/pages/admin/plugins/index.astro`             | AC-002              |
| REQ-003     | `src/pages/admin/plugins/index.astro`             | AC-003              |
| REQ-004     | `src/pages/admin/plugins/index.astro`             | AC-004              |
| REQ-005     | `src/pages/admin/plugins/store.astro`, `src/pages/api/plugins/install-status.ts` | AC-005 |
| REQ-006     | `src/pages/admin/plugins/index.astro`             | AC-006              |
| REQ-007     | `src/pages/api/plugins/install-status.ts`         | AC-007              |
