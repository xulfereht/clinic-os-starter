# /plugin — Plugin Manager

Collaboratively create, test, and publish plugins with the client.
Designed for extending Clinic-OS with custom features — pages, APIs, widgets, homepage overrides.

## When to Use

- Creating a new custom feature for the clinic (reservation page, events, dashboard)
- Listing installed plugins and checking their status
- Editing or modifying an existing local plugin
- Testing plugin validity before deployment
- Submitting a local plugin to the HQ marketplace

## Source of Truth

- Plugin loader: `src/lib/plugin-loader.ts`
- Plugin SDK: `src/lib/plugin-sdk.ts`
- Universal router: `src/pages/ext/[...path].astro`
- Local plugin path: `src/plugins/local/{plugin-id}/`
- Development guide: `docs/PLUGIN_DEVELOPMENT_GUIDE.md`
- HQ submit API: `src/pages/api/plugins/submit.ts`
- HQ install API: `src/pages/api/plugins/install.ts`

## Modes

Detect user intent and route to the appropriate mode:

| Intent | Mode |
|--------|------|
| 만들기, 새 기능, 플러그인 만들기, create | `create` |
| 목록, 어떤 플러그인, list | `list` |
| 수정, 편집, edit | `edit` |
| 테스트, test | `test` |
| 공개, 제출, publish | `publish` |
| 삭제, remove | `delete` |

If unclear, ask:
```
What would you like to do?
[A] Create a new plugin
[B] View/edit existing plugins
[C] Submit to HQ
```

---

## Mode: create

### Step 1 — Discovery (conversation)

DO NOT immediately generate files. First, understand what the user needs:

```
What feature would you like to add?

Examples:
• Custom reservation page for your clinic
• Event/promotion management
• Patient survey results dashboard
• Director's blog/column
• Membership/points system
• Homepage customization

Please describe freely. Tell us what pages are needed and who will use them,
and we'll design the optimal structure.
```

Gather:
- **Purpose**: What does this plugin do?
- **Users**: Admin only? Public? Both?
- **Pages needed**: What screens/views are required?
- **Data**: Does it need its own DB tables? (`custom_` prefix required)
- **Type**: New route (`/ext/{id}/...`) or homepage override?
- **Permissions**: Does it need access to patients, reservations, etc.?

### Step 2 — Architecture Design

Present the design before generating:

```
📦 Plugin Design
━━━━━━━━━━━━━━━━━

Name: {name}
ID: {plugin-id}
Type: {new-route | override}
Path: /ext/{plugin-id}/

📄 Pages:
  • / — Main page (public)
  • /admin — Admin page (admin only)
  ...

🗄️ Database:
  • custom_{table} — {description}
  ...

🔐 Permissions:
  • read:patients — patient data access
  ...

Proceed with this design?
```

Iterate until the user approves.

### Step 3 — Generate Files

Create in `src/plugins/local/{plugin-id}/`:

**manifest.json** (always required):

```json
{
  "id": "{plugin-id}",
  "name": "{name}",
  "description": "{description}",
  "version": "1.0.0",
  "author": "{clinic name}",
  "type": "new-route",
  "category": "{category}",
  "permissions": [],
  "routes": {
    "base": "/ext/{plugin-id}",
    "public": [
      { "path": "/", "file": "pages/index.astro", "title": "Main" }
    ]
  },
  "documentation": {
    "summary": "{10+ character summary}",
    "features": ["{feature1}", "{feature2}"]
  }
}
```

**README.md** (required for HQ submission):

```markdown
# {Plugin Name}

{Description}

## Features
- {feature 1}
- {feature 2}
```

**pages/index.astro** (main page):

```astro
---
/**
 * {Plugin Name} - Main Page
 * Route: /ext/{plugin-id}/
 */
interface Props {
    settings?: any;
    db?: any;
    pluginId?: string;
    path?: string;
    url?: URL;
    request?: Request;
    plugin?: any;
}

const props = Astro.props as Props;
// @ts-ignore
const db = props.db ?? Astro.locals?.runtime?.env?.DB;
const settings = props.settings;
---

<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{name}</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>
<body>
    <!-- Plugin content here -->
</body>
</html>
```

**migration.sql** (if DB tables needed):

```sql
-- Custom tables must use custom_ prefix
CREATE TABLE IF NOT EXISTS custom_{table_name} (
    id TEXT PRIMARY KEY,
    -- columns...
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);
```

### Page Template Patterns

**Public page** (visitors/patients see this):
- Use standalone HTML with Tailwind CDN
- Include clinic branding via `settings.clinic_name` etc.
- Mobile-first responsive design

**Admin page** (accessible via admin hub):
- Import `AdminLayout` from `../../../layouts/AdminLayout.astro`
- Follow admin UI patterns (cards, tables, forms)
- Add to manifest: `"pages": [{"path": "manage", "title": "Manage"}]`

**Override page** (replaces homepage):
- Type: `"override"` in manifest
- `"overrides": [{"path": "/", "file": "pages/index.astro", "priority": 10}]`
- Higher priority wins when multiple plugins override same path

### Step 4 — DB Migration (if needed)

If the plugin has `migration.sql`:

