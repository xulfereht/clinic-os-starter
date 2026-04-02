# /navigate — Codebase Navigator

> **Role**: Guide & Cartographer
> **Cognitive mode**: Exploration. Map the territory, find the path, explain the structure. Answer "where is it?" and "how does it work?" questions by reading actual code and docs.

Helps users understand Clinic-OS structure, find where things are, check if modifications are safe, and discover relevant documentation. Replaces the former central support bot with local codebase intelligence.

## When to Use

- Locating features, files, or configurations in the codebase
- Understanding how a system works end-to-end
- Checking whether a file is safe to modify before editing
- Finding relevant documentation or guides
- Planning the right approach for building a new feature
- Getting an architecture overview of Clinic-OS

## Procedure

### Step 1 — Identify intent

Classify user query into one of:

| Intent | Action |
|--------|--------|
| **Locate** | Find where a feature/file/config lives |
| **Understand** | Trace how a system works end-to-end |
| **Safe-check** | Verify if a path is safe to modify |
| **Find-docs** | Cross-reference guides and workflows |
| **Plan-action** | Route to the right approach for a goal |
| **Overview** | Show architecture map |

### Step 2 — Execute by intent

#### Locate (find files/features)

1. Search codebase using Glob/Grep for the feature
2. Check these key directories in order:

| Directory | Contains |
|-----------|----------|
| `src/pages/` | Page routes (Astro SSR) |
| `src/components/` | Reusable UI components |
| `src/lib/` | Business logic, utilities, DB queries |
| `src/layouts/` | Page layout templates |
| `src/content/aeo/` | AEO structured data |
| `src/plugins/` | Plugin system (survey-tools, custom-homepage) |
| `src/skins/` | Theme/skin packs |
| `scripts/` | Build, deploy, DB automation (166 scripts) |
| `migrations/` | DB schema changes (DDL only) |
| `seeds/` | Initial data (DML only) |
| `.docking/engine/` | core:pull engine (10 modules) |
| `.agent/workflows/` | Agent workflow docs (22 MD) |
| `.agent/manifests/` | Onboarding & skill manifests |
| `hq/src/` | HQ server (Workers) |
| `hq/guides/` | HQ guide source files |
| `docs/` | Internal documentation |

3. Report: file path, line range, brief explanation of what it does

#### Understand (system comprehension)

1. Identify the system boundary (e.g., reservation system, core update, deploy flow)
2. Trace the data flow:
   - Entry point (page/API/script)
   - Core logic (lib/ functions)
   - Data layer (D1 tables, R2 objects)
   - Output (page render, API response, side effect)
3. Read relevant files to confirm
4. Present as a flow diagram or step list

#### Safe-check (modification safety verification)

1. Read `.docking/protection-manifest.yaml` for SOT
2. Check the path against these rules:

```
CORE_PATHS → core overwrites → do not modify directly (except in master repo)
LOCAL_PREFIXES → never touched → safe to modify
PROTECTED_EXACT → exists on both sides, client protected → do not modify
PROTECTED_PREFIXES → prefix-matched protection → do not modify
```

3. Check `.docking/config.yaml` for `protected_pages` and `protected_prefixes`
4. Report:
   - ✅ Safe to modify (with reason)
   - ⚠️ Core path — use `_local/` override instead (with example)
   - ❌ Protected — never modify (with reason)

5. If core path, suggest the safe alternative:
   - Page → `src/pages/_local/{same-path}.astro`
   - Logic → `src/lib/local/{name}.ts`
   - Plugin → `src/plugins/local/{name}/`
   - Style → use skin system or `src/skins/local/`

#### Find-docs (documentation search)

Search these locations in order:

1. **HQ Guides** (user-facing): `hq/guides/*.md` — check `hq_slug`, `hq_title`, `hq_category`
2. **Internal Docs**: `docs/*.md` — operational guides
3. **Agent Workflows**: `.agent/workflows/*.md` — setup, troubleshooting, upgrade
4. **CLAUDE.md** — execution rules, commands, structure
5. **SOUL.md** — purpose, principles, identity
6. **MANIFEST.md** — goals, architecture, skill system

Report: document title, path, brief summary of what it covers.

#### Plan-action (intent-based routing)

