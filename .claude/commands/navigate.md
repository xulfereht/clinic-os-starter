# /navigate — Codebase Navigator

> **Role**: Guide & Cartographer
> **Cognitive mode**: Exploration. Map the territory, find the path, explain the structure. Answer "where is it?" and "how does it work?" questions by reading actual code and docs.

Helps users understand Clinic-OS structure, find where things are, check if modifications are safe, and discover relevant documentation. Replaces the former central support bot with local codebase intelligence.

## When to Use

- "이거 어디 있어?" — locating features, files, configs
- "이거 어떻게 작동해?" — understanding systems end-to-end
- "이 파일 수정해도 돼?" — safety check before modification
- "관련 가이드 있어?" — finding documentation
- "이 기능 만들려면?" — intent-based routing to right approach
- "전체 구조 설명해줘" — architecture overview

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

#### Locate (파일/기능 찾기)

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

#### Understand (시스템 이해)

1. Identify the system boundary (e.g., "예약 시스템", "코어 업데이트", "배포 흐름")
2. Trace the data flow:
   - Entry point (page/API/script)
   - Core logic (lib/ functions)
   - Data layer (D1 tables, R2 objects)
   - Output (page render, API response, side effect)
3. Read relevant files to confirm
4. Present as a flow diagram or step list

#### Safe-check (수정 안전 확인)

1. Read `.docking/protection-manifest.yaml` for SOT
2. Check the path against these rules:

```
CORE_PATHS → 코어가 덮어씀 → 직접 수정 금지 (마스터 레포 제외)
LOCAL_PREFIXES → 절대 건드리지 않음 → 안전하게 수정 가능
PROTECTED_EXACT → 양쪽 존재, 클라이언트 보호 → 수정 금지
PROTECTED_PREFIXES → 접두사 매칭 보호 → 수정 금지
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

#### Find-docs (문서 찾기)

Search these locations in order:

1. **HQ Guides** (user-facing): `hq/guides/*.md` — check `hq_slug`, `hq_title`, `hq_category`
2. **Internal Docs**: `docs/*.md` — operational guides
3. **Agent Workflows**: `.agent/workflows/*.md` — setup, troubleshooting, upgrade
4. **CLAUDE.md** — execution rules, commands, structure
5. **SOUL.md** — purpose, principles, identity
6. **MANIFEST.md** — goals, architecture, skill system

Report: document title, path, brief summary of what it covers.

#### Plan-action (의도 기반 라우팅)

| User intent | Route to |
|-------------|----------|
| 새 페이지 추가 | `src/pages/_local/` override or `src/plugins/local/` |
| 기능 추가 | `/plugin` skill → `src/plugins/local/` |
| 스타일 변경 | `/setup-skin` skill or skin pack |
| 홈페이지 수정 | `/setup-homepage` or `_local/index.astro` |
| DB 테이블 추가 | `custom_` prefix table in plugin migration |
| 블로그 작성 | `/write-blog` skill |
| 환자 데이터 분석 | `/clinic-advisor` or `/patient-cohort` skill |
| 문자 발송 설정 | `/guide/lightsail-proxy-setup` |
| 코어 업데이트 | `/core-update` skill |
| 배포 | `npm run deploy` or `/clinic-release` (master) |
| 문제 해결 | `/troubleshoot` skill |
| 시스템 점검 | `/status` + `/infra-check` skills |

Present the recommended path and any prerequisites.

#### Overview (아키텍처 개요)

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
│           환자,예약    이미지,파일   API,SSR                 │
│           결제,콘텐츠                                       │
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

## Output Format

Keep answers concise and actionable:
1. Direct answer to the question
2. File path(s) with line numbers if relevant
3. One-line explanation of why/how
4. Cross-link to related skill or doc if helpful

Do NOT dump large code blocks unless specifically asked. Navigate, don't excavate.
