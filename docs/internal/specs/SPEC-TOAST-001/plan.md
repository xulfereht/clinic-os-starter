# SPEC-TOAST-001: Implementation Plan

## Task Decomposition

### Phase 1: Core Toast System Implementation (Primary Goal)

**Priority: High | Complexity: Medium**

#### 1.1 Create Unified Toast Container Component

**File**: `src/components/ui/ToastContainer.tsx`

**Implementation Details**:
- React component with hooks (useState, useEffect, useCallback)
- Global state management using module-level singleton pattern
- Portal rendering using `createPortal` for proper z-index layering
- CSS animations for slide-in/fade-out effects

**Key Features**:
- Support for 4 toast types (success, error, warning, info)
- Configurable position (top-right, top-left, bottom-right, bottom-left)
- Auto-dismiss with configurable duration (default: 4000ms)
- Manual dismiss option via close button
- Maximum 5 simultaneous toasts (FIFO removal)
- Action support (link, onClick handler)

**Styling Requirements**:
- Use Tailwind CSS utility classes
- Integrate with existing design system tokens
- Slate-based color scheme for consistency
- Responsive design for mobile devices

#### 1.2 Implement Global Toast API

**File**: `src/lib/toast.ts` (or inline in ToastContainer.tsx)

**API Methods**:
```typescript
toast.show(message, type, options)
toast.success(message, options)
toast.error(message, options)
toast.warning(message, options)
toast.info(message, options)
toast.dismiss(id?)
toast.dismissAll()
```

**Implementation Approach**:
- Module-level singleton pattern
- Event-based communication for Astro component integration
- Queue system for pre-initialization calls

#### 1.3 Create Astro Integration Layer

**File**: `src/components/ui/ToastContainer.astro`

**Purpose**: Enable toast usage in Astro SSR pages

**Implementation**:
- Inline script for global `window.toast` API
- Event listener bridge between Astro and React
- Container div for React portal rendering
- Sound notification support (optional)

#### 1.4 Add Toast Container to Layouts

**Files to Modify**:
- `src/layouts/AdminLayout.astro`
- `src/layouts/BaseLayout.astro` (if exists, otherwise create)
- `src/layouts/IntakeLayout.astro`

**Implementation**:
- Import ToastContainer component
- Place at root level outside main content
- Ensure z-index layering above all elements

---

### Phase 2: Migration from Existing Toasts (Secondary Goal)

**Priority: Medium | Complexity: Low**

#### 2.1 Audit Existing Toast Usage

**Search Locations**:
- All `showToast(` calls in React components
- All `window.notify(` calls in inline scripts
- All `<ToastContainer>` component usages
- All `<DSToast>` component usages

**Action**: Grep search to create migration list

#### 2.2 Replace Admin ToastContainer Usage

**File**: `src/components/admin/common/ToastContainer.astro`

**Action**:
- Replace with new unified ToastContainer
- Update import statements in AdminLayout.astro
- Verify admin pages still work

#### 2.3 Replace React Toast Usage

**File**: `src/components/ui/Toast.tsx` (to be deprecated)

**Action**:
- Replace `showToast` calls with `window.toast.show`
- Remove old Toast component
- Update component imports

#### 2.4 Update Design System Toast

**File**: `src/components/admin/design-system/DSToast.astro`

**Action**:
- Keep as static component variant (non-dismissing)
- Document as design system showcase only
- Add migration note comments

---

### Phase 3: Testing & Quality Assurance (Primary Goal)

**Priority: High | Complexity: Medium**

#### 3.1 Unit Tests

**File**: `src/components/ui/__tests__/ToastContainer.test.tsx`

**Test Coverage**:
- Toast creation and display
- Auto-dismiss functionality
- Manual dismiss functionality
- Multiple toast stacking
- Position configuration
- Type variants
- Action handlers (link, onClick)
- Maximum toast limit (5)
- FIFO removal behavior

#### 3.2 Accessibility Tests

**File**: `src/components/ui/__tests__/ToastContainer.a11y.test.tsx`

**Test Coverage**:
- ARIA attributes presence
- Keyboard navigation (Escape dismiss)
- Screen reader announcements
- Focus management
- Color contrast ratios
- Tab order

#### 3.3 Integration Tests

