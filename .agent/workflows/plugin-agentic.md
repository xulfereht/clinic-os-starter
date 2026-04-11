---
description: Plugin Agent-First workflow — create, test, submit plugins safely
category: dev
---

# Plugin Workflow

## 0. Classify First

| User Request | Approach | Path |
|-------------|----------|------|
| Modify existing core page | Page override (NOT plugin) | `src/pages/_local/...` |
| New feature/route/API/admin tab | Plugin | `src/plugins/local/{plugin-id}/` |
| Core bug fix / platform issue | Central patch | Don't workaround with plugin |

## 1. Read Before Starting

Required: `docs/PLUGIN_DEVELOPMENT_GUIDE.md`, `docs/PLUGIN_API_REFERENCE.md`, `src/lib/plugin-loader.ts`.
HQ store flow: `hq/src/index.js`, `hq/migrations/0014_plugin_marketplace.sql`.

## 2. Plugin Location

**Always**: `src/plugins/local/{plugin-id}/` — safe from core:pull.
**NEVER**: `src/plugins/{id}/` (core path) or `core/src/plugins/` (submodule).

```
src/plugins/local/{plugin-id}/
├── manifest.json        # Required
├── README.md            # Required
├── pages/               # Route pages
├── api/                 # Optional API endpoints
├── lib/                 # Optional helpers
└── migrations/          # Optional DB schema
```

Scaffold: `npm run plugin:create -- --id=my-plugin --type=new-route --with-admin --dry-run --json`

## 3. Manifest

Runtime SOT: `src/lib/plugin-loader.ts`.

Required fields: id, name, description, version, author, permissions, type.
Recommended: routes, pages, apis, hooks, documentation.
Note: hooks use `event` field (runtime); some validator code may use `type` — runtime wins.

## 4. Import Rules

Plugins run as app-internal source. Use relative paths matching actual file depth:
```
src/plugins/local/my-plugin/api/stats.ts    → ../../../../lib/plugin-sdk
src/plugins/local/my-plugin/pages/index.astro → ../../../components/layout/BaseLayout.astro
```
Do NOT assume `@clinic-os/plugin-sdk` import path.

## 5. Data Rules (HARD)

- NEVER modify core tables or root `migrations/`
- Plugin writes: `custom_*` tables and `plugin_storage` only
- Schema changes: `src/plugins/local/{pluginId}/migrations/` or `sdk.migrations`
- Table naming: `custom_{plugin_id}_{entity}`

## 6. Development Flow

1. Classify request → confirm plugin approach
2. Create in `src/plugins/local/{plugin-id}/`
3. Write manifest.json, README.md, pages/
4. Add api/, lib/, migrations/ as needed
5. `npm run build`
6. Verify: `/ext/{pluginId}`, `/admin/hub/{pluginId}`
7. Run migration if needed: `/api/plugins/migrate` or admin UI

## 7. HQ Store Submission

Prerequisites: admin session, dev mode, valid license, README + documentation filled.
Flow: local validator → zip → checksum → HQ `/api/plugins/submit`.

## 8. HQ Store Installation

Flow: HQ metadata fetch → permission analysis → extract to `src/plugins/local/{pluginId}` (dev mode) → DB record `installed_pending_rebuild` → rebuild → activate.
If not visible after install → rebuild needed.

## 9. Warning Signs

- HQ schema/init vs marketplace code mismatch → fresh DB submission may break
- Missing plugin_submissions records → review tracking unclear
- Some API auth is `admin_session=` string check only
- Verify plugin permissions match actual local request scope

## 10. Escalate to Central Patch

- Store submission/review itself is broken
- HQ schema mismatch
- Plugin enable/disable policy bugs
- Manifest contract drift
- SDK import path doc errors

## 11. Completion Checklist

- [ ] Chose `_local/` vs plugin correctly
- [ ] Only touched `src/plugins/local/`
- [ ] No core table modifications
- [ ] Only `custom_*` tables created
- [ ] Build + route verified
- [ ] README + documentation filled (if submitting)
- [ ] Platform issues separated to audit/central patch
