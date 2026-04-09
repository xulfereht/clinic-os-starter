---
id: SPEC-TOAST-001
version: 1.0.0
status: draft
created: 2026-02-08
updated: 2026-02-08
author: MoAI
priority: high
domain: ui
tags: notification,toast,ux,accessibility
---

# SPEC-TOAST-001: Global Toast UI Notification System

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-08 | MoAI | Initial SPEC creation |

## Overview

Implement a unified, global toast notification system to replace inconsistent browser native alerts/confirms with a modern, accessible, and consistent user experience across both admin and public-facing pages.

## Goals

- Replace browser native alerts/confirms with consistent toast notifications
- Provide a single, unified API for toast notifications across the entire application
- Support multiple toast types (success, error, warning, info) with appropriate visual design
- Enable configurable positioning and auto-dismiss behavior
- Ensure accessibility compliance (WCAG 2.1 AA)
- Support both Astro (SSG/SSR) and React client-side components
- Maintain consistency with existing slate-based design system

## Non-Goals

- Complete redesign of existing modal/dialog system
- Backend API modifications
- Mobile-specific notification systems (push notifications, in-app notifications)
- Complex notification queuing and scheduling features

## Existing Implementation Analysis

The current codebase has three fragmented toast implementations:

1. **React Toast** (`src/components/ui/Toast.tsx`):
   - React hooks with global state
   - Auto-dismiss after 3 seconds
   - Emerald/red/amber/slate color scheme
   - Limited to React components only

2. **Admin ToastContainer** (`src/components/admin/common/ToastContainer.astro`):
   - Inline script with `window.notify()` global function
   - No auto-dismiss (manual close only)
   - Sound notification support
   - Link and description options
   - Admin-only usage

3. **Design System Toast** (`src/components/admin/design-system/DSToast.astro`):
   - CSS variable-based theming
   - Server-side component only
   - Dismissible option
   - Design system tokens

### Problems Identified

- Inconsistent APIs (`showToast` vs `window.notify` vs component props)
- Duplicate implementations causing maintenance burden
- No unified positioning strategy
- Inconsistent auto-dismiss behavior
- Accessibility gaps (missing ARIA labels, keyboard navigation)
- Not reusable across admin and public pages

---

## EARS Requirements

### Ubiquitous Requirements

**REQ-U-001**: The system SHALL provide a global toast notification API accessible via `toast.show(message, type, options)` function available on the `window` object.

**REQ-U-002**: The system SHALL display toast notifications with consistent visual design using the slate color scheme from the existing design system (semantic.bgSurface, semantic.textMain, semantic.danger).

**REQ-U-003**: The system SHALL support four toast types: success, error, warning, and info, each with distinct visual indicators (icons, colors, borders).

**REQ-U-004**: The system SHALL ensure all toast notifications meet WCAG 2.1 AA accessibility standards including proper ARIA labels, keyboard navigation support, and screen reader compatibility.

**REQ-U-005**: The system SHALL render toast notifications in a fixed-position container with z-index of 1000 to ensure visibility above all other page elements.

### Event-Driven Requirements

**REQ-E-001**: WHEN a user invokes `toast.show(message, type, options)`, THEN the system SHALL create and display a toast notification with slide-in animation from the configured position.

**REQ-E-002**: WHEN the auto-dismiss duration expires, THEN the system SHALL remove the toast notification with fade-out animation.

**REQ-E-003**: WHEN a user clicks the close button on a toast notification, THEN the system SHALL immediately remove the toast with fade-out animation.

**REQ-E-004**: WHEN a toast notification includes an action link or onClick handler, THEN the system SHALL execute the action when the user clicks the toast body (excluding the close button).

**REQ-E-005**: WHEN a toast notification is displayed, THEN the system SHALL announce the message to screen readers using the `role="alert"` attribute and `aria-live="polite"` region.

**REQ-E-006**: WHEN multiple toasts are displayed simultaneously, THEN the system SHALL stack them vertically with 8px gap between notifications.

**REQ-E-007**: WHEN the toast container position is configured as "top-right", "top-left", "bottom-right", or "bottom-left", THEN the system SHALL position the container accordingly.

**REQ-E-008**: WHEN the user presses the Escape key, THEN the system SHALL dismiss the most recently displayed toast notification.

### State-Driven Requirements

**REQ-S-001**: WHILE the page is in dark mode, THEN the system SHALL use the dark theme colors for toast backgrounds and text.

**REQ-S-002**: WHILE a toast notification is visible, THEN the system SHALL prevent page scroll from affecting the toast position.

