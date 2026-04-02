# SPEC-ADMIN-STYLE-001: Acceptance Criteria

## Test Scenarios

### Scenario 1: PageContainer Import and Usage

**Given** an admin page that currently uses inline container classes
**When** the page is refactored
**Then** the page SHALL:
1. Import `PageContainer` from `../../../components/admin/common/PageContainer.astro`
2. Replace the container `<div>` with `<PageContainer>`
3. Replace the closing `</div>` with `</PageContainer>`

### Scenario 2: Responsive Padding Verification

**Given** a refactored admin page using `PageContainer`
**When** the page is rendered at different breakpoints
**Then** the horizontal padding SHALL be:
- Mobile (< 640px): 16px (px-4)
- Small (640px - 1023px): 24px (sm:px-6)
- Large (1024px+): 32px (lg:px-8)

### Scenario 3: Vertical Padding Verification

**Given** a refactored admin page using `PageContainer`
**When** the page is rendered
**Then** the vertical padding SHALL be 32px (py-8) on all screen sizes

### Scenario 4: Horizontal Centering Verification

**Given** a refactored admin page using `PageContainer`
**When** the page is rendered
**Then** the content SHALL be horizontally centered with `mx-auto` class

### Scenario 5: Max-Width Verification

**Given** a refactored admin page using `PageContainer` (default props)
**When** the page is rendered on a large screen
**Then** the content SHALL have maximum width of 80rem (1280px) with `max-w-7xl`

### Scenario 6: P1 Critical - Media Page Padding Fix

**Given** the media page at `src/pages/admin/media/index.astro`
**When** refactored to use `PageContainer`
**Then** the page SHALL have:
- Responsive horizontal padding (16px/24px/32px)
- Vertical padding of 32px
- Content no longer touching viewport edges

### Scenario 7: P1 Critical - Reviews Page Vertical Padding Fix

**Given** the reviews page at `src/pages/admin/reviews/index.astro`
**When** refactored to use `PageContainer`
**Then** the page SHALL have vertical padding of 32px (py-8)
**And** all existing functionality (filters, table, pagination) remains intact

### Scenario 8: Excluded Pages Remain Unchanged

**Given** the excluded pages (tasks, messages)
**When** this SPEC is implemented
**Then** these pages SHALL NOT be modified
**And** they SHALL retain their current custom layouts

### Scenario 9: maxWidth Prop - Narrow Variant

**Given** a page requiring narrower width
**When** using `<PageContainer maxWidth="narrow">`
**Then** the max-width SHALL be `max-w-5xl` (64rem / 1024px)

### Scenario 10: maxWidth Prop - Full Variant

**Given** a page requiring full width
**When** using `<PageContainer maxWidth="full">`
**Then** the max-width SHALL be `max-w-full` (no max-width constraint)

### Scenario 11: Translation Pages Class Order Fix

**Given** a translation page with wrong class order
**When** refactored to use `PageContainer`
**Then** the page SHALL have:
- Correct responsive breakpoints (sm:px-6, lg:px-8)
- Proper class precedence (responsive classes before max-w-7xl)
- Consistent padding with other admin pages

---

## Edge Cases

### Edge Case 1: Page with Existing Custom className

**Given** a page that has a custom className on its container
**When** refactored to use `PageContainer`
**Then** the custom className SHALL be passed via the `class` prop:
```astro
<PageContainer class="custom-class">
```

### Edge Case 2: Nested Container Divs

**Given** a page with nested container divs
**When** refactoring the outer container
**Then** only the outer container SHALL be replaced
**And** inner containers SHALL remain unchanged

### Edge Case 3: Pages with Inline Styles on Container

**Given** a page using inline `style=""` attributes on container
**When** refactoring to `PageContainer`
**Then** the inline styles SHALL be migrated to appropriate solutions:
- Remove if redundant with PageContainer
- Apply to inner wrapper if needed for specific content

---

## Visual Verification Checklist

### Each Refactored Page

- [ ] Page loads without console errors
- [ ] Content is horizontally centered on large screens
- [ ] Horizontal padding correct at 375px width (mobile)
- [ ] Horizontal padding correct at 768px width (tablet)
- [ ] Horizontal padding correct at 1280px width (desktop)
- [ ] Vertical padding of 32px visible above and below content
- [ ] All interactive elements (buttons, forms, links) remain functional
- [ ] No horizontal scrollbar appears
- [ ] Max-width constraint works on ultra-wide screens

### Specific Page Verification

**media/index.astro**:
- [ ] Gallery grid displays correctly with padding
- [ ] Upload section has proper spacing
- [ ] Search/filter section has proper spacing

**reviews/index.astro**:
- [ ] Filter form has proper spacing from edges
- [ ] Table view has proper padding
- [ ] Pagination controls have proper spacing
- [ ] Mobile card view has proper spacing

**translations/index.astro**:
- [ ] Stats cards grid displays correctly
- [ ] Matrix tables have proper padding
- [ ] Quick actions section has proper spacing

---

## Performance Criteria

- [ ] No additional CSS files loaded (uses existing Tailwind utilities)
- [ ] Page render time unchanged (component adds no significant overhead)
- [ ] No layout shift (CLS) introduced
- [ ] Lighthouse scores maintained or improved

---

## Regression Testing

### Functional Testing

For each refactored page:
- [ ] All forms submit correctly
- [ ] All buttons trigger expected actions
- [ ] All links navigate correctly
- [ ] Pagination works correctly
- [ ] Filters/search work correctly
- [ ] Data tables display correctly
- [ ] Mobile card views display correctly

### Cross-Browser Testing

- [ ] Chrome (latest): Visual verification
- [ ] Firefox (latest): Visual verification
- [ ] Safari (latest): Visual verification
- [ ] Edge (latest): Visual verification

---

## Completion Sign-Off

### Developer Sign-Off

- [ ] All 11 target pages refactored
- [ ] `PageContainer` component verified working correctly
- [ ] Visual verification completed for all pages
- [ ] Excluded pages (tasks, messages) confirmed unchanged

### QA Sign-Off

- [ ] Responsive testing completed (mobile/tablet/desktop)
- [ ] Functional testing completed for all pages
- [ ] Cross-browser testing completed
- [ ] No regressions detected

---

## Notes

- Visual parity expected: refactored pages should look identical or better
- The main improvement is consistency and maintainability
- P1 pages (media, reviews) have visible changes (added padding)
- P2 pages are primarily code quality improvements
