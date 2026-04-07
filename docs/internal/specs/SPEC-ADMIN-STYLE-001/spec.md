---
id: SPEC-ADMIN-STYLE-001
version: 1.0.0
status: draft
created: 2026-02-09
updated: 2026-02-09
author: MoAI
priority: medium
---

# SPEC-ADMIN-STYLE-001: Admin Page Layout Standardization

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-09 | MoAI | Initial SPEC creation |

## Overview

Standardize admin page layout styling across Clinic OS admin pages by adopting the existing `PageContainer` component as the single source of truth for consistent margin/padding patterns. This SPEC addresses inconsistent padding usage across admin pages and establishes a unified layout pattern.

## Goals

- Establish consistent margin/padding patterns across all admin pages
- Adopt the existing `PageContainer` component as the standard layout wrapper
- Eliminate inline styles and ad-hoc padding classes
- Improve maintainability through centralized layout component usage
- Ensure responsive behavior consistency (sm/md/lg breakpoints)

## Non-Goals

- Pages `tasks` and `messages` - these have intentional custom layouts and should be excluded
- Modifying the `PageContainer` component structure itself (it already provides correct classes)
- Changing the AdminLayout component
- Affecting non-admin pages
- Modifying page content structure (only the wrapper container)

## Current State Analysis

### Existing PageContainer Component

**Location**: `src/components/admin/common/PageContainer.astro`

**Current Implementation**:
```astro
<div class={`mx-auto px-4 sm:px-6 lg:px-8 py-8 ${widthClass} ${className || ''}`}>
    <slot />
</div>
```

**Key Classes**:
- `mx-auto`: Horizontal centering
- `px-4`: 16px padding on mobile
- `sm:px-6`: 24px padding on small screens (640px+)
- `lg:px-8`: 32px padding on large screens (1024px+)
- `py-8`: 32px vertical padding
- `max-w-7xl`: Maximum width of 80rem (1280px)

### Target Pages (11 Total)

**P1 - Critical Issues**:
1. `src/pages/admin/media/index.astro` - No padding (`<div class="max-w-7xl mx-auto">`)
2. `src/pages/admin/reviews/index.astro` - Missing `py-8` (`<div class="w-full px-4 md:px-6 lg:max-w-7xl lg:mx-auto">`)

**P2 - Refactor for Consistency**:
3. `src/pages/admin/posts/index.astro` - Uses inline styles
4. `src/pages/admin/staff/index.astro` - Uses inline styles
5. `src/pages/admin/customers/index.astro` - Uses inline styles
6. `src/pages/admin/expenses/index.astro` - Uses inline styles
7. `src/pages/admin/shipping/index.astro` - Uses inline styles
8. `src/pages/admin/translations/index.astro` - Wrong class order (`max-w-7xl mx-auto py-8 px-4`)
9. `src/pages/admin/translations/ui.astro` - Wrong class order
10. `src/pages/admin/translations/[locale]/[type]/[id].astro` - Wrong class order
11. `src/pages/admin/translations/[locale]/index.astro` - Wrong class order

**Excluded Pages** (Intentional Layouts):
- `src/pages/admin/tasks/**` - Custom full-width layout for task management
- `src/pages/admin/messages/**` - Custom chat-style layout

---

## EARS Requirements

### Ubiquitous Requirements

**REQ-U-001**: The system SHALL use the `PageContainer` component for all admin page content wrapping.

**REQ-U-002**: The system SHALL apply consistent responsive padding: `px-4 sm:px-6 lg:px-8` across all admin pages.

**REQ-U-003**: The system SHALL apply consistent vertical padding: `py-8` across all admin pages.

**REQ-U-004**: The system SHALL ensure all admin pages use `mx-auto max-w-7xl` for horizontal centering and max-width.

### Event-Driven Requirements

**REQ-E-001**: WHEN an admin page is created or modified, THEN the developer SHALL import and use the `PageContainer` component.

**REQ-E-002**: WHEN replacing inline container divs, THEN the developer SHALL ensure all child elements remain intact and functional.

**REQ-E-003**: WHEN a page requires custom max-width, THEN the developer SHALL use the `maxWidth` prop on `PageContainer` (not inline classes).

### State-Driven Requirements

**REQ-S-001**: WHILE refactoring existing pages, the system SHALL maintain visual parity with the current design.

**REQ-S-002**: WHILE refactoring, the system SHALL preserve all existing functionality including event handlers, data bindings, and dynamic content.

### Optional Feature Requirements

**REQ-O-001**: WHERE a page requires narrower width, THEN the `PageContainer` `maxWidth="narrow"` prop SHALL be used.

**REQ-O-002**: WHERE a page requires full width, THEN the `PageContainer` `maxWidth="full"` prop SHALL be used.

### Unwanted Behavior Requirements

**REQ-N-001**: The system SHALL NOT use inline style classes for page layout containers.

**REQ-N-002**: The system SHALL NOT use ad-hoc padding values that deviate from the standard `px-4 sm:px-6 lg:px-8 py-8` pattern.

**REQ-N-003**: The system SHALL NOT apply this SPEC to `tasks` and `messages` pages (excluded by design).

---

## Technical Constraints

### Dependencies

- Existing `PageContainer` component at `src/components/admin/common/PageContainer.astro`
- Tailwind CSS utility classes
- AdminLayout wrapper component

### Target File List

```
src/pages/admin/media/index.astro
src/pages/admin/reviews/index.astro
src/pages/admin/posts/index.astro
src/pages/admin/staff/index.astro
src/pages/admin/customers/index.astro
src/pages/admin/expenses/index.astro
src/pages/admin/shipping/index.astro
src/pages/admin/translations/index.astro
src/pages/admin/translations/ui.astro
src/pages/admin/translations/[locale]/[type]/[id].astro
src/pages/admin/translations/[locale]/index.astro
```

### Refactoring Pattern

**Before** (various patterns):
```astro
<div class="max-w-7xl mx-auto">
<div class="w-full px-4 md:px-6 lg:max-w-7xl lg:mx-auto">
<div class="w-full px-4 sm:px-6 lg:px-8 py-8 lg:max-w-7xl lg:mx-auto">
<div class="max-w-7xl mx-auto py-8 px-4">
```

**After** (unified pattern):
```astro
---
import PageContainer from "../../../components/admin/common/PageContainer.astro;
---

<PageContainer>
    <!-- Content here -->
</PageContainer>
```

---

## References

- PageContainer component: `src/components/admin/common/PageContainer.astro`
- Excluded pages: `src/pages/admin/tasks/**`, `src/pages/admin/messages/**`
- Related SPEC: None (first layout standardization effort)
