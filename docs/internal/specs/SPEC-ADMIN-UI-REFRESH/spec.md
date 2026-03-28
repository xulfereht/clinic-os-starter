# SPEC-ADMIN-UI-REFRESH

## Overview

**Project**: Admin UI Design System Refresh
**Status**: Planning
**Created**: 2026-01-30
**Priority**: Medium

### Objective

Improve the visual consistency and user experience of `/admin/` pages by implementing a unified design system, while preserving all existing functionality.

---

## Requirements (EARS Format)

### Functional Requirements

**FR-001**: When the design system is applied, the system SHALL preserve all existing database queries, API calls, and business logic.

**FR-002**: When users interact with admin pages, the system SHALL maintain identical functionality to the current implementation.

**FR-003**: When components are replaced, the system SHALL ensure backward compatibility with existing data structures.

### Non-Functional Requirements

**NFR-001**: The design system SHALL be implemented using CSS variables that extend the existing theme system.

**NFR-002**: New components SHALL use the `DS*` prefix to avoid conflicts with existing components.

**NFR-003**: The migration SHALL be incremental, allowing page-by-page adoption.

---

## Design System Specification

### Design Tokens (from Pencil)

#### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--ds-primary` | #6366f1 | Primary actions, active states |
| `--ds-primary-strong` | #4f46e5 | Hover states |
| `--ds-primary-soft` | #e0e7ff | Light backgrounds |
| `--ds-bg-page` | #f8fafc | Page background |
| `--ds-bg-surface` | #ffffff | Card backgrounds |
| `--ds-bg-muted` | #f1f5f9 | Muted backgrounds |
| `--ds-text-main` | #0f172a | Primary text |
| `--ds-text-muted` | #64748b | Secondary text |
| `--ds-text-subtle` | #94a3b8 | Tertiary text |
| `--ds-border-subtle` | #e2e8f0 | Borders, dividers |
| `--ds-success` | #22c55e | Success states |
| `--ds-warning` | #f59e0b | Warning states |
| `--ds-danger` | #ef4444 | Error/danger states |

#### Spacing

| Token | Value |
|-------|-------|
| `--ds-space-xs` | 4px |
| `--ds-space-sm` | 8px |
| `--ds-space-md` | 16px |
| `--ds-space-lg` | 24px |
| `--ds-space-xl` | 32px |

#### Border Radius

| Token | Value |
|-------|-------|
| `--ds-radius-sm` | 4px |
| `--ds-radius-md` | 8px |
| `--ds-radius-lg` | 16px |
| `--ds-radius-xl` | 24px |

### Components

#### Implemented (6)

| Component | Pencil ID | Astro File | Status |
|-----------|-----------|------------|--------|
| Button/Primary | `VZEQv` | `DSButton.astro` | ✅ Done |
| Button/Secondary | `VJbeX` | `DSButton.astro` | ✅ Done |
| Button/Ghost | `cvDCB` | `DSButton.astro` | ✅ Done |
| Button/Danger | `LQ479` | `DSButton.astro` | ✅ Done |
| Input/Default | `OUQbl` | `DSInput.astro` | ✅ Done |
| Card/Section | `XRXLD` | `DSCard.astro` | ✅ Done |
| Badge/Success | `pgzla` | `DSBadge.astro` | ✅ Done |
| Badge/Warning | `QDhiH` | `DSBadge.astro` | ✅ Done |
| Badge/Danger | `QfTPK` | `DSBadge.astro` | ✅ Done |
| Badge/Info | `vQEz2` | `DSBadge.astro` | ✅ Done |
| PageHeader | `H82Lk` | `DSPageHeader.astro` | ✅ Done |
| StatCard | - | `DSStatCard.astro` | ✅ Done |

#### Recently Implemented (5)

| Component | Pencil ID | Astro File | Status |
|-----------|-----------|------------|--------|
| Table | `E5ECX` | `DSTable.astro` | ✅ Done |
| Select | `OW8sn`, `f9HD0` | `DSSelect.astro` | ✅ Done |
| Modal | `8vzHb` | `DSModal.astro` | ✅ Done |
| Dropdown | `ON2fP` | `DSDropdown.astro` | ✅ Done |
| Toast (4 variants) | `JHKdS`, `MKkLP`, `gcsDX`, `CUWLK` | `DSToast.astro` | ✅ Done |

---

## Implementation Plan

### Phase 1: Design System Foundation (COMPLETED)

- [x] Create Pencil design file with tokens
- [x] Design core UI components (Button, Input, Card, Badge, Table)
- [x] Create sample page designs (Patients List, Dashboard)

### Phase 2: Astro Component Library

- [ ] Create `src/components/admin/design-system/` directory
- [ ] Implement CSS tokens in `src/styles/admin-tokens.css`
- [ ] Create Astro components matching Pencil designs
- [ ] Add TypeScript interfaces for component props

### Phase 3: Page Migration

Priority order (by usage frequency):

1. **Dashboard** (`/admin/index.astro`)
   - Apply KPI card design
   - Update activity feed styling
   - Preserve all data queries

2. **Patients** (`/admin/patients/index.astro`, `/admin/patients/[id].astro`)
   - Apply table design system
   - Update filter UI
   - Preserve search and pagination logic

3. **Leads** (`/admin/leads/index.astro`, `/admin/leads/[id].astro`)
   - Apply card/list design
   - Update status badges
   - Preserve CRM logic

4. **Settings** (`/admin/settings/*.astro`)
   - Apply form styling
   - Update navigation tabs
   - Preserve settings save logic

5. **Other Pages** (incremental)

### Phase 4: Testing & Validation

- [ ] Visual regression testing
- [ ] Functionality verification
- [ ] Cross-browser testing
- [ ] Mobile responsiveness check

---

## Constraints

### MUST NOT Change

1. Database schema or queries
2. API endpoints or response formats
3. Authentication/authorization logic
4. Business rules and calculations
5. Page routing structure

### MAY Change

1. CSS classes and styles
2. HTML structure within components
3. Component composition
4. Layout arrangements

---

## Acceptance Criteria

- [ ] All existing functionality works identically after migration
- [ ] New design system tokens are documented and accessible
- [ ] Components are reusable across all admin pages
- [ ] No JavaScript console errors introduced
- [ ] Page load performance is not degraded (< 10% increase)
- [ ] Mobile responsive design maintained

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Incremental migration, thorough testing per page |
| Style conflicts | Use `--ds-*` prefix for all new tokens |
| Component incompatibility | Create wrapper components that accept existing props |
| Regression bugs | Keep original components available during transition |

---

## Resources

### Pencil Design File

- Location: `pencil-new.pen` (Pencil editor)
- Contains: Design tokens, components, page mockups

### Reference Pages

- Admin/Dashboard design: Node ID `ThayI`
- Admin/Patients List design: Node ID `SQyP1`
- Design System Components: Node ID `BC03K`

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [priority-matrix.md](./priority-matrix.md) | Page priorities & component dependencies |
| [migration-tracker.md](./migration-tracker.md) | 98 pages migration status |
| [plan.md](./plan.md) | Implementation details |
| [acceptance.md](./acceptance.md) | Testing criteria |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-30 | Initial SPEC created |
| 2026-01-30 | Phase 1 completed (Pencil design system) |
| 2026-01-30 | Added priority-matrix.md and migration-tracker.md |
| 2026-01-30 | Added Select, Modal, Dropdown, Toast to Pencil |
| 2026-01-30 | Implemented DSTable, DSSelect, DSModal, DSDropdown, DSToast |
