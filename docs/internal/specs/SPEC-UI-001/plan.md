# SPEC-UI-001: Implementation Plan

## Task Decomposition

### Phase 1: CSS Styling Updates
**Estimated Complexity**: Low

1. **Update terminal avatar CSS** (`serveBoardListPage` boardStyles)
   - Ensure `.avatar.terminal` class has consistent styling
   - Dark background (#0D0208), neon green text (#00ff00)
   - Monospace font (Fira Code fallback to SF Mono)
   - Rounded corners (3px), padding (2px 6px)

2. **Standardize category badge colors**
   - Create CSS variables for each category color
   - Ensure consistent badge sizing and padding
   - Add icon color matching

3. **Update level badge styling**
   - Level 1-2: gray background
   - Level 3: purple (#8b5cf6)
   - Level 4: blue (#3b82f6)
   - Level 5: gold (#fbbf24)

4. **Update flair badge styling**
   - Outlined style with accent color border
   - Light background with darker text
   - Consistent sizing with level badges

### Phase 2: HTML Template Updates

1. **Simplify list view post meta**
   - Remove avatar, level badge, flair from list view
   - Display only: category badge > username > timestamp
   - Cleaner, more scannable layout

2. **Enhance detail view author section**
   - Add terminal avatar rendering (dark bg, neon green text)
   - Display level badge with tiered colors
   - Display flair badge with outlined style
   - Order: avatar > username > level > flair > timestamp > views

3. **Update comment author rendering**
   - Add terminal avatar for comment authors
   - Display level badge and flair badge
   - Consistent styling with post author section

4. **Avatar rendering logic** (detail view only)
   - Check if avatar is in AVATAR_CODES preset
   - Apply `.terminal` class for terminal-style avatars
   - Apply `.emoji` class for emoji avatars
   - Default to initial-based avatar for others

### Phase 3: Testing & Verification

1. **Local testing with sample data**
   - Verify all 5 test users display correctly
   - Check all category badges render with correct colors
   - Verify level and flair badges display properly

2. **Browser compatibility testing**
   - Test on Chrome, Firefox, Safari
   - Verify mobile responsiveness

---

## Implementation Details

### File Changes

| File | Changes |
|------|---------|
| `hq/src/index.js` | Update CSS in `boardStyles`, update avatar rendering in post list |

### Key CSS Variables to Add

```css
:root {
  --hq-terminal-bg: #0D0208;
  --hq-terminal-text: #00ff00;
  --hq-terminal-radius: 3px;

  --hq-cat-qna: #3b82f6;
  --hq-cat-free: #00ff00;
  --hq-cat-tips: #f59e0b;
  --hq-cat-newsletter: #06b6d4;
  --hq-cat-success: #fbbf24;
  --hq-cat-notice: #6366f1;

  --hq-level-1: #9ca3af;
  --hq-level-3: #8b5cf6;
  --hq-level-4: #3b82f6;
  --hq-level-5: #fbbf24;
}
```

### Avatar Rendering Logic

```javascript
function renderAvatar(avatar, name) {
  const isTerminal = AVATAR_CODES.includes(avatar) ||
                     (avatar && avatar.length >= 2 && avatar.length <= 6);
  const isEmoji = /\p{Emoji}/u.test(avatar);

  if (isTerminal) {
    return `<span class="avatar terminal">${escapeHtml(avatar)}</span>`;
  } else if (isEmoji) {
    return `<span class="avatar emoji">${avatar}</span>`;
  } else {
    return `<span class="avatar">${(name || 'U')[0].toUpperCase()}</span>`;
  }
}
```

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CSS conflicts with existing styles | Low | Medium | Use specific selectors, test thoroughly |
| Font loading issues | Low | Low | Provide fallback fonts |
| Breaking existing avatar display | Medium | Medium | Backward compatible logic, test with sample data |

---

## Dependencies

- Sample board posts data (created: `seeds/sample_board_posts.sql`)
- Pencil mockup reference (created: `pencil-new.pen`)
- Local dev server running on port 8787
