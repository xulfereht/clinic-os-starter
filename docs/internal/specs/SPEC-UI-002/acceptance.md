# SPEC-UI-002: Acceptance Criteria

## Test Scenarios

### Scenario 1: Autosave Draft

**Given** a user is writing a new post
**When** the user types content and waits 10 seconds
**Then** the draft should be automatically saved to localStorage
**And** the save status indicator should show "저장됨 (HH:MM)"

### Scenario 2: Draft Recovery on Page Load

**Given** a user has an unsaved draft from a previous session
**When** the user opens the write page
**Then** a recovery banner should appear with:
- Draft preview (first 100 characters)
- Saved timestamp
- "복구" button
- "삭제" button

### Scenario 3: Draft Recovery Action

**Given** the draft recovery banner is displayed
**When** the user clicks "복구"
**Then** the title, content, category, and tags should be restored
**And** the recovery banner should disappear

### Scenario 4: Draft Discard Action

**Given** the draft recovery banner is displayed
**When** the user clicks "삭제"
**Then** the draft should be removed from localStorage
**And** the form should remain empty
**And** the recovery banner should disappear

### Scenario 5: Manual Save with Ctrl+S

**Given** a user is editing content
**When** the user presses Ctrl+S (or Cmd+S on Mac)
**Then** the draft should be immediately saved
**And** a toast notification should appear: "저장되었습니다"

### Scenario 6: Bold Shortcut

**Given** text is selected in the editor
**When** the user presses Ctrl+B (or Cmd+B on Mac)
**Then** the selected text should be wrapped with `**`
**And** the result should be `**selected text**`

### Scenario 7: Italic Shortcut

**Given** text is selected in the editor
**When** the user presses Ctrl+I (or Cmd+I on Mac)
**Then** the selected text should be wrapped with `*`
**And** the result should be `*selected text*`

### Scenario 8: Link Shortcut

**Given** text is selected in the editor
**When** the user presses Ctrl+K (or Cmd+K on Mac)
**Then** a link prompt should appear
**And** after entering URL, the result should be `[selected text](url)`

### Scenario 9: Toolbar Tooltip Display

**Given** the editor toolbar is visible
**When** the user hovers over the Bold button
**Then** a tooltip should appear with:
- "굵게"
- "Ctrl+B" (or "⌘B" on Mac)

### Scenario 10: Page Leave Warning

**Given** the user has unsaved changes
**When** the user tries to navigate away or close the tab
**Then** a browser confirmation dialog should appear
**And** the message should warn about unsaved changes

### Scenario 11: Post Submit Clears Draft

**Given** the user has a draft saved
**When** the user successfully submits the post
**Then** the draft should be cleared from localStorage
**And** the user should be redirected to the post detail page

### Scenario 12: Edit Page Category Change

**Given** a user is on the edit page for their post
**When** the user changes the category from "자유게시판" to "Q&A"
**Then** the category select should update
**And** after submitting, the post should have the new category

### Scenario 13: Edit Page Tag Edit

**Given** a user is on the edit page with existing tags ["react", "frontend"]
**When** the user removes "frontend" and adds "typescript"
**Then** the tags field should show ["react", "typescript"]
**And** after submitting, the post should have the updated tags

### Scenario 14: Mobile Layout

**Given** the viewport width is 375px (mobile)
**When** the user opens the write page
**Then** the editor should display in single-column layout
**And** a "미리보기" toggle button should be visible
**And** toolbar buttons should be touch-friendly (min 44px)

### Scenario 15: Preview Toggle on Mobile

**Given** the user is on mobile in the write page
**When** the user taps the "미리보기" button
**Then** the preview pane should expand/collapse
**And** the button label should toggle between "미리보기" and "에디터"

---

## Accessibility Scenarios

### Scenario A1: Keyboard Toolbar Navigation

**Given** the editor page is loaded
**When** the user tabs to the toolbar
**Then** the first button should receive focus
**And** arrow keys should move between buttons
**And** Enter/Space should activate the focused button

### Scenario A2: Screen Reader Announcement

**Given** a screen reader is active
**When** the autosave completes
**Then** the screen reader should announce "드래프트가 저장되었습니다"

### Scenario A3: Focus Visible Indicators

**Given** a user is navigating with keyboard
**When** any interactive element receives focus
**Then** a visible focus ring should appear
**And** the ring should have sufficient contrast (3:1 minimum)

### Scenario A4: Reduced Motion Preference

**Given** the user has "prefers-reduced-motion" enabled
**When** autosave status changes
**Then** no animation should play
**And** status should change instantly

---

## Edge Cases

### Edge Case 1: localStorage Full

**Given** localStorage is nearly full
**When** a large draft (>1MB) is being saved
**Then** the save should fail gracefully
**And** an error message should appear: "드래프트가 너무 큽니다. 내용을 줄여주세요."

### Edge Case 2: Concurrent Editing Tabs

**Given** the user has the write page open in two tabs
**When** both tabs try to save drafts
**Then** the most recent save should win
**And** no data corruption should occur

### Edge Case 3: Browser Crash Recovery

**Given** the browser crashes while editing
**When** the user reopens the browser and visits the write page
**Then** the last autosaved draft should be available for recovery

### Edge Case 4: Very Long Content

**Given** content exceeds 100,000 characters
**When** autosave triggers
**Then** save should complete within 100ms
**And** preview should remain responsive

### Edge Case 5: File Upload During Autosave

**Given** autosave is in progress
**When** the user initiates a file upload
**Then** both operations should complete independently
**And** no race condition should occur

### Edge Case 6: Admin-Only Category on Edit

**Given** a regular user is editing their post
**When** they try to change category to "공지사항" (admin-only)
**Then** the option should be disabled or hidden
**And** the API should reject the request with 403

---

## Performance Criteria

- [ ] Autosave completes in under 50ms
- [ ] Preview updates within 100ms of content change
- [ ] Page load with draft recovery < 500ms
- [ ] Lighthouse Accessibility score >= 90
- [ ] No JavaScript errors in console
- [ ] No layout shifts during autosave

---

## Visual Verification

Reference mockup: TBD (Pencil design in Phase 1)

Manual verification checklist:
- [ ] Terminal style maintained (dark bg, neon green)
- [ ] Toolbar tooltips display correctly
- [ ] Autosave indicator visible and accurate
- [ ] Draft recovery banner matches design
- [ ] Mobile layout works at 375px width
- [ ] Keyboard shortcuts work on all platforms
- [ ] Focus states visible on all buttons
- [ ] Responsive preview toggle functional
