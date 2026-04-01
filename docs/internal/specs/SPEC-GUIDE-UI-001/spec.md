# SPEC-GUIDE-UI-001: 가이드 페이지 UI/UX 개선

## 개요

**상태**: Draft
**생성일**: 2026-02-01
**파일**: `hq/src/guide.js`

---

## 문제점

### P1: 코드블록 복사 버튼 미작동 (Critical)
- **현상**: Copy 버튼 클릭 시 코드가 제대로 복사되지 않음
- **원인**: 버튼이 `<pre>` 내부에 추가되어 `textContent`에 "Copy" 텍스트 포함
- **위치**: guide.js:976

### P2: 사이드바 활성 메뉴 가독성 저하 (Major)
- **현상**: 선택된 메뉴 항목의 텍스트가 잘 보이지 않음
- **원인**: 연한 녹색 배경(#DCFCE7)에 형광 녹색 텍스트(#00FF00) → 대비 부족
- **위치**: guide.js:308-313

### P3: 전체 UI/UX 최적화 필요 (Enhancement)
- 터미널 테마 일관성 강화
- 코드블록 스타일 개선
- 반응형 레이아웃 정리

---

## 요구사항 (EARS Format)

### REQ-001: 코드블록 복사 기능 수정
**When** 사용자가 코드블록의 Copy 버튼을 클릭하면,
**the system shall** `<pre>` 내부의 `<code>` 요소 텍스트만 추출하여 클립보드에 복사한다.

**수용 기준**:
- [ ] 버튼 텍스트("Copy")가 복사 내용에 포함되지 않음
- [ ] 코드에 "Copy" 문자열이 있어도 정상 복사됨
- [ ] 복사 성공 시 "Copied!" 피드백 표시

### REQ-002: 사이드바 활성 상태 가독성 개선
**When** 사이드바 메뉴 항목이 활성화되면,
**the system shall** 배경과 텍스트 색상 대비를 WCAG AA 기준(4.5:1) 이상으로 유지한다.

**수용 기준**:
- [ ] 활성 메뉴의 텍스트가 명확히 구분됨
- [ ] 터미널 테마 일관성 유지
- [ ] hover/active 상태 전환이 자연스러움

### REQ-003: 코드블록 UI 개선
**The system shall** 코드블록에 터미널 헤더 스타일을 적용한다.

**수용 기준**:
- [ ] 터미널 창 스타일 (다크 배경 + 그린 텍스트)
- [ ] Copy 버튼 위치 및 스타일 개선
- [ ] 언어 표시 (선택적)

---

## 기술 접근

### 1. 복사 버튼 수정
```javascript
// Before
navigator.clipboard.writeText(pre.textContent.replace('Copy', '').trim());

// After
const code = pre.querySelector('code');
const text = code ? code.textContent : pre.textContent;
navigator.clipboard.writeText(text.trim());
```

### 2. 사이드바 활성 상태
```css
/* Before */
.nav-item.active {
    background: var(--hq-primary-light);
    color: var(--hq-primary);  /* #00FF00 - 가독성 낮음 */
}

/* After */
.nav-item.active {
    background: var(--hq-dark);
    color: var(--hq-primary);  /* 다크 배경에 그린 - 터미널 스타일 */
    font-weight: 600;
}
```

### 3. 코드블록 터미널 스타일
```css
.article-body pre {
    background: var(--hq-dark);
    border-radius: 8px;
    overflow: hidden;
}
.article-body pre::before {
    content: '';
    display: block;
    height: 32px;
    background: #1a1a1a;
    /* 터미널 헤더 */
}
```

---

## 영향 범위

| 파일 | 변경 |
|------|------|
| `hq/src/guide.js` | 복사 기능 수정, CSS 수정 |

---

## 검증 방법

1. 가이드 페이지 접속 (`/guide`)
2. 코드블록 Copy 버튼 클릭 → 클립보드 내용 확인
3. 사이드바 메뉴 클릭 → 활성 상태 가독성 확인
4. 모바일 반응형 확인

---

## 예상 작업량

- 복사 버튼 수정: ~10줄
- 사이드바 CSS: ~15줄
- 코드블록 스타일: ~20줄

**총: ~45줄** (소규모)
