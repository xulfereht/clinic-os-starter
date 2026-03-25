# Clinic-OS Local Agent — Manifest

> SOUL.md defines who you are. This document defines what you can do.
> This is the skill map, data connector reference, and execution guide for the local agent.

---

## 1. Skill Architecture

Skills are Claude Code harness commands in `.claude/commands/`. They come in two types:

- **Atomic skills** — do one thing, independently executable
- **Orchestrator skills** — call atomic skills in sequence, manage workflow

An orchestrator skill (like `/onboarding`) calls atomic skills (like `/extract-place`, `/init-profile`) as sub-steps. The human can also run any atomic skill directly.

```
/onboarding (orchestrator)
  ├── /extract-place     ← atomic: pull Naver Place data
  ├── /extract-content   ← atomic: crawl existing blog
  ├── /extract-images    ← atomic: collect images + metadata
  ├── /init-profile      ← atomic: assemble clinic profile
  ├── /setup-domain      ← atomic: connect custom domain
  ├── /setup-admin       ← atomic: create admin account
  └── ... (tier 1-5 sub-skills)

/help (orchestrator)
  ├── list available skills
  ├── recommend skill for user's intent
  └── guide through execution
```

## 2. Skill Catalog

### Guide

| Skill | Type | Purpose |
|-------|------|---------|
| `/help` | Orchestrator | Show available skills, recommend based on intent, guide usage |

### Setup & Onboarding

| Skill | Type | Purpose | Status | Bootstrap Phase |
|-------|------|---------|--------|-----------------|
| `/onboarding` | Orchestrator | Guide full clinic setup (53 features, 5 tiers) — calls sub-skills | ✅ Exists | All |
| `/extract-content` | Orchestrator | Naver Place + Blog extraction + import (covers Phase 1a, 1b, 4a-d) | ✅ Exists | 1, 4 |
| `/setup-clinic-info` | Atomic | Basic info: name, phone, address, hours (from dialog or Place data) | ✅ **New** | 5a |
| `/style-card` | Atomic | Analyze collected assets → generate tone & manner yaml | Planned | 2a |
| `/plan-programs` | Atomic | Blog keyword analysis → propose program structure (4-8 programs) | Planned | 2b |
| `/plan-images` | Atomic | Per-program image matrix (Hero/Mechanism/Solution specs) | Planned | 2c |
| `/generate-images` | Atomic | Batch image generation via Nano Banana 2 (generate-image.js) | Planned | 3 |
| `/tag-posts` | Atomic | Assign doctor_id + category to imported blog posts | Planned | 4c |
| `/setup-terms` | Atomic | Auto-generate 4 standard terms with clinic name substitution | Planned | 5b |
| `/setup-programs` | Atomic | Create programs with sections + staff + real photo assets | Planned | 5c |
| `/setup-skin` | Atomic | Select and apply theme/skin + brand color | Planned | 5d |
| `/setup-features` | Atomic | Configure YouTube, intake forms, navigation | Planned | 5e |
| `/setup-homepage` | Orchestrator | Preset selection + photo sourcing + content customization | Planned | 6 |

### System & Maintenance

| Skill | Type | Purpose | Status |
|-------|------|---------|--------|
| `/status` | Atomic | Display system health, version, git state | ✅ Exists |
| `/core-update` | Atomic | Pull latest core + apply migrations | ✅ Exists |
| `/infra-check` | Atomic | Verify D1, R2, Workers infrastructure | ✅ Exists |
| `/migration-test` | Atomic | Dry-run migration simulation | ✅ Exists |
| `/safety-check` | Atomic | Verify file protection rules in sync | ✅ Exists |
| `/audit` | Atomic | Generate system audit report | ✅ Exists |
| `/improvement` | Atomic | Suggest next improvement actions | ✅ Exists |
| `/client-debug` | Atomic | Remote client diagnosis | ✅ Exists |

### Content

| Skill | Type | Purpose | Status |
|-------|------|---------|--------|
| `/blog-write` | Atomic | Generate blog post from clinic data (programs, symptoms, expertise) | Planned |
| `/blog-import` | Atomic | Import existing blog posts from external source | Planned |
| `/faq-generate` | Atomic | Generate FAQs from common patient questions + clinic data | Planned |
| `/review-curate` | Atomic | Curate and format patient reviews for display | Planned |
| `/content-publish` | Orchestrator | Write → review → publish flow (calls /blog-write + API) | Planned |

### Analytics & Reporting

| Skill | Type | Purpose | Status |
|-------|------|---------|--------|
| `/business-report` | Orchestrator | Monthly report: reservations, patients, revenue, trends | Planned |
| `/traffic-analysis` | Atomic | Analyze website traffic, AEO performance, bot visits | Planned |
| `/patient-cohort` | Atomic | Segment patients by visit frequency, diagnosis, age, etc. | Planned |

### CRM & Operations

| Skill | Type | Purpose | Status |
|-------|------|---------|--------|
| `/patient-remind` | Atomic | Extract due patients → draft reminder messages | Planned |
| `/campaign-draft` | Atomic | Draft marketing campaign for patient segment | Planned |
| `/inventory-check` | Atomic | Check product inventory levels, flag low stock | Planned |
| `/schedule-optimize` | Atomic | Analyze reservation patterns, suggest slot adjustments | Planned |

### Extension

| Skill | Type | Purpose | Status |
|-------|------|---------|--------|
| `/plugin` | Atomic | Manage plugins (create, install, check) | ✅ Exists |
| `/survey-tool` | Atomic | Manage survey tools | ✅ Exists |

### Skill Priority