```bash
npm run dev
# In another terminal or via API:
curl -X POST http://localhost:4321/api/plugins/migrate \
  -H "Content-Type: application/json" \
  -d '{"pluginId": "{plugin-id}"}'
```

### Step 5 — Build & Test

```bash
npm run build
```

If build succeeds:

```
✅ Plugin creation complete!

📂 Location: src/plugins/local/{plugin-id}/
🔗 Public URL: /ext/{plugin-id}/
🔗 Admin Hub: /admin/hub/

Next steps:
  1. Test locally with npm run dev
  2. Verify at /ext/{plugin-id}/
  3. Deploy to make it available in production
  4. Optionally submit to HQ to share with other clinics
```

### Step 6 — Deploy Offer

```
Deploy the plugin?
[A] Local only (use only at this clinic)
[B] Submit to HQ (available to other clinics)
```

---

## Mode: list

Scan plugins and present:

```
📋 Installed Plugins
━━━━━━━━━━━━━━━━━

🔵 Core (managed by core:pull)
  • survey-tools — Survey tool platform [new-route] /ext/survey-tools
  • custom-homepage — Homepage custom [override] /

🟢 Local (this clinic only)
  • {id} — {name} [{type}] {route}

Total: {N} plugins
```

Also check plugin status in DB:

```sql
SELECT plugin_id, status, installed_at FROM installed_plugins
```

---

## Mode: edit

1. List plugins (same as `list`)
2. User selects a plugin
3. Only edit plugins in `local/` — core plugins require override:
   - "Modifying a core plugin will be overwritten on core:pull."
   - "Copy to local/ with the same ID and edit there?"
4. Read manifest and pages, apply changes, rebuild

---

## Mode: test

1. Verify manifest.json validity
2. Check all referenced page files exist
3. If migration.sql exists, validate SQL syntax
4. Run build
5. Report status:

```
🧪 Plugin Validation: {name}
━━━━━━━━━━━━━━━━━━━━━━

✅ manifest.json — valid
✅ pages/index.astro — exists
✅ migration.sql — SQL valid
✅ Build — success
⚠️  HQ submission requirements:
  ✅ README.md exists
  ✅ documentation.summary (10+ chars)
  ✅ documentation.features (1+ items)
```

---

## Mode: publish

Submit a local plugin to HQ marketplace.

### Pre-checks

1. Plugin must be in `src/plugins/local/`
2. Required for HQ submission:
   - `README.md` exists
   - `manifest.documentation.summary` (min 10 chars)
   - `manifest.documentation.features` (min 1 item)
   - `pages/` directory exists
   - No security violations (eval, dynamic code generation, etc.)
3. Build must pass

### Procedure

1. Validate all HQ submission requirements
2. Fix any gaps (add README, documentation, etc.)
3. Guide user:

```
📦 HQ Submission Preparation
━━━━━━━━━━━━━━

Plugin: {name} v{version}
Type: {type}
Permissions: {permissions count}
Pages: {pages count}

⚠️  Once submitted to HQ, it will be reviewed and published to other Clinic-OS users.
Submit? [Y/n]
```

4. Dev server must be running (`npm run dev`)
5. Submit via admin UI: `/admin/hub/` → select the plugin → "Submit to HQ"

---

## Mode: delete

Only local plugins can be deleted.

1. Confirm with user
2. Remove files:
```bash
rm -rf src/plugins/local/{plugin-id}
```
3. If DB tables were created, inform user they remain (safe; custom_ prefix)
4. Rebuild

---

## Plugin Categories

| Category | Korean | Use Case |
|----------|--------|----------|
| `marketing` | 마케팅 | Events, promotions, SEO |
| `integration` | 연동 | External service connections |
| `customization` | 커스터마이징 | UI/UX changes, homepage |
| `analytics` | 분석 | Data visualization, reports |
| `utility` | 유틸리티 | Tools, helpers |
| `communication` | 소통 | Messages, notifications, chat |
| `automation` | 자동화 | Workflows, schedules |
| `ui` | UI | Widgets, themes, components |

## Permission Risk Levels

| Risk | Permissions | Review |
|------|------------|--------|
| Low | `read:reservations`, `read:staff`, `read:settings`, `storage:*`, `ui:*` | Auto-approve |
| Medium | `read:patients`, `read:analytics`, `write:reservations`, `database:read` | User confirm |
| High | `read:payments`, `write:patients`, `write:messages`, `write:settings`, `database:write`, `network:*` | Explicit warning |
| Critical | `write:payments` | Strong warning + double confirm |

When generating permissions, use the minimum required. Explain each to the user.

## DB Table Rules

- All custom tables MUST use `custom_` prefix
- NEVER ALTER existing core tables (patients, reservations, etc.)
- Use `id TEXT PRIMARY KEY` pattern
- Include `created_at INTEGER DEFAULT (unixepoch())`
- Foreign keys to core tables are OK for read relationships

## File Safety

- All files go to `src/plugins/local/` — safe from core:pull
- Never modify `src/plugins/survey-tools/` or `src/plugins/custom-homepage/`
- If overriding a core plugin, copy to `local/{same-id}/` first

## Triggers

- "플러그인", "기능 추가", "확장", "plugin", "새 페이지", "기능 만들기"

## All user-facing output in Korean
