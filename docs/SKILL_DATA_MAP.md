# Skill Data Map

> **Purpose**: Canonical map of what each skill reads and writes.
> Local agents MUST NOT access DB tables or pipeline files outside of what's listed here.
> If a skill needs data not in this map, it's a bug — report it, don't improvise.
>
> **SOT**: This document. Updated when skills change.

## Pipeline Artifact Flow

```
/extract-content ──→ .agent/clinic-profile.json
                      │
/analyze-content ──→ .agent/style-card.yaml
                  ──→ .agent/pipeline-context.yaml
                      │
/collect-references → .agent/references.yaml (optional)
                      │
/discover-edge ────→ .agent/edge-profile.yaml
                      │
/plan-content ─────→ .agent/site-plan.yaml
                      │
/write-copy ───────→ (modifies site-plan sections inline)
                      │
/setup-homepage ───→ src/plugins/local/custom-homepage/pages/index.astro
/setup-programs ───→ programs table (sections JSON)
/faq-generate ─────→ pages table (sections JSON)
/setup-og ─────────→ src/pages/_local/ (OG images + meta)
```

## Skill → DB Table Access Matrix

Legend: **R** = reads, **W** = writes (INSERT/UPDATE), **D** = deletes

| Skill | clinics | site_settings | staff | programs | posts | pages | homepage_sections | Other |
|-------|---------|--------------|-------|----------|-------|-------|-------------------|-------|
| setup-clinic-info | R/W | R/W | — | — | — | — | — | clinic_weekly_schedules W |
| setup-programs | — | R | R | **W** | R | — | — | program_translations W |
| setup-homepage | R | R | R | R | — | — | W | — |
| write-blog | — | — | R | — | **W** | — | — | — |
| faq-generate | — | R | — | R | R | **W** | — | — |
| cleanup-samples | — | — | D | D | D | — | — | many tables (is_sample=1) |
| extract-content | — | — | — | — | **W** | — | — | — |
| import-data | — | — | W | W | W | — | — | patients W, payments W |
| setup-intake | — | W | — | — | — | — | — | intake_submissions R |
| setup-skin | — | W | — | — | — | — | — | — |
| setup-i18n | — | W | — | — | — | — | — | supported_locales W, ui_translations W |
| setup-og | — | — | — | — | — | — | — | (file system only) |
| setup-notifications | — | W | — | — | — | — | — | — |
| optimize-aeo | — | — | — | R | R | R | — | aeo_logs W |
| dev-survey | — | — | — | — | — | — | — | self_diagnosis_templates W |
| curate-images | — | — | — | — | — | — | — | (file system only) |
| discover-edge | — | R | R | R | R | — | — | — |
| analyze-content | — | R | R | — | R | — | — | — |
| plan-content | — | — | — | R | R | — | — | — |
| write-copy | — | — | — | — | — | — | — | (pipeline files only) |

## Skill → Pipeline Artifact Access

| Skill | Reads | Writes |
|-------|-------|--------|
| extract-content | (external: Naver blog) | clinic-profile.json |
| analyze-content | clinic-profile.json | style-card.yaml, pipeline-context.yaml |
| collect-references | — | references.yaml |
| discover-edge | clinic-profile.json, style-card.yaml | edge-profile.yaml |
| plan-content | edge-profile.yaml, style-card.yaml, references.yaml, pipeline-context.yaml | site-plan.yaml |
| write-copy | site-plan.yaml, style-card.yaml, edge-profile.yaml | (modifies site-plan.yaml) |
| setup-homepage | site-plan.yaml, references.yaml, pipeline-context.yaml | index.astro (local/) |
| setup-programs | site-plan.yaml, style-card.yaml, references.yaml, pipeline-context.yaml | programs DB |
| live-demo | (orchestrates all above) | — |

## Verified API Endpoints

