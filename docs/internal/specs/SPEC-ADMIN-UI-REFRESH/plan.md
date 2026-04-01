# Implementation Plan - SPEC-ADMIN-UI-REFRESH

## Phase 2: Astro Component Library

### Step 2.1: Create Token CSS File

```bash
# Create file: src/styles/admin-tokens.css
```

Content:
- CSS custom properties for all design tokens
- Extend existing `--theme-*` variables
- Use `--ds-*` namespace to avoid conflicts

### Step 2.2: Create Component Directory

```bash
mkdir -p src/components/admin/design-system
```

### Step 2.3: Implement Core Components

#### DSButton.astro

Props:
- `variant`: "primary" | "secondary" | "ghost" | "danger"
- `size`: "sm" | "md" | "lg"
- `icon`: string (Lucide icon name)
- `disabled`: boolean

#### DSInput.astro

Props:
- `label`: string
- `placeholder`: string
- `icon`: string (optional)
- `error`: string (optional)
- `type`: "text" | "email" | "password" | "number"

#### DSCard.astro

Props:
- `title`: string (optional)
- `noPadding`: boolean
- `class`: string (optional)

Slots:
- `default`: body content
- `actions`: header actions

#### DSBadge.astro

Props:
- `variant`: "success" | "warning" | "danger" | "info"
- `size`: "sm" | "md"

#### DSTableRow.astro

Props:
- `hoverable`: boolean
- `clickable`: boolean

Slots:
- `default`: cell contents

#### DSPageHeader.astro

Props:
- `title`: string
- `description`: string (optional)
- `backUrl`: string (optional)

Slots:
- `actions`: action buttons

---

## Phase 3: Page Migration

### Migration Template

For each page:

1. **Backup**: Create `.bak` copy (optional)
2. **Import**: Add new component imports
3. **Replace**: Swap old components with DS components
4. **Test**: Verify functionality
5. **Cleanup**: Remove unused imports

### Example Migration (Dashboard)

```astro
// Before
<div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
  <h2 class="font-bold text-slate-900">{title}</h2>
  <slot />
</div>

// After
<DSCard title={title}>
  <slot />
</DSCard>
```

### Migration Order

| Priority | Page | Complexity | Dependencies |
|----------|------|------------|--------------|
| 1 | Dashboard | Medium | DSCard, DSBadge |
| 2 | Patients List | High | DSTable, DSInput, DSButton |
| 3 | Patient Detail | High | DSCard, DSBadge, DSButton |
| 4 | Leads List | Medium | DSCard, DSBadge, DSButton |
| 5 | Lead Detail | Medium | DSCard, DSInput |
| 6 | Settings | Low | DSInput, DSButton |
| 7 | Other pages | Varies | As needed |

---

## Rollback Plan

If issues arise:

1. Revert component imports to original
2. Remove DS component files
3. Remove token CSS file
4. All changes are additive, no destructive modifications

---

## Commands

### Start Phase 2

```bash
/moai run SPEC-ADMIN-UI-REFRESH
```

### Test Single Page

```bash
npm run dev
# Navigate to specific admin page
# Verify functionality
```

### Build Check

```bash
npm run build
```
