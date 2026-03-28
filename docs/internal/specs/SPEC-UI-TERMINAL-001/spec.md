# SPEC-UI-TERMINAL-001: HQ 퍼블릭 페이지 터미널 테마 리디자인

---
id: SPEC-UI-TERMINAL-001
version: 1.0.0
status: draft
created: 2026-01-31
updated: 2026-01-31
author: amu
priority: high
related-specs:
  - SPEC-HQ-COLOR-001
  - SPEC-ADMIN-UI-REFRESH
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-31 | amu | 초안 작성 |

---

## 1. Overview

### 1.1 Background

Clinic-OS HQ의 퍼블릭 페이지들은 현재 다양한 스타일이 혼재되어 있습니다. `hq-tokens.css`에 정의된 **Terminal Palette** 디자인 시스템이 존재하지만 일관되게 적용되지 않았습니다.

**기존 디자인 토큰 (hq-tokens.css):**
- `--hq-terminal`: #00FF00 (Primary Green)
- `--hq-terminal-glow`: rgba(0, 255, 0, 0.3)
- `--hq-terminal-bg`: #0D0208 (Dark Background)
- `--hq-matrix`: #00FF41 (Accent Green)
- `--hq-dark-gradient`: linear-gradient(135deg, #0D0208 0%, #0A1F0A 100%)
- `--hq-font-mono`: 'JetBrains Mono', 'Fira Code', monospace

**참조 SPEC:**
- SPEC-HQ-COLOR-001: 색상 시스템 정렬 (Neon Green은 FILL로만 사용)
- SPEC-ADMIN-UI-REFRESH: Admin 페이지 디자인 시스템 (별도 `--ds-*` 토큰)

### 1.2 Problem Statement

현재 퍼블릭 페이지들의 문제점:

1. **일관성 부족**: 페이지마다 다른 스타일 적용
2. **터미널 정체성 희석**: 브랜드 Terminal Green이 포인트 색상으로 충분히 활용되지 않음
3. **코드 블록 스타일 미흡**: Guide 페이지의 코드 블록이 터미널 테마를 반영하지 않음
4. **Pencil 디자인 부재**: 구현 전 목업 없이 직접 코딩하여 디자인 일관성 검증 불가
5. **가독성 문제**: SPEC-HQ-COLOR-001에서 식별된 대비율 문제 잔존

### 1.3 Goals

| Goal | Description |
|------|-------------|
| G1 | 모든 퍼블릭 페이지에 Terminal Palette 디자인 시스템 일관 적용 |
| G2 | 각 페이지별 Pencil 앱 목업 우선 제작 |
| G3 | Terminal Green(#00FF00)을 시그니처 포인트 색상으로 활용 |
| G4 | Guide 페이지 코드 블록에 터미널 스타일 적용 |
| G5 | WCAG AA 이상 가독성 준수 (대비율 4.5:1 이상) |
| G6 | 현재 상태 대비 베스트 프랙티스 문서화 |

### 1.4 Non-Goals

| Non-Goal | Reason |
|----------|--------|
| Admin 페이지 리디자인 | SPEC-ADMIN-UI-REFRESH에서 별도 처리 |
| 새로운 페이지 추가 | 기존 페이지 리디자인만 범위 |
| 백엔드 로직 변경 | 프론트엔드 스타일링만 수정 |
| API 변경 | 기존 데이터 구조 유지 |
| 모바일 앱 개발 | 웹 반응형만 범위 |

---

## 2. Requirements (EARS Format)

### 2.1 Terminal Theme (REQ-TERMINAL)

#### REQ-TERMINAL-001: Dark Background Application
**When** a page requires emphasis or visual hierarchy,
**the system shall** use `--hq-dark-gradient` for hero sections and key containers,
**so that** the terminal aesthetic is consistently applied.

#### REQ-TERMINAL-002: Terminal Green as Point Color
**The system shall** use `--hq-terminal` (#00FF00) exclusively as a point color for:
- Primary buttons (as fill with black text)
- Active states and focus indicators
- Decorative accents and highlights
- Icon highlights in key areas
**so that** brand identity is maintained without compromising readability.

#### REQ-TERMINAL-003: Glow Effect Usage
**When** interactive elements require visual feedback,
**the system shall** apply `--hq-terminal-glow` for hover/focus states,
**so that** the terminal "glow" effect creates a cohesive visual language.

#### REQ-TERMINAL-004: Monospace Typography
**When** code, terminal output, or technical content is displayed,
**the system shall** use `--hq-font-mono` ('JetBrains Mono', 'Fira Code', monospace),
**so that** technical content is clearly distinguished.

### 2.2 Code Block Styling (REQ-CODE)

#### REQ-CODE-001: Terminal-Style Code Blocks
**When** code blocks are rendered in Guide pages,
**the system shall** display them with:
- Background: `--hq-terminal-bg` (#0D0208)
- Text: `--hq-terminal` (#00FF00) for code
- Border: 1px solid rgba(0, 255, 0, 0.2)
- Border-radius: `--hq-radius-md` (8px)
- Box-shadow: subtle terminal glow effect
**so that** code blocks visually represent a terminal environment.

#### REQ-CODE-002: Syntax Highlighting Theme
**When** syntax highlighting is applied,
**the system shall** use terminal-inspired colors:
- Keywords: #00FF00 (Terminal Green)
- Strings: #FFA500 (Amber)
- Comments: #6B7280 (Gray)
- Numbers: #00FFFF (Cyan)
- Functions: #FFFF00 (Yellow)
**so that** code remains readable while maintaining terminal aesthetic.

#### REQ-CODE-003: Code Block Header
**When** a code block has a language identifier,
**the system shall** display a header bar with:
- Language label (e.g., "bash", "javascript")
- Copy button with terminal-style icon
- Background slightly lighter than code block
**so that** users can identify language and copy code easily.

#### REQ-CODE-004: Line Numbers
**Where possible**, code blocks **shall** display line numbers in a muted color,
**so that** code can be referenced precisely.

### 2.3 Pencil Integration (REQ-PENCIL)

#### REQ-PENCIL-001: Design-First Approach
**Before** implementing any page redesign,
**the system shall** have a corresponding Pencil design file (.pen) with:
- Desktop layout (1440px width)
- Mobile layout (375px width)
- Component states (default, hover, active, disabled)
- Design token annotations
**so that** implementation matches approved designs.

#### REQ-PENCIL-002: Component Mapping
**When** a Pencil design is created,
**the system shall** document:
- Node IDs for each major component
- Design token values used
- Interaction specifications
**so that** developers can reference exact design specifications.

#### REQ-PENCIL-003: Design Review Checkpoint
**Before** implementation begins,
**the system shall** require design approval through Pencil file review,
**so that** design consistency is validated before coding.

### 2.4 Page-Specific Requirements (REQ-PAGE)

#### REQ-PAGE-LANDING: Landing Page (/)
**When** the landing page is displayed,
**the system shall** feature:
- Hero section with terminal gradient background
- Terminal Green primary CTAs
- Glassmorphism cards with subtle terminal glow
- Social proof section with terminal-style badges
- FAQ accordion with terminal accent colors
**Priority**: High

#### REQ-PAGE-LOGIN: Login Page (/login)
**When** the login page is displayed,
**the system shall** feature:
- Dark terminal-themed background
- Glass-morphism login card
- Terminal-style input fields with glow focus
- Primary button with terminal green fill
- Logo with terminal cursor animation
**Priority**: High

#### REQ-PAGE-DOWNLOAD: Download Page (/download)
**When** the download page is displayed,
**the system shall** feature:
- Terminal-style download cards with version info
- Progress indicators with terminal green
- Channel selection (stable/beta) with terminal styling
- Release notes in terminal-style code blocks
**Priority**: High

#### REQ-PAGE-GUIDE: Guide Page (/guide)
**When** the guide page is displayed,
**the system shall** feature:
- Sidebar navigation with terminal accents
- Content area with clean typography
- Code blocks with full terminal styling (REQ-CODE-*)
- Table of contents with terminal hover effects
- Copy-to-clipboard with terminal feedback
**Priority**: High

#### REQ-PAGE-PLUGINS: Plugin Pages (/plugins/*)
**When** plugin-related pages are displayed,
**the system shall** feature:
- Plugin cards with terminal border accents
- Status badges (stable, beta, new) with terminal colors
- Install buttons with terminal green
- Category filters with terminal styling
**Priority**: Medium

#### REQ-PAGE-BOARD: Board Pages (/board/*)
**When** board pages are displayed,
**the system shall** feature:
- Post cards with subtle terminal accents
- Author badges with terminal styling
- Vote buttons with terminal green highlights
- Code blocks in posts with terminal theme
**Priority**: Medium

#### REQ-PAGE-FEEDBACK: Feedback Pages (/feedback/*)
**When** feedback pages are displayed,
**the system shall** feature:
- Form inputs with terminal glow focus
- Status indicators with terminal colors
- Category chips with terminal styling
- Submission confirmation with terminal animation
**Priority**: Medium

#### REQ-PAGE-PROFILE: Profile Page (/profile)
**When** the profile page is displayed,
**the system shall** feature:
- User info card with terminal accents
- Settings sections with terminal dividers
- Action buttons with terminal styling
**Priority**: Low

#### REQ-PAGE-MESSAGES: Message Pages (/messages/*)
**When** message pages are displayed,
**the system shall** feature:
- Message list with terminal borders
- Compose area with terminal input styling
- Send button with terminal green
**Priority**: Low

#### REQ-PAGE-CHANGELOG: Changelog Page (/changelog)
**When** the changelog page is displayed,
**the system shall** feature:
- Version entries with terminal styling
- Date badges with terminal colors
- Change type labels (feat, fix, etc.) with terminal accents
- Timeline with terminal green connector
**Priority**: Low

#### REQ-PAGE-REGISTER: Registration Pages (/register, /onboarding)
**When** registration pages are displayed,
**the system shall** feature:
- Multi-step form with terminal progress indicator
- Input validation with terminal-colored feedback
- Success states with terminal green
**Priority**: Medium

#### REQ-PAGE-SURVEY: Survey Tools Page (/survey-tools)
**When** the survey tools page is displayed,
**the system shall** feature:
- Tool cards with terminal borders
- Feature highlights with terminal green
**Priority**: Low

---

## 3. Technical Constraints

### 3.1 Design Token System

- 기존 `hq-tokens.css` 토큰 재사용 및 확장
- Admin 페이지의 `--ds-*` 토큰과 충돌 방지
- CSS 변수 기반으로 런타임 테마 변경 가능성 유지

### 3.2 Performance

- 인라인 스타일 최소화, CSS 클래스 활용
- Glow 효과는 `box-shadow` 또는 `filter` 사용 (GPU 가속)
- 불필요한 애니메이션 비활성화 옵션 제공 (prefers-reduced-motion)

### 3.3 Browser Support

- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- CSS Grid, Flexbox, CSS Variables 필수
- backdrop-filter 지원 (Safari fallback 필요)

### 3.4 Accessibility

- WCAG AA 준수 (대비율 4.5:1 이상)
- 키보드 네비게이션 완전 지원
- Screen reader 호환 (aria-labels)
- Focus visible 스타일 유지

### 3.5 File Structure

현재 구조 (index.js ~28,000 lines):
```
hq/src/
├── index.js           # Main worker (모든 페이지 렌더링)
├── guide.js           # Guide page 렌더링
├── styles/
│   └── hq-tokens.css  # Design tokens
└── lib/
    └── jwt.js         # Authentication
```

---

## 4. Dependencies

| Dependency | Type | Status | Notes |
|------------|------|--------|-------|
| hq-tokens.css | Internal | Exists | 터미널 토큰 정의됨 |
| index.js baseStyles | Internal | Exists | 수정 필요 |
| guide.js | Internal | Exists | 코드 블록 스타일 수정 필요 |
| Pencil App | Tool | Required | 목업 제작용 |
| SPEC-HQ-COLOR-001 | SPEC | Draft | 색상 원칙 참조 |
| JetBrains Mono Font | External | CDN | 모노스페이스 폰트 |
| DOMPurify | External | CDN | Markdown 렌더링 |
| marked.js | External | CDN | Markdown 파싱 |

---

## 5. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 기존 기능 회귀 | High | Medium | 단계별 검증, 기능 테스트 체크리스트 |
| 색상 대비율 미달 | Medium | Medium | WCAG 검증 도구 사용, 자동화 테스트 |
| Pencil 디자인 지연 | Medium | Low | 페이지 우선순위별 진행 |
| 브라우저 호환성 문제 | Medium | Low | backdrop-filter fallback 준비 |
| 터미널 테마 과도한 적용 | Low | Medium | 사용성 테스트, 피드백 수집 |
| index.js 대규모 파일 수정 리스크 | High | Medium | 점진적 수정, Git 브랜치 분리 |

---

## 6. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| 디자인 토큰 일관성 | 100% | 모든 페이지 토큰 사용 검증 |
| WCAG AA 준수율 | 100% | axe-core 자동 검증 |
| Pencil 목업 커버리지 | 100% (12 페이지) | 목업 파일 존재 여부 |
| 코드 블록 터미널 스타일 | 100% | Guide 페이지 코드 블록 검증 |
| 사용자 만족도 | 4.0/5.0 이상 | 피드백 허브 설문 |

---

## 7. References

- [WCAG 2.1 Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Terminal Color Palette Best Practices](https://terminalcss.xyz/)
- Pencil Design File: `pencil-hq-public.pen` (to be created)
- SPEC-HQ-COLOR-001: HQ Color System Alignment
- SPEC-ADMIN-UI-REFRESH: Admin Design System

---

## 8. Appendix: Current State Analysis

### 8.1 Page Inventory (12 Total)

| # | Page | Route | Current State | Priority |
|---|------|-------|---------------|----------|
| 1 | Landing | `/` | 밝은 테마, 부분적 터미널 요소 | High |
| 2 | Login | `/login` | 기본 폼 스타일 | High |
| 3 | Download | `/download` | 기본 카드 스타일 | High |
| 4 | Guide | `/guide` | 사이드바 + 콘텐츠, 코드 블록 기본 | High |
| 5 | Plugins Store | `/plugins` | 카드 그리드, 기본 스타일 | Medium |
| 6 | Plugin Submit | `/plugins/submit` | 폼 스타일 | Medium |
| 7 | Developer Apply | `/plugins/developer-apply` | 폼 스타일 | Medium |
| 8 | Board List | `/board` | 포스트 리스트 | Medium |
| 9 | Board Write | `/board/write` | 에디터 폼 | Medium |
| 10 | Feedback Hub | `/feedback` | 피드백 폼 | Medium |
| 11 | Register | `/register`, `/onboarding` | 등록 폼 | Medium |
| 12 | Others | `/profile`, `/messages`, `/changelog`, `/survey-tools` | 기본 스타일 | Low |

### 8.2 Design Token Usage Gap

**현재 사용 중:**
- `--hq-primary`, `--hq-primary-light`, `--hq-primary-dark`
- `--hq-surface`, `--hq-bg`, `--hq-border`
- `--hq-text`, `--hq-text-muted`

**미사용/저활용:**
- `--hq-terminal` (일부만 사용)
- `--hq-terminal-glow` (거의 미사용)
- `--hq-dark-gradient` (Landing만 일부 사용)
- `--hq-matrix` (미사용)
- `.hq-glass-card` (정의됨, 미사용)
- `.hq-btn-terminal` (정의됨, 미사용)

### 8.3 Code Block Current State (guide.js)

현재 코드 블록 스타일:
```css
.article-body pre {
    background: var(--hq-dark-light);  /* #0A2F1A - 어두운 녹색 */
    padding: 1.25rem;
    border-radius: 8px;
    overflow-x: auto;
    font-family: ui-monospace, monospace;
}
```

**문제점:**
- 터미널 색상 미적용 (#00FF00 텍스트 없음)
- Glow 효과 없음
- 복사 버튼 없음
- 언어 라벨 없음
