# Migration Tracker - SPEC-ADMIN-UI-REFRESH

## Status Legend

| Status | Symbol | Description |
|--------|--------|-------------|
| Legacy | 🔴 | Original styling, not migrated |
| In Progress | 🟡 | Migration started |
| Review | 🔵 | Migration complete, pending review |
| Done | 🟢 | Verified and approved |
| Skip | ⚪ | Not migrating (deprecated/special) |

---

## Summary

| Priority | Total | 🔴 Legacy | 🟡 In Progress | 🔵 Review | 🟢 Done |
|----------|-------|-----------|----------------|-----------|---------|
| P1 | 11 | 11 | 0 | 0 | 0 |
| P2 | 23 | 23 | 0 | 0 | 0 |
| P3 | 42 | 42 | 0 | 0 | 0 |
| P4 | 22 | 21 | 0 | 0 | 0 |
| **Total** | **98** | **97** | **0** | **0** | **0** |

*Note: design-system-test.astro is a new test page, not counted.*

---

## P1 - Critical Pages (11)

| # | Page | Path | Status | Components | Notes |
|---|------|------|--------|------------|-------|
| 1 | Dashboard | `/admin/index` | 🔴 | DSCard, DSBadge, DSStatCard | Main entry |
| 2 | Patients List | `/admin/patients/index` | 🔴 | DSTable, DSInput, DSButton, DSBadge | Core CRM |
| 3 | Patient Detail | `/admin/patients/[id]` | 🔴 | DSCard, DSBadge, DSButton | |
| 4 | Leads List | `/admin/leads/index` | 🔴 | DSCard, DSBadge, DSButton | Sales |
| 5 | Lead Detail | `/admin/leads/[id]` | 🔴 | DSCard, DSInput, DSButton | |
| 6 | Reservations | `/admin/reservations/index` | 🔴 | DSCard, DSButton, DSBadge | Scheduling |
| 7 | Login | `/admin/login` | 🔴 | DSInput, DSButton, DSCard | Auth |
| 8 | CRM Overview | `/admin/crm` | 🔴 | DSCard, DSStatCard | Dashboard |
| 9 | Customers List | `/admin/customers/index` | 🔴 | DSTable, DSBadge | |
| 10 | Messages | `/admin/messages/index` | 🔴 | DSCard, DSBadge | Comms |
| 11 | Staff List | `/admin/staff/index` | 🔴 | DSTable, DSButton | Team |

---

## P2 - High Priority Pages (23)

| # | Page | Path | Status | Components | Notes |
|---|------|------|--------|------------|-------|
| 12 | Doctors List | `/admin/doctors/index` | 🔴 | DSTable, DSButton | |
| 13 | Doctor Detail | `/admin/doctors/[id]` | 🔴 | DSCard, DSInput | |
| 14 | Staff Detail | `/admin/staff/[id]` | 🔴 | DSCard, DSInput | |
| 15 | New Staff | `/admin/staff/new` | 🔴 | DSInput, DSButton | |
| 16 | Posts List | `/admin/posts/index` | 🔴 | DSTable, DSButton | |
| 17 | Post Editor | `/admin/posts/[id]` | 🔴 | DSCard, DSInput | |
| 18 | Pages List | `/admin/pages/index` | 🔴 | DSTable, DSButton | |
| 19 | Page Editor | `/admin/pages/[id]` | 🔴 | DSCard, DSInput | |
| 20 | Topics List | `/admin/topics/index` | 🔴 | DSTable, DSButton | |
| 21 | Topic Detail | `/admin/topics/[id]` | 🔴 | DSCard, DSInput | |
| 22 | Notices List | `/admin/notices/index` | 🔴 | DSTable, DSButton | |
| 23 | Notice Detail | `/admin/notices/[id]` | 🔴 | DSCard, DSInput | |
| 24 | Reviews List | `/admin/reviews/index` | 🔴 | DSTable, DSBadge | |
| 25 | Review Detail | `/admin/reviews/[id]` | 🔴 | DSCard, DSInput | |
| 26 | Payments List | `/admin/payments/index` | 🔴 | DSTable, DSBadge | |
| 27 | Settings Main | `/admin/settings/index` | 🔴 | DSCard, DSButton | |
| 28 | Account Settings | `/admin/settings/account` | 🔴 | DSInput, DSButton | |
| 29 | Intake List | `/admin/intake/index` | 🔴 | DSTable, DSBadge | |
| 30 | Intake Detail | `/admin/intake/[id]` | 🔴 | DSCard, DSInput | |
| 31 | Segments List | `/admin/crm/segments/index` | 🔴 | DSTable, DSBadge | |
| 32 | Segment Detail | `/admin/crm/segment/[id]` | 🔴 | DSCard, DSInput | |
| 33 | Analytics Main | `/admin/analytics/index` | 🔴 | DSCard, DSStatCard | |
| 34 | Change Password | `/admin/change-password` | 🔴 | DSInput, DSButton | |

