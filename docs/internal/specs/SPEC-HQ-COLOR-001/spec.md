# SPEC-HQ-COLOR-001: HQ Public Pages Color System Alignment

---
id: SPEC-HQ-COLOR-001
version: 1.0.0
status: draft
created: 2026-01-31
updated: 2026-01-31
author: amu
priority: high
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-31 | amu | Initial draft |

---

## 1. Overview

### 1.1 Background

Pencil 앱에서 기획한 **clinic_OS Terminal Palette** 디자인 시스템이 HQ 퍼블릭 페이지들에 일관되게 적용되지 않아 가독성 문제가 발생하고 있습니다.

핵심 디자인 원칙:
- **Neon Green(#00FF00)은 FILL(배경)으로만 사용**
- **네온 그린 배경 위 텍스트는 검정(#000000)으로 WCAG AAA 준수 (14.5:1)**
- **밝은 배경에서 브랜드 텍스트는 #166534 사용**

### 1.2 Problem Statement

현재 `hq/src/index.js`에 약 80-100개의 CSS 속성에서 다음 위반 패턴 발견:
- 밝은 배경에서 `color: var(--hq-primary)` 또는 `color: #00ff00` 사용 (대비율 1.2:1로 가독성 실패)
- 버튼에서 `background: #00ff00; color: white;` 사용 (원칙 위반)
- 배지/태그에서 일관되지 않은 색상 사용

### 1.3 Goals

| Goal | Description |
|------|-------------|
| G1 | WCAG AAA 가독성 준수 (모든 텍스트 대비율 4.5:1 이상) |
| G2 | clinic_OS Terminal Palette 디자인 원칙 일관 적용 |
| G3 | 터미널/매트릭스 브랜드 정체성 유지 |
| G4 | 디자인 토큰 시스템 정리 및 명확화 |

### 1.4 Non-Goals

| Non-Goal | Reason |
|----------|--------|
| Admin 페이지 전체 리디자인 | 별도 SPEC(SPEC-ADMIN-UI-REFRESH)에서 처리 |
| 새로운 컴포넌트 추가 | 범위 외 |
| 레이아웃 변경 | 색상 시스템만 수정 |
| 다크 모드 요소 변경 | 터미널 스타일 의도적 유지 |

---

## 2. Requirements (EARS Format)

### 2.1 Token System (REQ-TOKEN)

#### REQ-TOKEN-001: Primary Color Token Clarification
**When** the design system is applied,
**the system shall** use `--hq-primary` (#00FF00) exclusively for fill/background purposes,
**so that** the neon green maintains terminal aesthetic while ensuring readability.

#### REQ-TOKEN-002: Text on Primary Background
**When** text is placed on a `--hq-primary` background,
**the system shall** use `--hq-primary-on` (#000000) for text color,
**so that** WCAG AAA compliance (14.5:1 contrast ratio) is achieved.

#### REQ-TOKEN-003: Brand Text on Light Background
**When** brand-colored text is needed on light backgrounds,
**the system shall** use `--hq-primary-text` (#166534) instead of `--hq-primary`,
**so that** text remains readable (7.5:1 contrast ratio) while maintaining brand identity.

#### REQ-TOKEN-004: Token Naming Convention
**If** a token ends with `-light` suffix,
**then** it **shall** represent a lighter variant suitable for light mode backgrounds.

### 2.2 Button Components (REQ-BTN)

#### REQ-BTN-001: Primary Button Style
**When** a primary button is rendered,
**the system shall** display it with:
- Background: `var(--hq-primary)` (#00FF00)
- Text color: `var(--hq-primary-on)` (#000000)
- Font weight: bold

#### REQ-BTN-002: No White Text on Neon Background
**The system shall not** use white (#FFFFFF) text on neon green backgrounds,
**so that** WCAG contrast requirements are met.

#### REQ-BTN-003: Ghost Button on Light Background
**When** a ghost button is displayed on a light background,
**the system shall** use `--hq-primary-text` (#166534) for text color,
**so that** the button remains readable.

### 2.3 Badge Components (REQ-BADGE)

#### REQ-BADGE-001: Primary Badge Style
**When** a primary/stable badge is rendered,
**the system shall** display it with:
- Background: `var(--hq-primary)` (#00FF00)
- Text color: `var(--hq-primary-on)` (#000000)

#### REQ-BADGE-002: Secondary Badge Style
**When** a secondary badge is rendered on light background,
**the system shall** use readable text colors (not #00FF00 as text).

### 2.4 Link & Hover States (REQ-LINK)

#### REQ-LINK-001: Link Color on Light Background
**When** a link is displayed on a light background,
**the system shall** use `--hq-primary-text` (#166534) for normal state,
**so that** the link is clearly visible and readable.

#### REQ-LINK-002: Hover State on Light Background
**When** a user hovers over a link on a light background,
**the system shall** transition to `--hq-primary-text` color or a darker variant,
**not** `--hq-primary` (#00FF00).

### 2.5 Statistics & Numbers (REQ-STAT)

#### REQ-STAT-001: Stat Numbers on Light Cards
**When** statistics numbers are displayed on light background cards,
**the system shall** use `--hq-primary-text` (#166534) for emphasis,
**so that** numbers are clearly readable.

### 2.6 Exceptions (REQ-EXCEPT)

#### REQ-EXCEPT-001: Terminal/Dark Mode Elements
**When** elements are explicitly styled for terminal/dark mode (background: #0D0208 or similar),
**the system may** use `--hq-terminal` (#00FF00) for text color,
**as** this maintains the terminal aesthetic with sufficient contrast.

#### REQ-EXCEPT-002: Logo Text
**The system shall** keep logo text (`> clinic_OS|`) in `--hq-primary` (#00FF00),
**as** this is a deliberate brand identity element.

#### REQ-EXCEPT-003: Border-only Usage
**When** `--hq-primary` is used only for border-color (not text),
**the system may** retain this usage,
**as** borders do not have the same readability requirements as text.

---

## 3. Affected Pages

| Page | Route | Priority | Estimated Changes |
|------|-------|----------|-------------------|
| Landing | `/` | High | 15-20 |
| Download | `/download` | High | 10-15 |
| Login | `/login` | Medium | 5-10 |
| Board | `/board/*` | High | 20-25 |
| Feedback | `/feedback/*` | High | 15-20 |
| Plugin | `/plugin/*` | Medium | 15-20 |
| Guide | `/guide` | Low | 5 |
| Changelog | `/changelog` | Low | 5 |
| Admin (partial) | `/admin/*` | Medium | 10-15 |

---

## 4. Technical Constraints

### 4.1 Token System
- `hq-tokens.css`와 `index.js` 내 baseStyles의 토큰 동기화 필요
- 기존 토큰 이름 유지하되 용도 명확화

### 4.2 Backward Compatibility
- 기존 디자인의 시각적 정체성 유지
- 레이아웃, 스페이싱 변경 없음

### 4.3 Performance
- CSS 변수 사용으로 런타임 오버헤드 최소화
- 불필요한 인라인 스타일을 클래스로 통합 가능

---

## 5. Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| hq-tokens.css | Internal | Exists, needs update |
| index.js baseStyles | Internal | Exists, needs update |
| Pencil design file (pencil-new.pen) | Design | Complete |
| WCAG 2.1 Guidelines | External | Reference |

---

## 6. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 터미널 스타일 요소 오판 | Medium | Medium | 배경색 확인 후 수정 |
| 예상치 못한 곳에 영향 | Medium | Low | 단계별 검증 |
| 브랜드 정체성 훼손 | High | Low | 로고, 터미널 요소 예외 처리 |

---

## 7. References

- [WCAG 2.1 Contrast Requirements](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- Pencil Design File: `pencil-new.pen`
- Previous SPEC: SPEC-HQ-UI-REFRESH
