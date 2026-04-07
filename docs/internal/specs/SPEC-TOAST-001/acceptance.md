# SPEC-TOAST-001: Acceptance Criteria

## Test Scenarios

### Scenario 1: Basic Toast Display (Success Type)

**Given** the toast system is initialized
**When** a user invokes `window.toast.success('Settings saved successfully')`
**Then** the system SHALL:
- Display a toast notification at the bottom-right position (default)
- Show a success icon (checkmark in green)
- Display the message "Settings saved successfully" in slate-900 text color
- Show a green left border indicator
- Display a close button (X icon)
- Animate the toast sliding in from the right

### Scenario 2: Error Toast with Description

**Given** the toast system is initialized
**When** a user invokes `window.toast.error('Failed to save', { description: 'Network connection error' })`
**Then** the system SHALL:
- Display an error toast with red visual styling
- Show the main message "Failed to save" in bold
- Show the description "Network connection error" in smaller muted text below
- Display an error icon (exclamation/circle in red)
- Show a red left border indicator

### Scenario 3: Warning Toast with Custom Duration

**Given** the toast system is initialized
**When** a user invokes `window.toast.warning('Session expiring soon', { duration: 8000 })`
**Then** the system SHALL:
- Display a warning toast with amber/yellow styling
- Keep the toast visible for 8 seconds (8000ms)
- Auto-dismiss after the custom duration expires
- Show a warning icon (triangle exclamation)

### Scenario 4: Info Toast with Action Link

**Given** the toast system is initialized
**When** a user invokes `window.toast.info('New message received', { link: '/messages' })`
**Then** the system SHALL:
- Display an info toast with blue styling
- Make the entire toast clickable (except close button)
- Navigate to `/messages` when user clicks the toast body
- Show a clickable indicator (subtle text or icon)

### Scenario 5: Toast Position Configuration

**Given** the toast system is initialized
**When** a user invokes `window.toast.show('Test', 'info', { position: 'top-left' })`
**Then** the system SHALL:
- Display the toast in the top-left corner of the viewport
- Stack subsequent toasts downward from the top
- Maintain 8px gap between toasts

### Scenario 6: Manual Dismiss via Close Button

**Given** a toast notification is visible
**When** the user clicks the close button (X icon)
**Then** the system SHALL:
- Immediately remove the toast with fade-out animation
- Complete removal within 200ms
- Not play any dismissal sound

### Scenario 7: Keyboard Dismiss via Escape

**Given** one or more toast notifications are visible
**When** the user presses the Escape key
**Then** the system SHALL:
- Dismiss only the most recently displayed toast
- Remove it with fade-out animation
- Keep other toasts visible

### Scenario 8: Multiple Toasts Stacking

**Given** the toast system is initialized
**When** a user invokes multiple toasts in quick succession (e.g., 3 toasts)
**Then** the system SHALL:
- Display all toasts simultaneously
- Stack them vertically with 8px gap
- Show newest toast at the top or bottom (depending on position)
- Allow each toast to be dismissed independently

### Scenario 9: Maximum Toast Limit (FIFO)

**Given** 5 toast notifications are already visible
**When** a user invokes a 6th toast
**Then** the system SHALL:
- Display the new toast
- Automatically remove the oldest toast
- Maintain maximum 5 visible toasts

### Scenario 10: Silent Toast (No Sound)

**Given** the toast system is initialized
**When** a user invokes `window.toast.success('Saved', { silent: true })`
**Then** the system SHALL:
- Display the toast notification normally
- NOT play any notification sound
- Complete auto-dismiss normally

### Scenario 11: Custom onClick Handler

**Given** the toast system is initialized
**When** a user invokes `window.toast.info('Click me', { onClick: () => console.log('clicked') })`
**Then** the system SHALL:
- Display the toast notification
- Execute the onClick handler when user clicks the toast body
- NOT execute handler when user clicks close button

### Scenario 12: dismissAll Method

**Given** multiple toast notifications are visible
**When** a user invokes `window.toast.dismissAll()`
**Then** the system SHALL:
- Remove all visible toast notifications
- Apply fade-out animation to all toasts
- Complete removal within 200ms

### Scenario 13: Dark Mode Support

**Given** the page is in dark mode
**When** a user invokes `window.toast.success('Test')`
**Then** the system SHALL:
- Use dark theme colors for toast background
- Use light text color for message
- Maintain adequate color contrast (4.5:1 minimum)

---

## Accessibility Test Scenarios

### Scenario A1: Screen Reader Announcement

**Given** a screen reader is active (NVDA, JAWS, VoiceOver, TalkBack)
**When** a toast notification appears
**Then** the screen reader SHALL:
- Announce the toast message
- Indicate the notification type (success, error, warning, info)
- Read the message without unnecessary repetition

### Scenario A2: Keyboard Navigation

**Given** a toast notification is visible
**When** a keyboard user presses Tab
**Then** the system SHALL:
- Move focus to the close button
- Show visible focus indicator on close button
- Allow activation with Enter or Space key

### Scenario A3: ARIA Attributes

**Given** a toast notification is rendered
**When** inspected with accessibility tools
**Then** the system SHALL include:
- `role="alert"` on the toast element
- `aria-live="polite"` or `aria-live="assertive"` on container
- `aria-label="Close notification"` on close button
- Proper heading structure if applicable

### Scenario A4: Color Contrast

**Given** a toast notification is displayed
**When** tested with contrast checker
**Then** the system SHALL maintain:
- Minimum 4.5:1 contrast ratio for normal text
- Minimum 3:1 contrast ratio for large text (18pt+)
- Minimum 3:1 contrast ratio for icons and graphics

