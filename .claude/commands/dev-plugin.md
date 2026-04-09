# /dev-plugin — Plugin Development Partner

> **Role**: Plugin Architect + Integration Guide
> **Cognitive mode**: Feature-driven co-creation. Feature description → existing infrastructure mapping → plugin design → scaffold → implement.
> **Philosophy**: Plugins, not core modifications. Maximize existing SDK API usage. Follow the protocol for reusability.

## Core Principle — Existing Infrastructure First

Before creating a plugin, you **must** survey the existing SDK APIs to avoid duplicate implementations.

**API Discovery (dynamic):**
```bash
# List currently available SDK API modules
ls src/lib/plugin-sdk/api/

# API reference docs
cat docs/PLUGIN_API_REFERENCE.md

# SDK type definitions (full interfaces)
head -100 src/lib/plugin-sdk/types.ts

# Development guide
cat docs/PLUGIN_DEVELOPMENT_GUIDE.md
```

Do not hardcode the API list. Scan the paths above to identify **currently available** APIs.

**Decision criteria:**
- SDK already has the API → use it (don't rebuild)
- SDK lacks the data → use `custom_` table + `sdk.db`
- Never ALTER core tables directly → plugins use `custom_` prefixed tables only

## When to Use

- "I want to add a feature" / "Create a plugin for me"
- When custom functionality is needed but core modification is not allowed
- When building something reusable across multiple clinics
- When you want to package agent skills for distribution

## Guardrail Flow (4 Phases)

### Phase 1 — Context + Infrastructure Mapping

```
📋 어떤 기능을 플러그인으로 만드시겠습니까?

1. Feature description (e.g., "per-patient treatment memo", "auto appointment reminder")
2. Users (patient / admin / API only)
3. Whether existing data integration is needed
4. Universal (store distribution) vs dedicated (local/)
5. Should agent skills be packaged together?
```

The agent must in Phase 1:
1. Scan current SDK APIs with `ls src/lib/plugin-sdk/api/`
2. Check usage with `cat docs/PLUGIN_API_REFERENCE.md`
3. Show the user the mapping between their request and existing APIs

```
📊 Infrastructure Mapping Result:

Feature: Per-patient treatment memo
Available APIs:
  ✅ sdk.patients — Patient lookup/search (already exists, no need to rebuild)
  ✅ sdk.db — custom_ table queries (for memo CRUD)
  ✅ sdk.settings — Plugin settings storage
  ❌ Memo-specific API — not available (implement directly with custom_ table)

Type: admin-page
Permissions: patients:read, db:write
```

### Phase 2 — Design

```
📝 Plugin design draft.

[Plugin name]: {name}
[ID]: {plugin-id}
[Type]: {new-route | admin-page | override | api-only | skill-only}
[Permissions]: {permissions}

--- Pages ---
  {page list}

--- DB ---
  custom_{table} — {description}

--- SDK Integration ---
  {SDK API usage}

--- Skills (optional) ---
  skills/{name}.md — {description}

Any modifications needed?
```

### Phase 3 — Scaffold + Implement

**3.1. Generate skeleton with scaffold command**

```bash
npm run plugin:create -- --id {plugin-id} --type {type} --name "{name}"
```

**3.2. Enhance manifest.json**

Protocol compliance — spec: `src/plugins/PLUGIN_SPEC.md`

```json
{
  "id": "{plugin-id}",
  "name": "{name}",
  "version": "1.0.0",
  "type": "{type}",
  "author": "clinic-local",
  "description": "{description}",
  "permissions": ["{perm1}"],
  "documentation": {
    "summary": "{summary}",
    "features": ["{feature1}"],
    "category": "{category}"
  },
  "routes": [],
  "pages": [],
  "skills": [
    {
      "file": "skills/{name}.md",
      "name": "{skill-name}",
      "description": "{skill-desc}",
      "triggers": ["{trigger1}"]
    }
  ]
}
```

**3.3. Implement pages (using SDK)**

```astro
---
import AdminLayout from "@layouts/AdminLayout.astro";
import { createSDKFromContext } from "@lib/plugin-sdk";
const sdk = createSDKFromContext(Astro, '{plugin-id}');
// Use SDK APIs — instead of direct SQL
const patients = await sdk.patients.search({ limit: 20 });
---
```

**3.4. DB migration** (`custom_` prefix required)

**3.5. Create skill files** (optional)

```bash
mkdir -p src/plugins/local/{plugin-id}/skills
```

Skill files follow the same format as `.claude/commands/*.md`.
Included in the plugin, so they deploy together via core:push.

**3.6. Verify**

```bash
npm run plugin:test -- --id {plugin-id}
```

### Phase 4 — Verify

```
✅ Plugin creation complete

📋 Plugin:
   ID: {id} | Type: {type} | Location: src/plugins/local/{id}/

📁 Files: manifest.json, pages/, migration.sql {, skills/}

🔌 SDK Integration: {API list}

🔗 Access: /admin/hub/{id} | /ext/{id}

Next:
- "Submit to store" → /plugin publish
- "Add skill" → add .md to skills/ directory
```

## Plugin Types

| Type | Public Route | Admin Route | Use Case |
|------|-------------|-------------|----------|
| `new-route` | `/ext/{id}/*` | `/admin/hub/{id}/*` | Patient-facing |
| `admin-page` | — | `/admin/hub/{id}/*` | Admin only |
| `override` | Existing route | — | Core page replacement |
| `api-only` | — | — | API only |
| `skill-only` | — | — | Agent skill distribution only |

## Safety

- All files are stored in `src/plugins/local/` (protected from core:pull)
- DB tables must use `custom_` prefix
- Never modify core plugins
- Spec: `src/plugins/PLUGIN_SPEC.md`
- API reference: `docs/PLUGIN_API_REFERENCE.md`

## Integration

| Skill | Relationship |
|-------|-------------|
| `/plugin` | Management (list, test, publish, delete) |
| `/frontend-code` | UI implementation |
| `/navigate` | Codebase navigation |

## Triggers

- "플러그인 만들기", "기능 추가", "커스텀 기능"
- "스킬을 배포하고 싶어", "다른 병원에서도 쓸 수 있게"

## All user-facing output in Korean.