- **P0** (next core:push): `/help`, `/extract-place`, `/init-profile`, `/blog-write`, `/business-report`
- **P1** (within 2 releases): `/extract-images`, `/setup-domain`, `/setup-admin`, `/patient-cohort`, `/patient-remind`
- **P2** (within 1 month): `/faq-generate`, `/campaign-draft`, `/traffic-analysis`, `/content-publish`
- **P3** (backlog): `/inventory-check`, `/schedule-optimize`, `/review-curate`, `/blog-import`

---

## 2. Skill Standard Format

Every skill in `.claude/commands/` follows this structure:

```markdown
# /skill-name — Short Description

Brief explanation of what this skill does and when to use it.

## Data Sources

List the API endpoints this skill reads from:
- `GET /api/endpoint` — what data it provides
- `POST /api/endpoint` — what action it performs

## Procedure

### Step 1: Gather data
(bash commands or API calls)

### Step 2: Process
(analysis, generation, transformation)

### Step 3: Output
(what to present to the user)

### Step 4: Action (if applicable)
(API calls to write data — ALWAYS confirm with user first)

## Output Format

Describe the expected output structure.

## Safety

- Read operations: execute freely
- Write operations: confirm with clinic owner before executing
- Never overwrite existing content without explicit approval
```

---

## 3. Data Connector Map

The local agent accesses clinic data through API endpoints. The dev server must be running (`npm run dev` → localhost:4321) or use the production URL.

### Core Data APIs

| API Group | Endpoint Pattern | Data | Use Case |
|-----------|-----------------|------|----------|
| **Patients** | `/api/patients` | Patient records, history, tags | Cohort analysis, reminders, CRM |
| **Reservations** | `/api/reservations` | Bookings, schedule | Scheduling insights, reminders |
| **Posts** | `/api/posts` | Blog posts, reviews, notices | Content generation, curation |
| **Analytics** | `/api/analytics` | Traffic, page views, behavior | Traffic analysis, reporting |
| **Doctors** | `/api/doctors` | Staff profiles, specialties | Content personalization |
| **Programs** | `/api/programs` | Treatment programs | Content, marketing |
| **Events** | `/api/events` | Clinic events, promotions | Marketing, notifications |
| **FAQ** | `/api/faq.ts` | Frequently asked questions | Content generation |
| **Knowledge** | `/api/knowledge` | Knowledge base articles | Authority content |
| **Leads** | `/api/leads` | Prospect/lead records | CRM, campaigns |
| **Settings** | `/api/settings.ts` | Clinic configuration | Context for all skills |
| **Clinic Info** | `/api/clinic-info.ts` | Basic clinic info (name, hours, address) | Universal context |
| **Services** | `/api/services.ts` | Service catalog | Content, pricing |
| **Contacts** | `/api/contacts` | Contact records | Communication |
| **Intake** | `/api/intake`, `/api/intakes` | Patient intake forms | Patient experience |
| **Self-diagnosis** | `/api/self-diagnosis` | Assessment tools | Patient engagement |
| **Payments** | `/api/payments` | Payment records | Business reporting |
| **Inventory** | `/api/inventory` | Product inventory | Operations |
| **VIP** | `/api/vip-management` | VIP tier management | CRM |
| **Admin** | `/api/admin/*` | Admin operations | System management |
| **Media** | `/api/media`, `/api/files` | Uploaded files, images | Content management |
| **Surveys** | `/api/surveys`, `/api/survey-tools` | Survey data | Patient engagement |
| **Pages** | `/api/pages` | Dynamic page content | Content management |
| **Content** | `/api/content` | Content collections | Multi-format content |
| **Auth** | `/api/auth` | Authentication | Session management |

### API Access Pattern

```bash
# Read data (GET)
curl -s http://localhost:4321/api/patients | head -c 500

# Write data (POST) — ALWAYS confirm with user first
curl -s -X POST http://localhost:4321/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "...", "content": "..."}'
```

Skills should use `fetch()` via bash or direct API calls. No SDK needed.

---

## 4. Skill Management Lifecycle

```
Identify need
  → Community feedback, clinic request, or pattern observation
    → Design skill spec (purpose, data sources, steps, output, safety)
      → Implement in .claude/commands/skill-name.md
        → Test on master repo (dev data)
          → Deploy via core:push (all clients receive)
            → Monitor: does it work? is it used? feedback?
              → Iterate or deprecate
```

### Who Creates Skills

- **Meta agent (master)**: Designs, implements, verifies, deploys
- **Local agent (client)**: Uses skills, reports issues, suggests improvements
- **Community**: Requests features, shares usage patterns

### Skill Versioning

Skills are versioned through core:push tags. No separate skill version number — they evolve with the system version. If a skill needs a breaking change, add a migration note in the skill's markdown.

### Skill Deprecation

Replace the skill content with a notice pointing to the replacement. Don't delete — clients may have documentation referencing the old name.

---

## 5. Onboarding Integration

The onboarding system (`.agent/onboarding-registry.json`, 53 features, 5 tiers) is the initial pathway. Skills extend the agent's value **after** onboarding:

```
Onboarding (Tier 1-5)
  → Clinic is set up and operational
    → Data starts accumulating
      → Skills become useful
        → /blog-generate uses accumulated doctor/program data
        → /business-report uses accumulated reservation/patient data
        → /patient-cohort uses accumulated patient records
```

Skills and onboarding are complementary:
- Onboarding **configures** the system
- Skills **operate** the system

---

## 6. Current State

| Component | Count | Status |
|-----------|-------|--------|
| Available skills | 10 | ✅ Setup/system focused |
| Planned skills | 10 | ❌ Content/analytics/CRM/ops |
| API route groups | 52 | ✅ Full coverage |
| API files | 336 | ✅ Ready as connectors |
| Onboarding features | 53 | ✅ 5 tiers |
| Agent workflows | 22 | ✅ Setup/onboarding/troubleshooting |