**REQ-S-003**: WHILE multiple toast notifications are displayed, THEN the system SHALL limit the maximum visible toasts to 5 and remove older toasts when new ones are added.

**REQ-S-004**: WHILE the toast system is initializing, THEN the system SHALL preserve any pending toast calls in a queue and process them after initialization.

### Optional Feature Requirements

**REQ-O-001**: WHERE the `options.silent` flag is set to true, THEN the system SHALL skip playing the notification sound.

**REQ-O-002**: WHERE the `options.duration` is specified, THEN the system SHALL use the custom duration instead of the default 4000ms.

**REQ-O-003**: WHERE the `options.position` is specified, THEN the system SHALL position the toast container at the specified location (default: bottom-right).

**REQ-O-004**: WHERE the `options.description` parameter is provided, THEN the system SHALL display additional descriptive text below the main message.

**REQ-O-005**: WHERE the `options.link` parameter is provided, THEN the system SHALL make the toast clickable and navigate to the specified URL.

### Unwanted Behavior Requirements

**REQ-N-001**: The system SHALL NOT display more than 5 toast notifications simultaneously.

**REQ-N-002**: The system SHALL NOT block JavaScript execution while waiting for toast dismissal.

**REQ-N-003**: The system SHALL NOT use browser native `alert()` or `confirm()` dialogs for toast notifications.

**REQ-N-004**: The system SHALL NOT play notification sounds when the silent option is enabled or the user has disabled sounds in preferences.

**REQ-N-005**: The system SHALL NOT autofocus toast notifications which could interrupt keyboard navigation.

---

## Technical Constraints

### Dependencies

- Astro 5.16+ (SSG/SSR support)
- React 18.3.1 (for React component integration)
- Tailwind CSS 4.1+ (styling)
- Existing design system tokens (semantic colors from `buildThemeTokens`)

### Performance Requirements

- Toast animations MUST run at 60fps using CSS transforms
- Initial render MUST complete within 100ms
- Memory footprint MUST not exceed 5MB for 5 simultaneous toasts
- No layout shifts when toasts appear/disappear

### Browser Support

- Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Mobile browsers (iOS Safari 14+, Chrome Mobile 90+)
- JavaScript ES2020+ features supported

### Accessibility Requirements

- WCAG 2.1 AA compliance
- ARIA attributes: `role="alert"`, `aria-live="polite"`, `aria-label` for close button
- Keyboard navigation: Escape to dismiss, Tab to focus close button
- Color contrast ratio minimum 4.5:1 for text
- Screen reader compatibility (NVDA, JAWS, VoiceOver, TalkBack)

---

## API Design

### Global Function Signature

```typescript
interface ToastOptions {
  duration?: number;        // Auto-dismiss duration in ms (default: 4000)
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  silent?: boolean;         // Skip notification sound (default: false)
  description?: string;     // Additional descriptive text
  link?: string;           // Optional navigation link
  onClick?: () => void;    // Optional click handler
}

interface ToastAPI {
  show(message: string, type: 'success' | 'error' | 'warning' | 'info', options?: ToastOptions): void;
  success(message: string, options?: ToastOptions): void;
  error(message: string, options?: ToastOptions): void;
  warning(message: string, options?: ToastOptions): void;
  info(message: string, options?: ToastOptions): void;
  dismiss(id?: string): void;
  dismissAll(): void;
}

declare global {
  interface Window {
    toast: ToastAPI;
  }
}
```

---

## Migration Strategy

### Phase 1: Core Implementation (Primary Goal)

1. Create unified toast component at `src/components/ui/ToastContainer.tsx`
2. Implement global API with `window.toast` object
3. Add to `BaseLayout.astro` for public pages
4. Add to `AdminLayout.astro` for admin pages

### Phase 2: Migration (Secondary Goal)

1. Replace `window.notify` calls with `window.toast.show`
2. Replace `showToast` React calls with `window.toast.show`
3. Remove deprecated toast components
4. Update documentation

### Phase 3: Enhancement (Optional Goal)

1. Add sound notification preferences
2. Add toast history/replay feature
3. Add custom toast themes support

---

## References

- Existing Toast.tsx: `src/components/ui/Toast.tsx`
- Existing ToastContainer.astro: `src/components/admin/common/ToastContainer.astro`
- Existing DSToast.astro: `src/components/admin/design-system/DSToast.astro`
- Admin Layout: `src/layouts/AdminLayout.astro`
- Base Layout: `src/layouts/BaseLayout.astro`
- Design System: `src/lib/design-system/themes.ts`
- Admin CSS: `src/styles/admin.css`
