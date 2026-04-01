---
id: SPEC-UI-001
version: 1.0.0
status: draft
created: 2026-02-01
updated: 2026-02-01
author: MoAI
priority: medium
---

# SPEC-UI-001: Board Page UI Improvement

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-01 | MoAI | Initial SPEC creation |

## Overview

Enhance the Clinic-OS HQ community board page with improved terminal-style avatars, consistent category labeling, and refined visual hierarchy to create a more cohesive and engaging user experience.

## Goals

- Improve avatar display with terminal-style codes for developer/tech audience
- Establish consistent board category labeling with distinct visual identifiers
- Enhance the overall terminal aesthetic while maintaining readability
- Improve post list visual hierarchy with better badge and flair display

## Non-Goals

- Complete redesign of the board page layout structure
- Changes to the voting/like system functionality
- Backend API modifications (UI-only changes)
- Mobile-first responsive redesign

## Design Decisions (2026-02-01)

### List View Simplification
- **Decision**: Remove avatar, level badge, and flair from post list view
- **Rationale**: Reduces visual clutter, improves scannability
- **Display**: Category badge, username, timestamp only

### Detail View Enhancement
- **Decision**: Show full user info on post detail page
- **Display**: Terminal avatar, username, level badge, flair badge, timestamp, views
- **Comment authors**: Also show terminal avatar, level, and flair badges

---

## EARS Requirements

### Ubiquitous Requirements

**REQ-U-001**: The system SHALL display user avatars using the terminal-style code system (e.g., `>_`, `$_`, `>>>`, `~dev`, `@cli`) with monospace font on dark background with neon green (#00ff00) text color.

**REQ-U-002**: The system SHALL display category badges with the following color scheme:
- Q&A: #3b82f6 (blue)
- Free Board: #00ff00 (neon green)
- Tips: #f59e0b (amber)
- Newsletter: #06b6d4 (cyan)
- Success: #fbbf24 (gold)
- Notice: #6366f1 (indigo)

**REQ-U-003**: The system SHALL maintain consistent spacing and visual hierarchy across all post items in the list view.

### Event-Driven Requirements

**REQ-E-001**: WHEN a user hovers over a post item, THEN the system SHALL apply a subtle background highlight (#F9FAFB) to indicate interactivity.

**REQ-E-002**: WHEN displaying a user with a terminal avatar code, THEN the system SHALL render the code in a pill-shaped container with dark background (#0D0208), rounded corners (3px), and neon green text.

**REQ-E-003**: WHEN displaying a user's level badge, THEN the system SHALL show the level number with appropriate background color based on level tier (1-2: gray, 3: purple, 4: blue, 5: gold).

### State-Driven Requirements

**REQ-S-001**: WHILE on the board list page, the system SHALL display the navigation header with "Board" highlighted in neon green to indicate the active section.

**REQ-S-002**: WHILE displaying post meta information, the system SHALL show elements in the following order: category badge, avatar, username, level badge (if applicable), flair badge (if applicable), timestamp.

### Optional Feature Requirements

**REQ-O-001**: WHERE the user has selected a custom avatar code from AVATAR_CODES presets, the system SHALL display that code instead of the default initial-based avatar.

**REQ-O-002**: WHERE the user has earned a flair badge, the system SHALL display the flair with an outlined style and appropriate accent color.

### Unwanted Behavior Requirements

**REQ-N-001**: The system SHALL NOT display emoji avatars in the same style as terminal avatars - emoji avatars should use transparent backgrounds.

**REQ-N-002**: The system SHALL NOT allow terminal avatar codes longer than 6 characters.

**REQ-N-003**: The system SHALL NOT display raw HTML or unsanitized content in post previews.

---

## Technical Constraints

### Dependencies
- Existing HQ backend (Cloudflare Workers)
- Current CSS variable system (--hq-* prefix)
- Lucide icons for category icons
- Fira Code or SF Mono for monospace fonts

### Performance Requirements
- Post list should render without layout shifts
- Avatar badges should not cause reflow on load
- CSS should be inline or preloaded for above-fold content

### Browser Support
- Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## References

- Pencil mockup: `pencil-new.pen` (Board Page - Terminal Style frame)
- Current implementation: `hq/src/index.js:20946` (serveBoardListPage function)
- Avatar codes: `hq/src/index.js:17423` (AVATAR_CODES constant)
- Category definitions: `hq/src/index.js:17400` (BOARD_CATEGORIES constant)