These endpoints exist in `src/pages/api/admin/`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/clinic-info` | GET/PUT | Clinic basic info (clinics table) |
| `/api/admin/hours` | GET/PUT | Business hours |
| `/api/admin/pages` | GET | Page list |
| `/api/admin/pages/create` | POST | Create page |
| `/api/admin/pages/[id]` | GET/PUT/DELETE | Single page CRUD |
| `/api/admin/pages/[id]/publish` | POST | Publish page |
| `/api/admin/pages/initialize` | POST | Initialize default pages |
| `/api/admin/posts` | GET | Post list |
| `/api/admin/posts/[id]` | GET/PUT/DELETE | Single post CRUD |
| `/api/admin/programs` | GET | Program list |
| `/api/admin/programs/[id]` | GET/PUT/DELETE | Single program CRUD |
| `/api/admin/staff` | GET | Staff list |
| `/api/admin/staff/[id]` | GET/PUT/DELETE | Single staff CRUD |
| `/api/admin/design` | GET/PUT | Design/theme settings |
| `/api/admin/appearance` | GET/PUT | Appearance settings |
| `/api/admin/messages` | GET | Admin messages |
| `/api/admin/plugins/toggle` | POST | Plugin enable/disable |

### Endpoints That DO NOT Exist

> Skills must NOT reference these. Use direct DB queries instead.

- ~~`/api/admin/intake`~~ → use `intake_submissions` table directly
- ~~`/api/admin/knowledge`~~ → use `knowledge_cards` table directly
- ~~`/api/admin/settings`~~ → use `/api/admin/clinic-info` or `site_settings` table
- ~~`/api/admin/reservations`~~ → use `reservations` table directly

## Key DB Schema Quick Reference

### Core Tables (skills interact with most)

```sql
-- clinics: 한의원 기본 정보 (1 row)
clinics(id, name, address, phone, hours, logo_url, favicon_url,
        theme_color, theme_style, theme_config, map_url,
        business_license_number, representative_name, description,
        ai_config, integrations, analytics_config, bank_info)

-- site_settings: 키-값 설정 (카테고리별)
site_settings(id, category, key, value, updated_at)
-- categories: general, contact, hours, theme, seo, social, etc.

-- staff: 의료진
staff(id, name, title, bio, image, specialties, sort_order, is_active,
      education, career, order_index, name_en, name_ja, name_zh, deleted_at)

-- programs: 진료 프로그램
programs(slug, name, description, doctor_id, sections, sort_order,
         is_active, category, hero_image, created_at, updated_at, doctor_ids)
-- sections: JSON array conforming to docs/SECTION_SCHEMAS.md

-- posts: 블로그/칼럼
posts(id, title, slug, content, author_id, type, status, created_at,
      updated_at, doctor_id, featured_image, excerpt, is_pinned,
      view_count, category, is_sample, show_popup)
-- type: 'column' (default) or 'blog'
-- status: 'draft' or 'published'
-- ⚠️ NO locale column — use post_translations for i18n

-- pages: 커스텀 페이지
pages(id, slug, title, description, sections, is_published, created_at, updated_at)
-- sections: JSON array conforming to docs/SECTION_SCHEMAS.md
-- ⚠️ NO type column — identify by slug

-- homepage_sections: 홈페이지 섹션
homepage_sections(id, sections, created_at, updated_at)
```

### Timestamp Convention

- All timestamps are **Unix epoch seconds** (INTEGER), NOT datetime strings
- Use `unixepoch()` for current time in INSERT/UPDATE
- ⚠️ Do NOT use `datetime('now')` — it returns a string, not integer

## Common Mistakes to Avoid

1. **`posts.locale`** — does NOT exist. Use `post_translations` table for i18n.
2. **`pages.type`** — does NOT exist. Identify pages by `slug`.
3. **`datetime('now')`** in timestamps — use `unixepoch()` instead (integer epoch).
4. **Section JSON shape** — MUST conform to `docs/SECTION_SCHEMAS.md`. Use PascalCase type keys.
5. **API endpoints** — only use endpoints listed in "Verified API Endpoints" above.
6. **`staff` vs `doctors`** — `doctors` table is legacy/deprecated. Use `staff` table.
