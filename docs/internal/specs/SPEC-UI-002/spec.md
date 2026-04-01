---
id: SPEC-UI-002
version: 1.0.0
status: draft
created: 2026-02-01
updated: 2026-02-01
author: MoAI
priority: medium
---

# SPEC-UI-002: Community Post Editor UX Redesign

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-01 | MoAI | Initial SPEC creation |

## Overview

커뮤니티 게시글 작성 에디터의 UI/UX를 전면 개선하여 사용자 경험을 향상시킵니다. Pencil 앱에서 목업 디자인을 먼저 작성한 후, 자동저장, 키보드 단축키, 향상된 툴바, 접근성 개선을 구현합니다.

## Goals

- Pencil 앱에서 목업 디자인 생성 (터미널 스타일 유지)
- 자동저장 기능 구현 (localStorage, 10초 간격)
- 키보드 단축키 지원 (Ctrl+B/I/K/S 등)
- 향상된 툴바 (툴팁, 아이콘 개선, 접근성)
- WCAG 2.1 AA 접근성 준수
- 반응형 개선 (모바일 경험 향상)
- 수정 페이지에서 카테고리/태그 편집 가능

## Non-Goals

- WYSIWYG 에디터로 전환 (마크다운 기반 유지)
- 실시간 협업 편집 기능
- AI 글쓰기 보조 기능
- 외부 마크다운 에디터 라이브러리 도입

---

## EARS Requirements

### Ubiquitous Requirements

**REQ-U-001**: The system SHALL automatically save draft content to localStorage every 10 seconds while the user is editing.

**REQ-U-002**: The system SHALL display keyboard shortcut hints in toolbar button tooltips.

**REQ-U-003**: The system SHALL provide ARIA labels for all interactive elements in the editor.

**REQ-U-004**: The system SHALL maintain the terminal-style dark theme (#0D0208 background, #00ff00 neon green accents) consistent with the board design.

### Event-Driven Requirements

**REQ-E-001**: WHEN the user presses Ctrl+B (Cmd+B on Mac), THEN the system SHALL wrap selected text with bold markdown syntax (`**text**`).

**REQ-E-002**: WHEN the user presses Ctrl+I (Cmd+I on Mac), THEN the system SHALL wrap selected text with italic markdown syntax (`*text*`).

**REQ-E-003**: WHEN the user presses Ctrl+K (Cmd+K on Mac), THEN the system SHALL insert link markdown syntax (`[text](url)`) with the selected text as link text.

**REQ-E-004**: WHEN the user presses Ctrl+S (Cmd+S on Mac), THEN the system SHALL manually trigger a draft save and display a confirmation toast.

**REQ-E-005**: WHEN the user loads the write page with an existing draft, THEN the system SHALL display a recovery prompt with draft preview and timestamp.

**REQ-E-006**: WHEN the user submits the post successfully, THEN the system SHALL clear the saved draft from localStorage.

**REQ-E-007**: WHEN a file upload starts, THEN the system SHALL display a progress indicator showing upload percentage.

**REQ-E-008**: WHEN the user hovers over a toolbar button, THEN the system SHALL display a tooltip with the button function and keyboard shortcut.

**REQ-E-009**: WHEN the editor content changes, THEN the system SHALL update the "last saved" timestamp indicator.

**REQ-E-010**: WHEN the user attempts to leave the page with unsaved changes, THEN the system SHALL display a confirmation dialog.

### State-Driven Requirements

**REQ-S-001**: WHILE the editor is in draft recovery mode, the system SHALL display a banner with "Restore Draft" and "Discard" buttons.

**REQ-S-002**: WHILE the viewport width is less than 768px, the system SHALL display the editor in single-column layout with a collapsible preview panel.

**REQ-S-003**: WHILE a file upload is in progress, the system SHALL disable additional file uploads and display a progress bar.

**REQ-S-004**: WHILE the user is on the edit page, the system SHALL display category and tag editing fields.

**REQ-S-005**: WHILE autosave is active, the system SHALL display a subtle indicator showing save status (saving, saved, error).

### Optional Feature Requirements

**REQ-O-001**: WHERE the user enables full-screen mode, the system SHALL hide the header and sidebar for distraction-free editing.

**REQ-O-002**: WHERE the user has a screen reader active, the system SHALL provide enhanced ARIA live regions for editor feedback.

**REQ-O-003**: WHERE the user prefers reduced motion, the system SHALL disable animations for save indicators and transitions.

### Unwanted Behavior Requirements

**REQ-N-001**: The system SHALL NOT lose draft content when the browser crashes or the user accidentally navigates away.

**REQ-N-002**: The system SHALL NOT allow saving drafts that exceed 1MB in localStorage.

**REQ-N-003**: The system SHALL NOT display raw HTML or unsanitized content in the preview pane.

**REQ-N-004**: The system SHALL NOT submit a post while a file upload is in progress.

---

## Technical Constraints

### Dependencies
- Existing HQ backend (Cloudflare Workers)
- Current CSS variable system (--hq-* prefix)
- Marked.js for markdown parsing
- DOMPurify for HTML sanitization
- localStorage API for draft persistence

### Performance Requirements
- Draft save operation SHALL complete in under 50ms
- Editor SHALL remain responsive during autosave
- Preview rendering SHALL update within 100ms of content change
- Page load with draft recovery SHALL complete in under 500ms

### Browser Support
- Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Mobile browsers (iOS Safari, Chrome Mobile)

### Accessibility Requirements
- WCAG 2.1 AA compliance
- Keyboard navigable toolbar
- Screen reader compatible
- Focus visible indicators

---

## References

- Current Write Page: `hq/src/index.js:23957-24156` (serveBoardWritePage)
- Current Edit Page: `hq/src/index.js:24466-24640` (serveBoardEditPage)
- Board Styles: `hq/src/index.js:20801-20953` (boardStyles)
- SPEC-UI-001: Board Page UI Improvement (terminal style reference)
- Pencil mockup: TBD (to be created in Phase 1)
