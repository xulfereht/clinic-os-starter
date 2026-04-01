# SPEC-UI-TERMINAL-001: Acceptance Criteria

---
spec-id: SPEC-UI-TERMINAL-001
version: 1.0.0
created: 2026-01-31
updated: 2026-01-31
---

## Overview

HQ 퍼블릭 페이지 터미널 테마 리디자인 수락 기준

---

## 1. Terminal Theme Acceptance

### AC-TERMINAL-001: Dark Background Application

```gherkin
Feature: Terminal Dark Background

  Scenario: Hero section uses terminal gradient
    Given I am on the landing page
    When the page loads
    Then the hero section background should use "--hq-dark-gradient"
    And the gradient should transition from #0D0208 to #0A1F0A

  Scenario: Login page uses dark terminal background
    Given I am on the login page
    When the page loads
    Then the page background should be "#0D0208" or "--hq-terminal-bg"
    And the contrast with foreground elements should meet WCAG AA
```

### AC-TERMINAL-002: Terminal Green Point Color

```gherkin
Feature: Terminal Green as Point Color

  Scenario: Primary buttons use terminal green fill
    Given I am viewing any page with a primary action button
    When I inspect the button styles
    Then the background should be "#00FF00" or "--hq-terminal"
    And the text color should be "#000000" or "--hq-primary-on"
    And the contrast ratio should be at least 14.5:1

  Scenario: Terminal green is not used as text on light backgrounds
    Given I am viewing any page with a light background section
    When I inspect text elements
    Then no text should use "#00FF00" directly on light backgrounds
    And brand-colored text should use "--hq-primary-text" (#166534) instead
```

### AC-TERMINAL-003: Glow Effect on Interactive Elements

```gherkin
Feature: Terminal Glow Effects

  Scenario: Button hover shows terminal glow
    Given I am viewing a page with a terminal-styled button
    When I hover over the button
    Then a glow effect should appear using "--hq-terminal-glow"
    And the glow should use box-shadow with rgba(0, 255, 0, 0.3)

  Scenario: Input focus shows terminal glow
    Given I am on a page with a terminal-styled input field
    When I focus on the input
    Then the border should change to "--hq-terminal" color
    And a glow effect should appear around the input
```

### AC-TERMINAL-004: Monospace Typography

```gherkin
Feature: Monospace Typography for Technical Content

  Scenario: Code uses monospace font
    Given I am viewing a page with code content
    When I inspect the code element
    Then the font-family should include "JetBrains Mono" or "Fira Code"
    And the fallback should be monospace

  Scenario: Terminal-style elements use monospace
    Given I am viewing terminal-themed UI elements
    When I inspect input fields in dark mode
    Then the font-family should use "--hq-font-mono"
```

---

## 2. Code Block Acceptance

### AC-CODE-001: Terminal-Style Code Blocks

```gherkin
Feature: Terminal Code Block Styling

  Scenario: Code block has terminal appearance
    Given I am on the Guide page
    When I view a code block
    Then the background should be "#0D0208" (--hq-terminal-bg)
    And the border should be "1px solid rgba(0, 255, 0, 0.2)"
    And the border-radius should be 8px
    And a subtle glow effect should be visible

  Scenario: Code text uses terminal green
    Given I am on the Guide page
    When I view code content inside a code block
    Then the default text color should be "#00FF00"
    And the font should be monospace
```

### AC-CODE-002: Syntax Highlighting

```gherkin
Feature: Terminal Syntax Highlighting

  Scenario: JavaScript keywords are highlighted
    Given I am viewing a JavaScript code block
    When I inspect keyword elements (const, let, function, etc.)
    Then keywords should be colored "#00FF00" (Terminal Green)

  Scenario: Strings are highlighted in amber
    Given I am viewing a code block with strings
    When I inspect string literals
    Then strings should be colored "#FFA500" (Amber)

  Scenario: Comments are muted
    Given I am viewing a code block with comments
    When I inspect comment elements
    Then comments should be colored "#6B7280" (Gray)
```

### AC-CODE-003: Code Block Header

```gherkin
Feature: Code Block Header with Language Label

  Scenario: Language label is displayed
    Given I am viewing a code block with a specified language
    When I look at the code block header
    Then a language label should be visible (e.g., "BASH", "JAVASCRIPT")
    And the label should be in terminal green color
    And the label should use uppercase text

  Scenario: Copy button is functional
    Given I am viewing a code block
    When I click the copy button
    Then the code content should be copied to clipboard
    And the button should show a "Copied!" feedback
    And the feedback should use terminal green color
```

### AC-CODE-004: Line Numbers

```gherkin
Feature: Optional Line Numbers

  Scenario: Line numbers are displayed when configured
    Given I am viewing a code block with line numbers enabled
    When I inspect the code block
    Then line numbers should be visible on the left side
    And line numbers should use a muted color (#6B7280)
    And line numbers should not be selectable (user-select: none)
```

