# SPEC-UI-001: Acceptance Criteria

## Test Scenarios

### Scenario 1: Terminal Avatar Display

**Given** a user with terminal avatar code `>_`
**When** their post is displayed in the board list
**Then** the avatar should render as:
- Dark background (#0D0208)
- Neon green text (#00ff00)
- Monospace font
- Rounded corners (3px)
- Text content: `>_`

### Scenario 2: Category Badge Colors

**Given** posts from different categories exist
**When** the board list page is loaded
**Then** each category badge should display with the correct color:
- Q&A badge: blue (#3b82f6) background, white text
- Free Board badge: green (#00ff00) background, dark text
- Tips badge: amber (#f59e0b) background, white text
- Newsletter badge: cyan (#06b6d4) background, white text

### Scenario 3: List View Post Meta (Simplified)

**Given** a post displayed in the board list
**When** the post is rendered
**Then** meta elements should appear in order:
1. Category badge
2. Username (text only, no avatar)
3. Timestamp

### Scenario 3b: Detail View Author Section (Enhanced)

**Given** a post displayed in the detail view
**When** the post is rendered
**Then** author section should display:
1. Terminal avatar (dark bg, neon green text)
2. Username
3. Level badge (with tier colors)
4. Flair badge (outlined style)
5. Timestamp
6. View count

### Scenario 4: Emoji Avatar Distinction

**Given** a user with emoji avatar (e.g., "🚀")
**When** their post is displayed
**Then** the avatar should render with transparent background, not terminal style

### Scenario 5: Level Badge Styling

**Given** users with different levels
**When** their posts are displayed
**Then** level badges should show correct colors:
- Level 1-2: gray (#9ca3af)
- Level 3: purple (#8b5cf6)
- Level 4: blue (#3b82f6)
- Level 5: gold (#fbbf24)

### Scenario 6: Flair Badge Display

**Given** a user with flair "automation_master"
**When** their post is displayed
**Then** the flair badge should render with:
- Outlined style (1px border)
- Light background
- Accent color text
- Display text: localized flair name

### Scenario 7: Hover State

**Given** the board list page is loaded
**When** user hovers over a post item
**Then** the post item should highlight with subtle background (#F9FAFB)

### Scenario 7b: Comment Author Display

**Given** a post detail page with comments
**When** comments are rendered
**Then** each comment should display:
- Terminal avatar (if user has terminal code)
- Username
- Level badge (with tier colors)
- Flair badge (if user has flair)
- Timestamp

### Scenario 8: Avatar Code Validation

**Given** user attempts to set avatar code longer than 6 characters
**When** the avatar update is processed
**Then** the system should reject the update and keep existing avatar

---

## Edge Cases

### Edge Case 1: Missing Avatar

**Given** a user with no avatar set
**When** their post is displayed
**Then** the system should display first letter of username as avatar

### Edge Case 2: Special Characters in Avatar Code

**Given** a terminal avatar code with special characters (e.g., `>_`, `$_`)
**When** the post is rendered
**Then** special characters should be properly escaped and displayed

### Edge Case 3: Long Username with Badges

**Given** a user with long username (15+ chars) and multiple badges
**When** their post meta is displayed
**Then** the layout should not break or overflow

---

## Performance Criteria

- [ ] Post list renders without visible layout shift
- [ ] Page load time < 2 seconds on 3G connection
- [ ] No JavaScript errors in console
- [ ] Lighthouse accessibility score >= 90

---

## Visual Verification

Reference mockup: `pencil-new.pen` (Board Page - Terminal Style frame)

Manual verification checklist:
- [ ] Terminal avatars match mockup styling
- [ ] Category badges use correct colors
- [ ] Level badges display correctly for all 5 test users
- [ ] Flair badges display with outlined style
- [ ] Post hover state works correctly
- [ ] Mobile layout maintains readability