---

## P3 - Medium Priority Pages (42)

### Marketing (7)

| # | Page | Path | Status | Notes |
|---|------|------|--------|-------|
| 35 | Campaigns List | `/admin/campaigns/index` | 🔴 | |
| 36 | Campaign Templates | `/admin/campaigns/templates` | 🔴 | |
| 37 | Events List | `/admin/events/index` | 🔴 | |
| 38 | Event Detail | `/admin/events/[id]` | 🔴 | |
| 39 | Programs List | `/admin/programs/index` | 🔴 | |
| 40 | Program Detail | `/admin/programs/[id]` | 🔴 | |
| 41 | New Program | `/admin/programs/new` | 🔴 | |

### Surveys (6)

| # | Page | Path | Status | Notes |
|---|------|------|--------|-------|
| 42 | Surveys List | `/admin/surveys/index` | 🔴 | |
| 43 | New Survey | `/admin/surveys/new` | 🔴 | |
| 44 | Import Survey | `/admin/surveys/import` | 🔴 | |
| 45 | Survey Guide | `/admin/surveys/guide` | 🔴 | |
| 46 | Survey Tools | `/admin/surveys/tools/index` | 🔴 | |
| 47 | Tool Results | `/admin/surveys/tools/[toolId]/results` | 🔴 | |

### Knowledge (3)

| # | Page | Path | Status | Notes |
|---|------|------|--------|-------|
| 48 | Knowledge Base | `/admin/knowledge/index` | 🔴 | |
| 49 | KB Categories | `/admin/knowledge/categories` | 🔴 | |
| 50 | My Knowledge | `/admin/knowledge/my` | 🔴 | |

### Manuals (2)

| # | Page | Path | Status | Notes |
|---|------|------|--------|-------|
| 51 | Manuals List | `/admin/manuals/index` | 🔴 | |
| 52 | Manual Detail | `/admin/manuals/[id]` | 🔴 | |

### Finance (4)

| # | Page | Path | Status | Notes |
|---|------|------|--------|-------|
| 53 | Expenses | `/admin/expenses/index` | 🔴 | |
| 54 | Shipping List | `/admin/shipping/index` | 🔴 | |
| 55 | Shipping Detail | `/admin/shipping/[id]` | 🔴 | |
| 56 | Inventory | `/admin/inventory/index` | 🔴 | |

### Settings (15)

| # | Page | Path | Status | Notes |
|---|------|------|--------|-------|
| 57 | AI Settings | `/admin/settings/ai` | 🔴 | |
| 58 | Navigation | `/admin/settings/navigation` | 🔴 | |
| 59 | Products | `/admin/settings/products` | 🔴 | |
| 60 | Promotions | `/admin/settings/promotions` | 🔴 | |
| 61 | SEO | `/admin/settings/seo` | 🔴 | |
| 62 | Tags | `/admin/settings/tags` | 🔴 | |
| 63 | i18n | `/admin/settings/i18n` | 🔴 | |
| 64 | Integrations | `/admin/settings/integrations` | 🔴 | |
| 65 | Security | `/admin/settings/security` | 🔴 | |
| 66 | Schedule | `/admin/settings/schedule` | 🔴 | |
| 67 | Schedule Print | `/admin/settings/schedule-print` | 🔴 | |
| 68 | Languages | `/admin/settings/languages` | 🔴 | |
| 69 | Widget | `/admin/settings/widget` | 🔴 | |
| 70 | Terms List | `/admin/settings/terms/index` | 🔴 | |
| 71 | Terms Detail | `/admin/settings/terms/[id]` | 🔴 | |

