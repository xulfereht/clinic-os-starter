# Implementation Plan: SPEC-HQ-COLOR-001

## Overview

clinic_OS Terminal Palette 디자인 원칙을 HQ 퍼블릭 페이지에 체계적으로 적용하는 구현 계획입니다.

---

## Phase 1: Token System Consolidation

### Task 1.1: Update hq-tokens.css
**Files:** `hq/src/styles/hq-tokens.css`

Actions:
1. `--hq-primary-light` 토큰 용도 확인 및 필요시 재정의
2. 새 토큰 추가 검토:
   - `--hq-primary-surface-light: #DCFCE7` (밝은 배경용 연한 녹색)
3. 토큰 문서화 주석 보강

### Task 1.2: Sync baseStyles in index.js
**Files:** `hq/src/index.js` (baseStyles section)

Actions:
1. `:root` 변수와 hq-tokens.css 동기화
2. 공통 컴포넌트 클래스 정의 확인

---

## Phase 2: Common Components

### Task 2.1: Button Classes
**Location:** `baseStyles` in index.js

Patterns to fix:
- `.btn-primary` → ensure `color: var(--hq-primary-on)`
- `.hq-btn-primary` → verify compliance
- Any `background: #00ff00; color: white;` → `color: var(--hq-primary-on)`

### Task 2.2: Badge Classes
**Location:** `baseStyles` and page-specific styles

Patterns to fix:
- `.dl-card-badge.stable` → `background: var(--hq-primary); color: var(--hq-primary-on)`
- `.current-badge.stable` → same pattern
- `.badge-verified`, `.badge-public` → review

### Task 2.3: Footer & Navigation Links
**Location:** Common styles

Patterns to fix:
- `.footer-text a`, `.footer-links a:hover` → `color: var(--hq-primary-text)`
- `.auth-footer a:hover` → same

---

## Phase 3: Landing Page (`/`)

**File Location:** Landing page HTML in index.js

### Task 3.1: Hero Section
- Highlight text `color:var(--hq-primary)` → `color: var(--hq-primary-text)`
- Check icons color (check marks)

### Task 3.2: Feature Badges
- Line ~14629: Badge with `color:var(--hq-primary)` → fix

### Task 3.3: CTA Buttons
- Verify all primary buttons have black text

### Task 3.4: Testimonials/Examples
- Lines ~14808, 14813, 14818: Example text colors → `var(--hq-primary-text)`

---

## Phase 4: Download Page (`/download`)

**File Location:** Download page section in index.js

### Task 4.1: Channel Badges
- `.dl-card-badge.stable` - Already fixed to use neon fill + black text
- `.channel-badge.stable` - Verify

### Task 4.2: Code Highlights
- Lines ~11611, 11713: `color:var(--hq-primary)` in code → Keep if intentional terminal style, else fix

### Task 4.3: Guide Links
- `.guide-link` → `color: var(--hq-primary-text)`

---

## Phase 5: Board Pages (`/board/*`)

**File Location:** Board page sections in index.js

### Task 5.1: Stat Numbers
- `.stat-card .stat-value` → `color: var(--hq-primary-text)`

### Task 5.2: Links and Titles
- `.post-title:hover` → `color: var(--hq-primary-text)`
- Various link hover states

### Task 5.3: User Avatars
- Line ~21322: Avatar initial `color:#00ff00` - If on light bg, fix

### Task 5.4: Comment Count
- Line ~21348: `color:#00ff00` → `color: var(--hq-primary-text)`

---

## Phase 6: Feedback Hub (`/feedback/*`)

**File Location:** Feedback page sections in index.js

### Task 6.1: Stat Cards
- `.stat-card:nth-child(3) .stat-value` → `color: var(--hq-primary-text)`

### Task 6.2: Links and Hover States
- `.feedback-title:hover`, `.github-link:hover` → fix

### Task 6.3: Filter Tabs
- `.filter-tab:hover`, `.filter-tab.active` - Review contrast

---

## Phase 7: Plugin Pages (`/plugin/*`)

**File Location:** Plugin page sections in index.js

### Task 7.1: Badges
- `.badge-verified`, `.badge-public` → `color: var(--hq-primary-text)` or proper badge styling

### Task 7.2: Statistics
- `.stat-number` → `color: var(--hq-primary-text)`

### Task 7.3: Category Chips
- `.category-chip:hover`, `.category-chip.active` - Review

### Task 7.4: Links
- `.view-all` → `color: var(--hq-primary-text)`

---

## Phase 8: Admin Pages (Partial)

**Note:** Full admin redesign is SPEC-ADMIN-UI-REFRESH

### Task 8.1: Critical Stats Only
- Revenue/stat numbers on light cards → `color: var(--hq-primary-text)`
- Line ~6675: totalRevenue
- Lines ~6865, 6893: Amount displays
- Line ~8558: statApproved

### Task 8.2: Version Management
- `.current-badge.stable` - Already fixed
- Pagination active button - Review

---

## Modification Patterns Reference

### Pattern A: Text Color on Light Background
```css
/* Before */
color: var(--hq-primary);
color: #00ff00;

/* After */
color: var(--hq-primary-text);
```

### Pattern B: Button with Neon Background
```css
/* Before */
background: #00ff00; color: white;

/* After */
background: var(--hq-primary); color: var(--hq-primary-on);
```

### Pattern C: Badge Styling
```css
/* Before */
background: var(--hq-primary-light); color: var(--hq-primary);

/* After (Primary Badge) */
background: var(--hq-primary); color: var(--hq-primary-on);
```

### Pattern D: Hover State
```css
/* Before */
:hover { color: var(--hq-primary); }

/* After */
:hover { color: var(--hq-primary-text); }
```

---

## Exceptions (Do NOT Modify)

1. **Logo text**: `> clinic_OS|` with `color: var(--hq-primary)` - Brand identity
2. **Terminal/Dark mode elements**: Text on #0D0208 background - Intentional
3. **Border-only usage**: `border-color: var(--hq-primary)` - OK
4. **Focus states with border**: Keep as accent
5. **Outline buttons on dark bg**: `.hq-btn-outline-terminal` - Intentional

---

## Verification Checklist

After each phase:
- [ ] Visual inspection of affected pages
- [ ] No unintended color changes
- [ ] Brand identity preserved
- [ ] Links/buttons clearly distinguishable

Final verification:
- [ ] Lighthouse accessibility score 90+
- [ ] Manual contrast check on key elements
- [ ] Cross-browser visual comparison