---

## 3. Pencil Integration Acceptance

### AC-PENCIL-001: Design-First Verification

```gherkin
Feature: Pencil Design Requirement

  Scenario: Page has corresponding Pencil design
    Given a page is scheduled for redesign
    When the implementation begins
    Then a Pencil design file should exist for the page
    And the design should include desktop layout (1440px)
    And the design should include mobile layout (375px)

  Scenario: Design includes all states
    Given a Pencil design exists for a component
    When I review the design file
    Then default state should be defined
    And hover state should be defined
    And active/focus state should be defined
    And disabled state should be defined (if applicable)
```

### AC-PENCIL-002: Implementation Matches Design

```gherkin
Feature: Design-to-Code Fidelity

  Scenario: Colors match Pencil design
    Given a page has been implemented from Pencil design
    When I compare the implementation to the design
    Then all color values should match the design tokens
    And there should be no arbitrary color values

  Scenario: Spacing matches Pencil design
    Given a page has been implemented from Pencil design
    When I compare padding and margins
    Then spacing should use design token values (--hq-space-*)
    And there should be no arbitrary pixel values for common spacings
```

---

## 4. Page-Specific Acceptance

### AC-PAGE-LANDING: Landing Page

```gherkin
Feature: Landing Page Terminal Theme

  Scenario: Hero section has terminal styling
    Given I am on the landing page
    When the page loads
    Then the hero should have a terminal gradient background
    And the primary CTA should be terminal green with black text
    And there should be a visible glow effect on hover

  Scenario: Feature cards have glass morphism
    Given I am viewing the features section
    When I inspect feature cards
    Then cards should have a glass-morphism effect
    And cards should have a subtle terminal glow on hover

  Scenario: FAQ accordion uses terminal accents
    Given I am viewing the FAQ section
    When I click on an FAQ item to expand it
    Then the active item should show terminal green accent
    And the Q icon should change to terminal green fill
```

### AC-PAGE-LOGIN: Login Page

```gherkin
Feature: Login Page Terminal Theme

  Scenario: Login card has glass morphism
    Given I am on the login page
    When the page loads
    Then the login card should have a glass-morphism effect
    And the background should be semi-transparent
    And there should be a backdrop blur effect

  Scenario: Input fields have terminal styling
    Given I am on the login page
    When I focus on an input field
    Then the border should change to terminal green
    And a glow effect should appear around the input
    And the input background should be slightly transparent

  Scenario: Logo has terminal cursor animation
    Given I am on the login page
    When I view the logo
    Then the cursor (|) should blink in terminal green
    And the blink animation should be smooth
```

### AC-PAGE-DOWNLOAD: Download Page

```gherkin
Feature: Download Page Terminal Theme

  Scenario: Download cards show terminal styling
    Given I am logged in and on the download page
    When I view the download options
    Then cards should have terminal border accents
    And version badges should use terminal colors

  Scenario: Channel selection uses terminal styling
    Given I am viewing channel selection (stable/beta)
    When I hover over a channel option
    Then a terminal glow effect should appear
    And the active channel should be highlighted with terminal green
```

### AC-PAGE-GUIDE: Guide Page

```gherkin
Feature: Guide Page Terminal Theme

  Scenario: Sidebar navigation has terminal accents
    Given I am on the guide page
    When I hover over navigation items
    Then items should show terminal green accent on hover
    And the active item should have a terminal green indicator

  Scenario: Code blocks are fully terminal-styled
    Given I am viewing guide content with code examples
    When I inspect code blocks
    Then all code blocks should follow AC-CODE-* criteria
    And the copy button should be functional
```

---

## 5. WCAG Compliance Acceptance

### AC-WCAG-001: Contrast Ratio

```gherkin
Feature: WCAG AA Contrast Compliance

  Scenario: Text on light backgrounds meets 4.5:1 ratio
    Given I am viewing a page with light background sections
    When I analyze text contrast with axe-core
    Then all regular text should have a contrast ratio of at least 4.5:1
    And large text should have a contrast ratio of at least 3:1

  Scenario: Text on dark backgrounds meets 4.5:1 ratio
    Given I am viewing a page with dark terminal backgrounds
    When I analyze text contrast
    Then terminal green (#00FF00) on #0D0208 should pass (14.5:1)
    And all other text should meet minimum 4.5:1 ratio

  Scenario: Interactive elements are distinguishable
    Given I am viewing interactive elements (buttons, links)
    When I analyze color contrast
    Then focus states should have visible outlines
    And color should not be the only distinguishing factor
```

### AC-WCAG-002: Keyboard Navigation

