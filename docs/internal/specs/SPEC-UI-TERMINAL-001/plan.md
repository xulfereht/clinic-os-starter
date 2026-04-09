# SPEC-UI-TERMINAL-001: Implementation Plan

---
spec-id: SPEC-UI-TERMINAL-001
version: 1.0.0
created: 2026-01-31
updated: 2026-01-31
---

## Overview

HQ 퍼블릭 페이지 터미널 테마 리디자인 구현 계획

---

## Phase 1: Audit & Documentation (감사 및 문서화)

### 1.1 현재 상태 분석

**목표:** 현재 페이지들의 디자인 토큰 사용 현황 파악

| Task | Description | Dependencies |
|------|-------------|--------------|
| T1.1.1 | 12개 페이지별 스크린샷 캡처 (Desktop/Mobile) | None |
| T1.1.2 | 디자인 토큰 사용 현황 매트릭스 작성 | T1.1.1 |
| T1.1.3 | 색상 대비율 검증 (axe-core) | T1.1.1 |
| T1.1.4 | 코드 블록 현황 분석 (Guide 페이지) | None |
| T1.1.5 | 베스트 프랙티스 대비 Gap 분석 문서 작성 | T1.1.2, T1.1.3 |

### 1.2 디자인 토큰 정리

**목표:** hq-tokens.css 터미널 관련 토큰 정리 및 확장

| Task | Description | Dependencies |
|------|-------------|--------------|
| T1.2.1 | 기존 터미널 토큰 인벤토리 | T1.1.2 |
| T1.2.2 | 누락된 토큰 식별 및 추가 제안 | T1.2.1 |
| T1.2.3 | 토큰 사용 가이드라인 문서화 | T1.2.2 |

**Output:**
- `.moai/docs/terminal-design-audit.md` (현재 상태 분석)
- `.moai/docs/terminal-token-guide.md` (토큰 사용 가이드)

---

## Phase 2: Pencil Design (목업 제작)

### 2.1 디자인 시스템 컴포넌트

**목표:** Pencil 앱에서 재사용 가능한 터미널 테마 컴포넌트 정의

| Task | Description | Priority |
|------|-------------|----------|
| T2.1.1 | Terminal Button 컴포넌트 (Primary, Secondary, Ghost) | High |
| T2.1.2 | Terminal Input 컴포넌트 (Text, Textarea, Select) | High |
| T2.1.3 | Terminal Card 컴포넌트 (Glass, Solid, Outline) | High |
| T2.1.4 | Terminal Code Block 컴포넌트 | High |
| T2.1.5 | Terminal Badge 컴포넌트 (Status, Label) | Medium |
| T2.1.6 | Terminal Navigation 컴포넌트 | Medium |

### 2.2 High Priority Pages 목업

**목표:** 우선순위 높은 4개 페이지 Pencil 목업 제작

| Page | Route | Pencil Node ID | Desktop | Mobile |
|------|-------|----------------|---------|--------|
| Landing | `/` | TBD | Required | Required |
| Login | `/login` | TBD | Required | Required |
| Download | `/download` | TBD | Required | Required |
| Guide | `/guide` | TBD | Required | Required |

**각 페이지 목업 포함 사항:**
- Desktop 레이아웃 (1440px)
- Mobile 레이아웃 (375px)
- 모든 상태 (default, hover, active, focus)
- 디자인 토큰 어노테이션

### 2.3 Medium Priority Pages 목업

| Page | Route | Pencil Node ID |
|------|-------|----------------|
| Plugins Store | `/plugins` | TBD |
| Plugin Submit | `/plugins/submit` | TBD |
| Developer Apply | `/plugins/developer-apply` | TBD |
| Board | `/board/*` | TBD |
| Feedback | `/feedback/*` | TBD |
| Register | `/register`, `/onboarding` | TBD |

### 2.4 Low Priority Pages 목업

| Page | Route | Pencil Node ID |
|------|-------|----------------|
| Profile | `/profile` | TBD |
| Messages | `/messages/*` | TBD |
| Changelog | `/changelog` | TBD |
| Survey Tools | `/survey-tools` | TBD |

**Output:**
- `pencil-hq-public.pen` (Pencil 디자인 파일)
- Component Node ID 문서

---

## Phase 3: Terminal Code Block Component (코드 블록 컴포넌트)

### 3.1 코드 블록 스타일링

**목표:** Guide 페이지 코드 블록에 터미널 스타일 적용

| Task | Description | File | Dependencies |
|------|-------------|------|--------------|
| T3.1.1 | 코드 블록 CSS 스타일 정의 | guide.js | T2.1.4 |
| T3.1.2 | 터미널 색상 Syntax Highlighting | guide.js | T3.1.1 |
| T3.1.3 | 코드 블록 헤더 (언어 라벨) | guide.js | T3.1.1 |
| T3.1.4 | 복사 버튼 구현 | guide.js | T3.1.3 |
| T3.1.5 | 라인 넘버 표시 (옵션) | guide.js | T3.1.1 |

