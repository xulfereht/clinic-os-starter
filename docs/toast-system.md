# Toast Notification System

Global toast notification system for Clinic OS - SPEC-TOAST-001

## Overview

The Toast system provides a unified, accessible way to display temporary notifications to users. It supports multiple types, auto-dismissal, stacking, and WCAG 2.1 AA compliance.

## Features

- **4 Toast Types**: success, error, warning, info
- **Auto-dismiss**: Configurable duration (default: 4000ms)
- **Manual Dismiss**: Close button and Escape key support
- **Stacking**: Multiple toasts with 8px gap
- **Maximum Limit**: 5 toasts (FIFO removal)
- **Smooth Animations**: Slide-in/fade-out transitions
- **4 Positions**: top-right, top-left, bottom-right, bottom-left
- **Accessibility**: WCAG 2.1 AA compliant
- **Sound Notifications**: Optional audio feedback
- **Dark Mode**: Full theme support
- **Pre-initialization Queue**: No lost notifications during page load

## Installation

The Toast system is automatically included in all layouts:
- `AdminLayout.astro` - Admin pages
- `BaseLayout.astro` - Public pages
- `IntakeLayout.astro` - Intake forms

## API Usage

### Global API

```javascript
// Show a success toast
window.toast.success('Settings saved successfully');

// Show an error toast
window.toast.error('Failed to save changes');

// Show a warning toast
window.toast.warning('Session expiring soon');

// Show an info toast
window.toast.info('New message received');

// Show with options
window.toast.success('Saved!', {
  duration: 5000,        // Custom duration (ms)
  position: 'top-right', // Position: top-left, top-right, bottom-left, bottom-right
  silent: true,          // Skip sound
  description: 'Changes saved successfully',
  link: '/settings',     // Make clickable
  onClick: () => {       // Custom click handler
    console.log('Clicked!');
  }
});

// Dismiss specific toast (by ID)
window.toast.dismiss(id);

// Dismiss all toasts
window.toast.dismissAll();
```

### TypeScript API

```typescript
interface ToastOptions {
  duration?: number;        // Auto-dismiss duration in ms (default: 4000)
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  silent?: boolean;         // Skip notification sound
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
```

## Examples

### Form Submission Feedback

```javascript
async function handleSubmit(formData) {
  try {
    const response = await fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify(formData)
    });

    if (response.ok) {
      window.toast.success('Changes saved successfully!');
    } else {
      window.toast.error('Failed to save changes');
    }
  } catch (error) {
    window.toast.error('Network error occurred');
  }
}
```

### Error with Description

```javascript
window.toast.error('Upload failed', {
  description: 'File size exceeds 10MB limit'
});
```

### Actionable Toast

```javascript
window.toast.info('New comment on your post', {
  link: '/comments/123'
});
```

### Custom Click Handler

```javascript
window.toast.success('Data exported!', {
  onClick: () => {
    downloadFile();
  }
});
```

### Silent Notification

```javascript
window.toast.info('Background sync complete', {
  silent: true
});
```

## Migration from Old Toasts

### From `showToast()`

```javascript
// OLD
showToast('Saved', 'success');

// NEW
window.toast.success('Saved');
```

### From `window.notify()`

```javascript
// OLD
window.notify('Saved', 'success', {
  duration: 3000,
  silent: true
});

// NEW
window.toast.success('Saved', {
  duration: 3000,
  silent: true
});
```

### Type Mapping

| Old Type | New Type |
|----------|----------|
| success  | success  |
| error    | error    |
| warning  | warning  |
| info     | info     |
| danger   | error    |

## Accessibility

- **ARIA**: `role="alert"` and `aria-live="polite"` regions
- **Keyboard**: Escape key dismisses most recent toast
- **Screen Reader**: Full compatibility with NVDA, JAWS, VoiceOver, TalkBack
- **Focus**: Close button is focusable with visible indicators
- **Color Contrast**: WCAG AA compliant (4.5:1 minimum)
- **Reduced Motion**: Respects `prefers-reduced-motion` preference

## Styling

The Toast system uses Tailwind CSS with the design system tokens:

### Light Mode
- Background: `bg-white`
- Text: `text-slate-900`
- Border colors by type (success: green, error: red, warning: amber, info: blue)

### Dark Mode
- Background: `dark:bg-slate-800`
- Text: `dark:text-slate-100`

## Advanced Usage

### Server-Side Trigger (Astro)

```astro
---
// In an Astro component or page
<script>
  // Trigger toast after page load
  window.toast?.success('Welcome back!');
</script>
---
```

### Custom Event Dispatch

```javascript
// Dispatch toast event (works with Astro SSR)
window.dispatchEvent(new CustomEvent('astro:toast', {
  detail: {
    message: 'Hello from server!',
    type: 'success',
    options: { duration: 5000 }
  }
}));
```

## Troubleshooting

### Toast not appearing

1. Check that ToastContainer is included in your layout
2. Verify no JavaScript errors in console
3. Ensure z-index is not blocked by other elements

### Sound not playing

1. Browser autoplay policy may block audio
2. Use `silent: true` option to disable sound
3. Check browser audio permissions

### Toast not dismissing

1. Check duration is positive (0 = no auto-dismiss)
2. Verify no console errors
3. Try manual dismiss with close button or Escape key

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- iOS Safari 14+
- Chrome Mobile 90+

## Related Files

- `src/components/ui/ToastContainer.tsx` - Main React component
- `src/components/ui/ToastContainer.astro` - Astro wrapper
- `src/layouts/AdminLayout.astro` - Admin layout with Toast
- `src/layouts/BaseLayout.astro` - Public layout with Toast
- `src/layouts/IntakeLayout.astro` - Intake layout with Toast

## Version

- Version: 1.0.0
- SPEC: SPEC-TOAST-001
- Last Updated: 2026-02-08
