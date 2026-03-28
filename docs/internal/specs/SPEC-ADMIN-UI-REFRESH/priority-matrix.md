# Priority Matrix - SPEC-ADMIN-UI-REFRESH

## Priority Levels

| Level | Criteria | Target Timeline |
|-------|----------|-----------------|
| **P1** | Core pages, high traffic, daily use | Phase 1 |
| **P2** | Important pages, regular use | Phase 2 |
| **P3** | Secondary pages, moderate use | Phase 3 |
| **P4** | Low priority, rarely used, admin-only | Phase 4 |

---

## Priority Assignment

### P1 - Critical (11 pages)

Core pages used daily. Complete these first for maximum impact.

| Page | Path | Reason | Components Needed |
|------|------|--------|-------------------|
| Dashboard | `/admin/index` | Main landing page | DSCard, DSBadge, DSStatCard |
| Patients List | `/admin/patients/index` | Core CRM function | DSTable, DSInput, DSButton, DSBadge |
| Patient Detail | `/admin/patients/[id]` | Detailed patient view | DSCard, DSBadge, DSButton |
| Leads List | `/admin/leads/index` | Sales pipeline | DSCard, DSBadge, DSButton |
| Lead Detail | `/admin/leads/[id]` | Lead management | DSCard, DSInput, DSButton |
| Reservations | `/admin/reservations/index` | Daily operations | DSCard, DSButton, DSBadge |
| Login | `/admin/login` | Entry point | DSInput, DSButton, DSCard |
| CRM Overview | `/admin/crm` | CRM dashboard | DSCard, DSStatCard |
| Customers List | `/admin/customers/index` | Customer management | DSTable, DSBadge |
| Messages | `/admin/messages/index` | Communication hub | DSCard, DSBadge |
| Staff List | `/admin/staff/index` | Team management | DSTable, DSButton |

### P2 - High (23 pages)

Important management and content pages.

| Page | Path | Reason | Components Needed |
|------|------|--------|-------------------|
| Doctors List | `/admin/doctors/index` | Medical staff | DSTable, DSButton |
| Doctor Detail | `/admin/doctors/[id]` | Doctor profile | DSCard, DSInput |
| Staff Detail | `/admin/staff/[id]` | Staff profile | DSCard, DSInput |
| New Staff | `/admin/staff/new` | Staff creation | DSInput, DSButton |
| Posts List | `/admin/posts/index` | Content management | DSTable, DSButton |
| Post Editor | `/admin/posts/[id]` | Content editing | DSCard, DSInput |
| Pages List | `/admin/pages/index` | Site pages | DSTable, DSButton |
| Page Editor | `/admin/pages/[id]` | Page editing | DSCard, DSInput |
| Topics List | `/admin/topics/index` | Topic management | DSTable, DSButton |
| Topic Detail | `/admin/topics/[id]` | Topic editing | DSCard, DSInput |
| Notices List | `/admin/notices/index` | Announcements | DSTable, DSButton |
| Notice Detail | `/admin/notices/[id]` | Notice editing | DSCard, DSInput |
| Reviews List | `/admin/reviews/index` | Review management | DSTable, DSBadge |
| Review Detail | `/admin/reviews/[id]` | Review response | DSCard, DSInput |
| Payments List | `/admin/payments/index` | Financial tracking | DSTable, DSBadge |
| Settings Main | `/admin/settings/index` | Settings hub | DSCard, DSButton |
| Account Settings | `/admin/settings/account` | User settings | DSInput, DSButton |
| Intake List | `/admin/intake/index` | Patient intake | DSTable, DSBadge |
| Intake Detail | `/admin/intake/[id]` | Intake form | DSCard, DSInput |
| Segments List | `/admin/crm/segments/index` | CRM segments | DSTable, DSBadge |
| Segment Detail | `/admin/crm/segment/[id]` | Segment editing | DSCard, DSInput |
| Analytics Main | `/admin/analytics/index` | Analytics dashboard | DSCard, DSStatCard |
| Change Password | `/admin/change-password` | Security | DSInput, DSButton |

### P3 - Medium (42 pages)

Secondary feature pages.

| Category | Pages | Count |
|----------|-------|-------|
| Marketing | campaigns/index, campaigns/templates, events/index, events/[id], programs/index, programs/[id], programs/new | 7 |
| Surveys | surveys/index, surveys/new, surveys/import, surveys/guide, surveys/tools/index, surveys/tools/[toolId]/results | 6 |
| Knowledge | knowledge/index, knowledge/categories, knowledge/my | 3 |
| Manuals | manuals/index, manuals/[id] | 2 |
| Finance | expenses/index, shipping/index, shipping/[id], inventory/index | 4 |
| Settings | settings/ai, settings/navigation, settings/products, settings/promotions, settings/seo, settings/tags, settings/i18n, settings/integrations, settings/security, settings/schedule, settings/schedule-print, settings/languages, settings/widget, settings/terms/index, settings/terms/[id] | 15 |
| Analytics | analytics/web, analytics/detailed, aeo/index | 3 |
| Other | documents/index, self-diagnosis/new | 2 |

### P4 - Low (22 pages)

Admin tools and rarely used pages.

| Category | Pages | Count |
|----------|-------|-------|
| Translations | translations/index, translations/[locale]/index, translations/[locale]/[type]/[id], translations/editor, translations/ui | 5 |
| Plugins | plugins/index, plugins/installed, plugins/run/[...path] | 3 |
| Hub | hub/index, hub/[...path] | 2 |
| Media | media/index | 1 |
| Members | members/index | 1 |
| Preview | preview/blog, preview-section | 2 |
| Misc | debug, trash, design, data-hub, tasks/index, leads/new | 6 |
| Report | patients/[id]/report/[survey_id], topics/[id]/faqs/[faqId] | 2 |

---

## Component Dependencies

### Required Before P1

All DS components must be implemented before P1 migration:

| Component | Pencil ID | Status | Used In |
|-----------|-----------|--------|---------|
| DSButton | VZEQv, VJbeX, cvDCB, LQ479 | ✅ Created | All pages |
| DSInput | OUQbl | ✅ Created | Forms, Search |
| DSCard | XRXLD | ✅ Created | All pages |
| DSBadge | pgzla, QDhiH, QfTPK, vQEz2 | ✅ Created | Status indicators |
| DSPageHeader | H82Lk | ✅ Created | All pages |
| DSStatCard | - | ✅ Created | Dashboard, Analytics |
| DSTable | E5ECX | ❌ Not Created | List pages |
| DSTableRow | E5ECX | ❌ Not Created | List pages |
| DSSelect | - | ❌ Not Created | Forms, Filters |
| DSModal | - | ❌ Not Created | Dialogs |
| DSDropdown | - | ❌ Not Created | Actions menu |

### Implementation Order

```
1. DSTable, DSTableRow (blocks P1 list pages)
2. DSSelect (blocks form pages)
3. DSModal (blocks detail pages)
4. DSDropdown (blocks action menus)
5. DSToast (blocks feedback)
```

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| P1 pages break | High | Medium | Thorough testing, staged rollout |
| Component missing props | Medium | High | Check existing component usage first |
| Performance regression | Medium | Low | Benchmark before/after |
| Mobile layout breaks | Medium | Medium | Test responsive breakpoints |

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| P1 completion | 100% | migration-tracker.md status |
| Visual consistency | 100% pages using DS tokens | CSS audit |
| Functionality preserved | 0 regressions | acceptance.md checklist |
| Performance | < 10% load time increase | Lighthouse audit |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-30 | Initial priority matrix created |