### 3.2 코드 블록 디자인 스펙

```css
/* Terminal Code Block Styles */
.terminal-code-block {
    background: var(--hq-terminal-bg);  /* #0D0208 */
    border: 1px solid rgba(0, 255, 0, 0.2);
    border-radius: var(--hq-radius-md);  /* 8px */
    box-shadow: 0 0 15px rgba(0, 255, 0, 0.1);
    overflow: hidden;
}

.terminal-code-header {
    background: rgba(0, 255, 0, 0.05);
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(0, 255, 0, 0.1);
}

.terminal-code-lang {
    color: var(--hq-terminal);
    font-family: var(--hq-font-mono);
    font-size: 12px;
    text-transform: uppercase;
}

.terminal-code-copy {
    background: transparent;
    border: none;
    color: rgba(0, 255, 0, 0.6);
    cursor: pointer;
    transition: color 0.2s;
}

.terminal-code-copy:hover {
    color: var(--hq-terminal);
}

.terminal-code-content {
    padding: 16px;
    overflow-x: auto;
}

.terminal-code-content code {
    color: var(--hq-terminal);
    font-family: var(--hq-font-mono);
    font-size: 14px;
    line-height: 1.6;
}
```

### 3.3 Syntax Highlighting Theme

| Token Type | Color | CSS Variable |
|------------|-------|--------------|
| Keyword | #00FF00 | --code-keyword |
| String | #FFA500 | --code-string |
| Comment | #6B7280 | --code-comment |
| Number | #00FFFF | --code-number |
| Function | #FFFF00 | --code-function |
| Operator | #FF6B6B | --code-operator |
| Variable | #A78BFA | --code-variable |

**Output:**
- guide.js 코드 블록 스타일 업데이트
- hq-tokens.css 코드 하이라이팅 토큰 추가

---

## Phase 4: Page-by-Page Implementation (페이지별 구현)

### 4.1 High Priority (Primary Goals)

#### 4.1.1 Landing Page (`/`)

| Task | Description | Effort |
|------|-------------|--------|
| T4.1.1.1 | Hero 섹션 터미널 그라디언트 적용 | Medium |
| T4.1.1.2 | CTA 버튼 터미널 스타일 적용 | Low |
| T4.1.1.3 | Feature 카드 Glass 스타일 적용 | Medium |
| T4.1.1.4 | Social Proof 섹션 터미널 뱃지 | Low |
| T4.1.1.5 | FAQ 아코디언 터미널 악센트 | Low |
| T4.1.1.6 | 반응형 검증 (Desktop/Mobile) | Medium |

#### 4.1.2 Login Page (`/login`)

| Task | Description | Effort |
|------|-------------|--------|
| T4.1.2.1 | 다크 터미널 배경 적용 | Low |
| T4.1.2.2 | Glass 로그인 카드 구현 | Medium |
| T4.1.2.3 | 터미널 Input 스타일 (glow focus) | Low |
| T4.1.2.4 | 로고 터미널 커서 애니메이션 | Low |
| T4.1.2.5 | 에러 메시지 터미널 스타일 | Low |

#### 4.1.3 Download Page (`/download`)

| Task | Description | Effort |
|------|-------------|--------|
| T4.1.3.1 | 다운로드 카드 터미널 스타일 | Medium |
| T4.1.3.2 | 버전 정보 터미널 뱃지 | Low |
| T4.1.3.3 | 채널 선택 (stable/beta) 스타일 | Low |
| T4.1.3.4 | 릴리즈 노트 코드 블록 스타일 | Medium |
| T4.1.3.5 | 다운로드 버튼 터미널 스타일 | Low |

#### 4.1.4 Guide Page (`/guide`)

| Task | Description | Effort |
|------|-------------|--------|
| T4.1.4.1 | 사이드바 터미널 악센트 적용 | Low |
| T4.1.4.2 | 콘텐츠 영역 타이포그래피 정리 | Low |
| T4.1.4.3 | 코드 블록 터미널 스타일 (Phase 3) | High |
| T4.1.4.4 | 링크/버튼 터미널 호버 효과 | Low |
| T4.1.4.5 | 검색 입력 터미널 스타일 | Low |

### 4.2 Medium Priority (Secondary Goals)

#### 4.2.1 Plugins Pages (`/plugins/*`)

| Task | Description |
|------|-------------|
| T4.2.1.1 | 플러그인 카드 터미널 보더 |
| T4.2.1.2 | 상태 뱃지 터미널 색상 |
| T4.2.1.3 | 설치 버튼 터미널 그린 |
| T4.2.1.4 | 필터 터미널 스타일 |

#### 4.2.2 Board Pages (`/board/*`)