### Scenario A5: Touch Target Size

**Given** a toast notification on mobile device
**When** measuring touch targets
**Then** the close button SHALL:
- Be at least 44x44 pixels (iOS) or 48x48 pixels (Android)
- Have adequate spacing from other interactive elements

---

## Edge Cases

### Edge Case 1: Empty Message

**Given** the toast system is initialized
**When** a user invokes `window.toast.success('')`
**Then** the system SHALL:
- Not display a toast notification
- Or display a toast with fallback text

### Edge Case 2: Very Long Message

**Given** the toast system is initialized
**When** a user invokes `window.toast.info('A'.repeat(500))`
**Then** the system SHALL:
- Truncate or wrap text appropriately
- Limit toast width to max-width: 400px
- Not break page layout

### Edge Case 3: Rapid Toast Creation

**Given** the toast system is initialized
**When** a user creates 10 toasts within 100ms
**Then** the system SHALL:
- Process all toast creation requests
- Maintain maximum 5 visible toasts
- Not crash or freeze the UI

### Edge Case 4: Zero Duration

**Given** the toast system is initialized
**When** a user invokes `window.toast.info('Test', { duration: 0 })`
**Then** the system SHALL:
- Display the toast without auto-dismiss
- Require manual dismissal via close button

### Edge Case 5: Negative Duration

**Given** the toast system is initialized
**When** a user invokes `window.toast.info('Test', { duration: -1000 })`
**Then** the system SHALL:
- Use the default duration (4000ms)
- Not throw an error

### Edge Case 6: Invalid Toast Type

**Given** the toast system is initialized
**When** a user invokes `window.toast.show('Test', 'invalid')`
**Then** the system SHALL:
- Default to 'info' type
- Not throw an error

### Edge Case 7: Toast Before DOM Ready

**Given** the page is still loading
**When** a script invokes `window.toast.success('Test')`
**Then** the system SHALL:
- Queue the toast request
- Display the toast after DOM is ready
- Not lose the notification

---

## Performance Criteria

- [ ] Toast animations run at 60fps (verified with Chrome DevTools Performance tab)
- [ ] Initial toast render completes within 100ms
- [ ] Memory usage remains below 5MB with 5 simultaneous toasts
- [ ] No layout shift when toasts appear/disappear (CLS = 0)
- [ ] No JavaScript errors in console during normal operation
- [ ] Toast creation does not block main thread for more than 50ms

---

## Browser Compatibility

### Desktop Browsers

- [ ] Chrome 90+ (toasts display correctly, animations smooth)
- [ ] Firefox 88+ (toasts display correctly, animations smooth)
- [ ] Safari 14+ (toasts display correctly, animations smooth)
- [ ] Edge 90+ (toasts display correctly, animations smooth)

### Mobile Browsers

- [ ] iOS Safari 14+ (touch interactions work, toasts positioned correctly)
- [ ] Chrome Mobile 90+ (touch interactions work, toasts positioned correctly)
- [ ] Samsung Internet (touch interactions work, toasts positioned correctly)

---

## Visual Verification Checklist

### Toast Appearance

- [ ] Success toasts show green checkmark icon
- [ ] Error toasts show red error/circle icon
- [ ] Warning toasts show amber triangle/exclamation icon
- [ ] Info toasts show blue info circle icon
- [ ] Left border color matches toast type
- [ ] Background color uses design system tokens
- [ ] Text color uses design system tokens
- [ ] Close button is visible and clickable
- [ ] Toast shadow is appropriate (elevation)

### Animations

- [ ] Slide-in animation is smooth (200ms)
- [ ] Fade-out animation is smooth (200ms)
- [ ] No janky or stuttering animations
- [ ] Animation respects prefers-reduced-motion media query

### Responsive Design

- [ ] Toasts display correctly on mobile (320px width)
- [ ] Toasts display correctly on tablet (768px width)
- [ ] Toasts display correctly on desktop (1920px width)
- [ ] Touch targets are adequate on mobile (44x44px minimum)

---

## Migration Verification

- [ ] All existing `showToast` calls replaced with `window.toast.show`
- [ ] All existing `window.notify` calls replaced with `window.toast.show`
- [ ] Old Toast.tsx component removed or marked deprecated
- [ ] Old ToastContainer.astro component removed or marked deprecated
- [ ] Admin pages show toasts correctly
- [ ] Public pages show toasts correctly
- [ ] No console errors related to toast migration

---

## Definition of Done Checklist

### Implementation

- [ ] ToastContainer.tsx component created
- [ ] ToastContainer.astro wrapper created
- [ ] Global `window.toast` API implemented
- [ ] ToastContainer added to AdminLayout.astro
- [ ] ToastContainer added to BaseLayout.astro (if needed)
- [ ] All 4 toast types implemented
- [ ] Position configuration working
- [ ] Auto-dismiss functionality working
- [ ] Manual dismiss functionality working
- [ ] Maximum toast limit enforced

### Testing

- [ ] Unit tests passing (80%+ coverage)
- [ ] Accessibility tests passing
- [ ] Integration tests passing
- [ ] Cross-browser testing completed
- [ ] Manual testing completed

### Documentation

- [ ] API documentation created
- [ ] Usage examples provided
- [ ] Migration guide completed
- [ ] Component JSDoc comments added

### Migration

- [ ] Existing toast usages audited
- [ ] All old toast calls migrated
- [ ] Deprecated components marked or removed
- [ ] No breaking changes in production