### Analytics (3)

| # | Page | Path | Status | Notes |
|---|------|------|--------|-------|
| 72 | Web Analytics | `/admin/analytics/web` | 🔴 | |
| 73 | Detailed Analytics | `/admin/analytics/detailed` | 🔴 | |
| 74 | AEO | `/admin/aeo/index` | 🔴 | |

### Other (2)

| # | Page | Path | Status | Notes |
|---|------|------|--------|-------|
| 75 | Documents | `/admin/documents/index` | 🔴 | |
| 76 | Self Diagnosis | `/admin/self-diagnosis/new` | 🔴 | |

---

## P4 - Low Priority Pages (22)

### Translations (5)

| # | Page | Path | Status | Notes |
|---|------|------|--------|-------|
| 77 | Translations List | `/admin/translations/index` | 🔴 | |
| 78 | Locale Index | `/admin/translations/[locale]/index` | 🔴 | |
| 79 | Translation Editor | `/admin/translations/[locale]/[type]/[id]` | 🔴 | |
| 80 | Editor Legacy | `/admin/translations/editor` | 🔴 | |
| 81 | UI Translations | `/admin/translations/ui` | 🔴 | |

### Plugins (3)

| # | Page | Path | Status | Notes |
|---|------|------|--------|-------|
| 82 | Plugins List | `/admin/plugins/index` | 🔴 | |
| 83 | Installed Plugins | `/admin/plugins/installed` | 🔴 | |
| 84 | Plugin Runner | `/admin/plugins/run/[...path]` | 🔴 | |

### Hub (2)

| # | Page | Path | Status | Notes |
|---|------|------|--------|-------|
| 85 | Hub Index | `/admin/hub/index` | 🔴 | |
| 86 | Hub Path | `/admin/hub/[...path]` | 🔴 | |

### Misc (12)

| # | Page | Path | Status | Notes |
|---|------|------|--------|-------|
| 87 | Media | `/admin/media/index` | 🔴 | |
| 88 | Members | `/admin/members/index` | 🔴 | |
| 89 | Preview Blog | `/admin/preview/blog` | 🔴 | |
| 90 | Preview Section | `/admin/preview-section` | 🔴 | |
| 91 | Debug | `/admin/debug` | ⚪ | Skip - Dev only |
| 92 | Trash | `/admin/trash` | 🔴 | |
| 93 | Design | `/admin/design` | 🔴 | |
| 94 | Data Hub | `/admin/data-hub` | 🔴 | |
| 95 | Tasks | `/admin/tasks/index` | 🔴 | |
| 96 | New Lead | `/admin/leads/new` | 🔴 | |
| 97 | Patient Report | `/admin/patients/[id]/report/[survey_id]` | 🔴 | |
| 98 | Topic FAQ | `/admin/topics/[id]/faqs/[faqId]` | 🔴 | |
| 99 | Marketing History | `/admin/marketing/history` | 🔴 | |

---

## Component Implementation Status

| Component | Status | Blocking Pages |
|-----------|--------|----------------|
| DSButton | ✅ Done | - |
| DSInput | ✅ Done | - |
| DSCard | ✅ Done | - |
| DSBadge | ✅ Done | - |
| DSPageHeader | ✅ Done | - |
| DSStatCard | ✅ Done | - |
| DSTable | ✅ Done | - |
| DSSelect | ✅ Done | - |
| DSModal | ✅ Done | - |
| DSDropdown | ✅ Done | - |
| DSToast | ✅ Done | - |

**All core components implemented. Ready for page migration.**

---

## Migration Log

| Date | Page | From | To | By | Notes |
|------|------|------|----|----|-------|
| 2026-01-30 | (test page) | - | ✅ | - | Created design-system-test.astro |
| 2026-01-30 | (components) | - | ✅ | - | Added DSTable, DSSelect, DSModal, DSDropdown, DSToast |

---

## How to Update This Tracker

1. Before starting a page: Change status to 🟡
2. After migration complete: Change status to 🔵
3. After review/testing: Change status to 🟢
4. Add entry to Migration Log with date and notes

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-30 | Initial tracker created with 98 pages |