| Task | Description |
|------|-------------|
| T4.2.2.1 | 포스트 카드 터미널 악센트 |
| T4.2.2.2 | 작성자 뱃지 터미널 스타일 |
| T4.2.2.3 | 투표 버튼 터미널 하이라이트 |
| T4.2.2.4 | 게시글 내 코드 블록 스타일 |

#### 4.2.3 Feedback Pages (`/feedback/*`)

| Task | Description |
|------|-------------|
| T4.2.3.1 | 폼 입력 터미널 glow focus |
| T4.2.3.2 | 상태 인디케이터 터미널 색상 |
| T4.2.3.3 | 카테고리 칩 터미널 스타일 |
| T4.2.3.4 | 제출 확인 터미널 애니메이션 |

#### 4.2.4 Register Pages (`/register`, `/onboarding`)

| Task | Description |
|------|-------------|
| T4.2.4.1 | 단계 진행 인디케이터 터미널 |
| T4.2.4.2 | 입력 검증 피드백 터미널 색상 |
| T4.2.4.3 | 성공 상태 터미널 그린 |

### 4.3 Low Priority (Final Goals)

#### 4.3.1 Profile, Messages, Changelog, Survey Tools

| Page | Tasks |
|------|-------|
| Profile | 사용자 카드 터미널 악센트, 버튼 스타일 |
| Messages | 메시지 리스트 보더, 입력 스타일 |
| Changelog | 버전 타임라인 터미널, 변경 타입 뱃지 |
| Survey Tools | 도구 카드 보더, 기능 하이라이트 |

---

## Phase 5: Verification & Polish (검증 및 마무리)

### 5.1 Quality Assurance

| Task | Description | Tool |
|------|-------------|------|
| T5.1.1 | WCAG AA 대비율 검증 | axe-core, Lighthouse |
| T5.1.2 | 브라우저 호환성 테스트 | BrowserStack |
| T5.1.3 | 반응형 레이아웃 검증 | Chrome DevTools |
| T5.1.4 | 키보드 네비게이션 테스트 | Manual |
| T5.1.5 | Screen Reader 테스트 | VoiceOver, NVDA |

### 5.2 Performance Optimization

| Task | Description |
|------|-------------|
| T5.2.1 | CSS 최적화 (불필요한 스타일 제거) |
| T5.2.2 | 애니메이션 성능 검증 (GPU 가속) |
| T5.2.3 | prefers-reduced-motion 지원 |
| T5.2.4 | Lighthouse 성능 점수 검증 (90+) |

### 5.3 Documentation

| Task | Description | Output |
|------|-------------|--------|
| T5.3.1 | 터미널 디자인 가이드 최종화 | design-guide.md |
| T5.3.2 | 컴포넌트 사용법 문서화 | component-usage.md |
| T5.3.3 | Pencil-to-Code 매핑 문서 | pencil-mapping.md |

---

## Milestone Summary

| Milestone | Phase | Deliverables |
|-----------|-------|--------------|
| M1: Audit Complete | Phase 1 | 현재 상태 분석 문서, 토큰 가이드 |
| M2: Designs Ready | Phase 2 | Pencil 디자인 파일, 컴포넌트 정의 |
| M3: Code Blocks Done | Phase 3 | guide.js 코드 블록 터미널 스타일 |
| M4: High Priority Done | Phase 4.1 | Landing, Login, Download, Guide 완료 |
| M5: Medium Priority Done | Phase 4.2 | Plugins, Board, Feedback, Register 완료 |
| M6: All Pages Done | Phase 4.3 | 모든 12개 페이지 완료 |
| M7: Verified | Phase 5 | QA 통과, 문서화 완료 |

---

## Technical Approach

### 파일 수정 전략

**index.js (28,000+ lines) 수정 접근:**

1. **점진적 수정**: 한 번에 하나의 페이지 함수만 수정
2. **Git 브랜치**: 각 페이지별 feature 브랜치 분리
3. **테스트 우선**: 수정 전 현재 동작 스크린샷 캡처
4. **롤백 가능**: 각 수정 후 독립적 커밋

### CSS 변경 전략

1. **baseStyles 확장**: 공통 터미널 스타일 baseStyles에 추가
2. **페이지별 스타일**: 각 페이지 함수 내 인라인 스타일 수정
3. **hq-tokens.css 동기화**: 새 토큰은 hq-tokens.css에 정의

### 코드 블록 구현 전략

1. **marked.js 커스터마이징**: 코드 블록 렌더러 오버라이드
2. **언어 감지**: 자동 언어 감지 + 수동 지정 지원
3. **복사 기능**: Clipboard API 사용, fallback 제공

---

## Risk Mitigation

| Risk | Mitigation Strategy |
|------|---------------------|
| 대규모 index.js 수정 | 페이지별 독립 커밋, 자동 테스트 |
| 디자인 불일치 | Pencil 목업 사전 승인 필수 |
| 접근성 저하 | Phase 5 QA에서 집중 검증 |
| 일정 지연 | 우선순위별 단계적 배포 가능 |