```gherkin
Feature: Keyboard Accessibility

  Scenario: All interactive elements are keyboard accessible
    Given I am navigating a page using only keyboard
    When I press Tab to move through elements
    Then all buttons, links, and inputs should be reachable
    And focus order should follow visual order
    And focus should be clearly visible with terminal styling

  Scenario: Modal/Dropdown keyboard support
    Given a modal or dropdown is open
    When I press Escape
    Then the modal/dropdown should close
    And focus should return to the trigger element
```

### AC-WCAG-003: Screen Reader Support

```gherkin
Feature: Screen Reader Accessibility

  Scenario: Images have alt text
    Given I am navigating with a screen reader
    When I encounter images
    Then all informative images should have descriptive alt text
    And decorative images should have empty alt or aria-hidden

  Scenario: Buttons and links have accessible names
    Given I am navigating with a screen reader
    When I encounter buttons and links
    Then each should have a clear accessible name
    And icon-only buttons should have aria-label
```

---

## 6. Visual Consistency Validation

### AC-VISUAL-001: Design Token Usage

```gherkin
Feature: Consistent Design Token Usage

  Scenario: No arbitrary colors are used
    Given I am inspecting page styles
    When I search for color values
    Then colors should reference CSS variables (--hq-*)
    And there should be no hardcoded hex colors outside tokens

  Scenario: Spacing uses token values
    Given I am inspecting page styles
    When I search for padding and margin values
    Then common spacings should use --hq-space-* tokens
    And exceptions should be documented
```

### AC-VISUAL-002: Responsive Design

```gherkin
Feature: Responsive Layout

  Scenario: Pages are usable on mobile devices
    Given I am viewing a page on a 375px wide screen
    When I interact with the page
    Then all content should be visible without horizontal scrolling
    And touch targets should be at least 44px
    And text should be readable without zooming

  Scenario: Pages adapt to tablet sizes
    Given I am viewing a page on a 768px wide screen
    When I inspect the layout
    Then the layout should adapt appropriately
    And there should be no awkward empty spaces
```

---

## 7. Performance Acceptance

### AC-PERF-001: Animation Performance

```gherkin
Feature: Smooth Animations

  Scenario: Glow effects don't cause jank
    Given I am viewing a page with glow effects
    When I interact with elements that trigger animations
    Then animations should run at 60fps
    And there should be no visible stuttering

  Scenario: Reduced motion is respected
    Given my system has "Reduce Motion" enabled
    When I view a page with animations
    Then animations should be disabled or reduced
    And the experience should still be functional
```

### AC-PERF-002: Page Load Performance

```gherkin
Feature: Page Load Performance

  Scenario: Lighthouse performance score
    Given I am running Lighthouse on a redesigned page
    When the audit completes
    Then the performance score should be 90 or higher
    And there should be no significant regression from baseline
```

---

## 8. Definition of Done

### Page-Level Checklist

For each redesigned page, the following must be verified:

- [ ] Pencil design exists and was approved
- [ ] Desktop layout implemented (matches Pencil)
- [ ] Mobile layout implemented (matches Pencil)
- [ ] All interactive states work (hover, focus, active)
- [ ] WCAG AA contrast passes (axe-core)
- [ ] Keyboard navigation works
- [ ] Screen reader tested
- [ ] Design tokens used (no arbitrary values)
- [ ] Terminal theme elements present
- [ ] Performance acceptable (Lighthouse 90+)

### Code Block Checklist (Guide Page)

- [ ] Terminal dark background (#0D0208)
- [ ] Terminal green text (#00FF00)
- [ ] Subtle glow effect visible
- [ ] Language label displayed
- [ ] Copy button functional
- [ ] Syntax highlighting applied
- [ ] Line numbers (if enabled)
- [ ] Responsive on mobile

### Overall Project Checklist

- [ ] All 12 pages redesigned
- [ ] Pencil design file complete (pencil-hq-public.pen)
- [ ] hq-tokens.css updated with any new tokens
- [ ] Documentation updated
- [ ] No regression in existing functionality
- [ ] User feedback collected (if applicable)

---

## 9. Test Scenarios Summary

| Category | Scenarios | Priority |
|----------|-----------|----------|
| Terminal Theme | 8 | High |
| Code Blocks | 8 | High |
| Pencil Integration | 4 | High |
| Page-Specific | 12 | Medium |
| WCAG Compliance | 6 | High |
| Visual Consistency | 4 | Medium |
| Performance | 4 | Medium |
| **Total** | **46** | - |

---

## 10. Verification Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| axe-core | WCAG 자동 검증 | CI/CD 통합 |
| Lighthouse | 성능/접근성 점수 | 각 페이지 검증 |
| Chrome DevTools | 스타일 검사 | 수동 검증 |
| VoiceOver/NVDA | 스크린 리더 테스트 | 수동 검증 |
| BrowserStack | 브라우저 호환성 | Cross-browser 테스트 |
| Pencil App | 디자인-구현 비교 | 시각적 검증 |