| User intent | Route to |
|-------------|----------|
| Add new page | `src/pages/_local/` override or `src/plugins/local/` |
| Add feature | `/plugin` skill → `src/plugins/local/` |
| Change style | `/setup-skin` skill or skin pack |
| Modify homepage | `/setup-homepage` or `_local/index.astro` |
| Add DB table | `custom_` prefix table in plugin migration |
| Write blog | `/write-blog` skill |
| Analyze patient data | `/clinic-advisor` or `/patient-cohort` skill |
| Set up SMS | `/guide/lightsail-proxy-setup` |
| Core update | `/core-update` skill |
| Deploy | `npm run deploy` or `/clinic-release` (master) |
| Troubleshoot | `/troubleshoot` skill |
| System check | `/status` + `/infra-check` skills |

Present the recommended path and any prerequisites.

#### Overview (architecture overview)

Present the Clinic-OS architecture map:

```
┌─────────────────────────────────────────────────────────────┐
│                     Clinic-OS Architecture                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [User Browser] ←→ [Cloudflare Pages (SSR)]                │
│                          │                                  │
│                    ┌─────┴──────┐                           │
│                    │  Astro 5   │                           │
│                    │  React 18  │                           │
│                    │ Tailwind 4 │                           │
│                    └─────┬──────┘                           │
│                          │                                  │
│              ┌───────────┼───────────┐                      │
│              │           │           │                      │
│           [D1 DB]     [R2 Storage] [Workers]               │
│           patients,    images,      API, SSR               │
│           appointments files                                │
│           payments,                                         │
│           content                                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Agent Layer                                                │
│  ├── SOUL.md → identity & principles                       │
│  ├── MANIFEST.md → goals & architecture                    │
│  ├── .agent/ → workflows, manifests, state                 │
│  ├── .claude/commands/ → 53 skills                         │
│  └── .claude/rules/ → safety guardrails                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Core Update Flow                                           │
│  HQ (master) → core:push → mirror repo → core:pull → local │
│  └── new skills, features, fixes auto-deployed              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Safe Zones (never overwritten by core:pull)                │
│  ├── src/pages/_local/     page overrides                  │
│  ├── src/lib/local/        custom logic                    │
│  ├── src/plugins/local/    custom plugins                  │
│  ├── src/skins/local/      custom themes                   │
│  ├── public/local/         custom assets                   │
│  ├── .env                  secrets                         │
│  ├── wrangler.toml         deploy config                   │
│  └── clinic.json           clinic identity                 │
└─────────────────────────────────────────────────────────────┘
```

Also show key file counts and current version from `package.json`.

### Step 3 — Cross-link

After answering, suggest related resources:

- If the user seems stuck → suggest `/troubleshoot`
- If asking about system health → suggest `/status`
- If asking about infrastructure → suggest `/infra-check`
- If asking about setup → suggest `/onboarding`
- If asking about customization → point to relevant guide

## Reference Data

### Key Config Files

| File | Purpose | Modifiable? |
|------|---------|-------------|
| `package.json` | Dependencies, scripts, version | ❌ Core (smart-merge) |
| `astro.config.mjs` | Astro build config | ❌ Core |
| `wrangler.toml` | Cloudflare deploy config | ❌ Protected |
| `clinic.json` | Clinic identity & license | ❌ Protected |
| `.docking/config.yaml` | Core sync config | ❌ Protected |
| `src/config.ts` | Runtime config | ❌ Protected |
| `.env` | Environment variables | ✅ Client-owned |

### Directory Size Reference

| Directory | Approx files | Role |
|-----------|-------------|------|
| `src/` | ~827 | Main application |
| `hq/` | ~200 | HQ server |
| `scripts/` | ~166 | Automation |
| `.agent/` | ~30 | Agent brain |
| `.docking/` | ~15 | Core sync engine |
| `migrations/` | ~45 | DB schema |
| `docs/` | ~40 | Documentation |

## Triggers

- "어디 있어?", "어떻게 작동해?", "구조 설명"
- "이 파일 수정해도 돼?", "가이드 찾아줘"
- "이 기능 만들려면?", "전체 구조"

## Output Format

Keep answers concise and actionable:
1. Direct answer to the question
2. File path(s) with line numbers if relevant
3. One-line explanation of why/how
4. Cross-link to related skill or doc if helpful

Do NOT dump large code blocks unless specifically asked. Navigate, don't excavate.
