# Acceptance Criteria: SPEC-HQ-COLOR-001

## Overview

HQ 퍼블릭 페이지 컬러 시스템 정렬의 수락 기준입니다.

---

## Test Scenarios

### Scenario 1: Primary Button Contrast

```gherkin
Given 사용자가 Landing 페이지에 접속한다
When Primary 버튼(시작하기, 다운로드 등)을 확인한다
Then 버튼 배경색이 #00FF00(네온 그린)이어야 한다
And 버튼 텍스트 색상이 #000000(검정)이어야 한다
And 텍스트 대비율이 14.5:1 이상이어야 한다
```

### Scenario 2: Badge Readability

```gherkin
Given 사용자가 Download 페이지에 접속한다
When Stable 채널 배지를 확인한다
Then 배지 배경색이 네온 그린이어야 한다
And 배지 텍스트가 검정색이어야 한다
And 텍스트가 명확하게 읽혀야 한다
```

### Scenario 3: Link Visibility on Light Background

```gherkin
Given 사용자가 Board 페이지에 접속한다
When 게시물 제목 링크를 확인한다
Then 링크 색상이 #166534(readable green)이어야 한다
And 흰색 배경에서 링크가 명확하게 구분되어야 한다
```

### Scenario 4: Hover State Accessibility

```gherkin
Given 사용자가 Footer 영역에서 링크 위에 마우스를 올린다
When hover 상태가 활성화된다
Then 링크 색상이 #166534 또는 더 어두운 변형이어야 한다
And #00FF00(네온 그린)이 텍스트 색상으로 사용되지 않아야 한다
```

### Scenario 5: Statistics Number Display

```gherkin
Given 사용자가 Feedback Hub 페이지에 접속한다
When 통계 카드의 숫자를 확인한다
Then 숫자 색상이 #166534이어야 한다
And 밝은 배경에서 숫자가 명확하게 보여야 한다
```

### Scenario 6: Terminal Style Exception

```gherkin
Given 사용자가 Login 페이지에 접속한다
When 터미널 스타일 입력 필드를 확인한다
Then 어두운 배경(#0D0208)에서 녹색(#00FF00) 텍스트가 허용된다
And 이것은 의도된 터미널 aesthetic이다
```

### Scenario 7: Logo Identity

```gherkin
Given 사용자가 어느 HQ 페이지든 접속한다
When 네비게이션 바의 로고를 확인한다
Then 로고 텍스트 "> clinic_OS|"는 #00FF00 색상을 유지해야 한다
And 이것은 브랜드 정체성 요소이다
```

---

## Quality Gates

### Gate 1: Zero Readability Violations

**Criteria:**
- `color: var(--hq-primary)` 또는 `color: #00ff00`이 밝은 배경(#FFFFFF, #F8FAFC, #F1F5F9 등)에서 사용되는 케이스: **0건**

**Verification:**
```bash
# 밝은 배경에서 녹색 텍스트 사용 검색 (수동 검토 필요)
grep -n "color.*#00[fF][fF]00\|color.*var(--hq-primary)" hq/src/index.js
```

### Gate 2: Button Text Compliance

**Criteria:**
- 네온 그린 배경 버튼의 텍스트가 모두 `var(--hq-primary-on)` 또는 `#000000`

**Verification:**
- 모든 `.btn-primary`, `.hq-btn-primary`, `.btn-terminal` 클래스 검토
- 인라인 `background: #00ff00` 스타일 검토

### Gate 3: Accessibility Score

**Criteria:**
- Lighthouse 접근성 점수: **90점 이상**

**Verification:**
```bash
# Lighthouse CLI로 검증
lighthouse https://clinic-os-hq.pages.dev --only-categories=accessibility
```

### Gate 4: Brand Identity Preservation

**Criteria:**
- 로고, 터미널 스타일 요소가 기존 디자인 유지
- 전체적인 "terminal/matrix" 느낌 보존

**Verification:**
- Before/After 스크린샷 비교
- 디자인 리뷰

---

## Edge Cases

### Edge Case 1: Inline Styles

일부 요소는 JavaScript로 동적 생성되며 인라인 스타일 사용.
이 경우에도 동일한 원칙 적용 필요.

### Edge Case 2: Hover Transitions

Hover 상태에서 색상 전환 시 어색한 점프 없이 부드러운 전환 확인.

### Edge Case 3: Focus States

키보드 네비게이션 시 focus 상태에서도 충분한 대비 유지.

---

## Rollback Criteria

다음 상황 발생 시 롤백:
1. Lighthouse 접근성 점수가 85 미만으로 하락
2. 주요 페이지에서 텍스트가 전혀 보이지 않는 문제 발생
3. 브랜드 정체성이 심각하게 훼손됨

---

## Sign-off Requirements

- [ ] 모든 테스트 시나리오 통과
- [ ] Quality Gates 충족
- [ ] 시각적 회귀 없음
- [ ] 디자인 승인 (Pencil 기획 대비)