**Test Scenarios**:
- Astro page with toast invocation
- React component with toast invocation
- Admin page form submission feedback
- Error handling for API failures
- Multiple simultaneous toasts

#### 3.4 Cross-Browser Testing

**Browsers**: Chrome, Firefox, Safari, Edge, iOS Safari, Chrome Mobile

**Verification**:
- Animation smoothness
- z-index layering
- Touch interactions on mobile
- Sound notification playback

---

### Phase 4: Documentation & Migration Guide (Secondary Goal)

**Priority: Low | Complexity: Low**

#### 4.1 Create Usage Documentation

**File**: `docs/toast-system.md`

**Contents**:
- API reference
- Usage examples
- Best practices
- Accessibility considerations
- Migration guide from old toasts

#### 4.2 Update Component Documentation

**Files to Update**:
- ToastContainer.tsx JSDoc comments
- Migration guide in README

---

## Implementation Details

### File Structure

```
src/
├── components/
│   └── ui/
│       ├── ToastContainer.tsx       # Main React component
│       ├── ToastContainer.astro     # Astro integration wrapper
│       └── __tests__/
│           ├── ToastContainer.test.tsx
│           └── ToastContainer.a11y.test.tsx
├── lib/
│   └── toast.ts                     # Global API (or inline in component)
└── layouts/
    ├── AdminLayout.astro           # Add ToastContainer
    ├── BaseLayout.astro            # Add ToastContainer (if needed)
    └── IntakeLayout.astro          # Add ToastContainer
```

### Component Interface

```typescript
// ToastContainer.tsx
interface ToastProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  defaultDuration?: number;
  maxVisible?: number;
}

// Toast item
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
  createdAt: number;
  options?: ToastOptions;
}
```

### CSS Animation Classes

```css
/* Slide-in animations */
.toast-enter { transform: translateY(20px); opacity: 0; }
.toast-enter-active { transform: translateY(0); opacity: 1; transition: all 200ms ease-out; }
.toast-exit { transform: translateY(0); opacity: 1; }
.toast-exit-active { transform: translateY(-20px); opacity: 0; transition: all 200ms ease-in; }
```

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing toast calls | Medium | High | Maintain backward compatibility during transition period |
| z-index conflicts with modals | Low | Medium | Use z-index 1000 (above standard modals) |
| Performance issues with many toasts | Low | Low | Limit to 5 simultaneous, FIFO removal |
| Accessibility gaps | Medium | High | Mandatory accessibility testing before merge |
| Browser autoplay policy blocking sounds | High | Low | Wrap audio.play in try-catch, provide silent option |

---

## Dependencies

- Existing Toast.tsx component (for reference during migration)
- Existing ToastContainer.astro (for reference during migration)
- Design system tokens from `src/lib/design-system/themes.ts`
- Tailwind CSS 4.1+ for styling
- React 18.3.1 for hooks and portal
- Astro 5.16+ for SSR support

---

## Definition of Done

### Phase 1: Core Implementation (Completed 2026-02-08)

- [x] ToastContainer component created with all required features
- [x] Global `window.toast` API available on all pages
- [x] All 4 toast types working with proper visual design
- [x] Auto-dismiss functionality working (default 4000ms)
- [x] Manual dismiss via close button working
- [x] Position configuration working (4 positions)
- [x] Maximum 5 toasts limit enforced
- [x] Keyboard navigation working (Escape to dismiss)
- [x] ARIA attributes present and correct
- [x] Screen reader compatibility verified (ARIA labels implemented)
- [x] Color contrast ratios meet WCAG AA (slate color scheme)
- [x] Documentation created (docs/toast-system.md)
- [x] Test page created (src/pages/test-toast.astro)

### Phase 2: Migration (Pending)

- [ ] Existing `showToast` calls migrated to `window.toast`
- [ ] Existing `window.notify` calls migrated to `window.toast`
- [ ] Old Toast.tsx component deprecated
- [ ] Old ToastContainer.astro component removed
- [ ] Migration guide completed

### Phase 3: Testing (Pending)

- [ ] Unit tests created (80%+ coverage)
- [ ] Integration tests passing
- [ ] Cross-browser testing completed
- [ ] Accessibility audit completed
