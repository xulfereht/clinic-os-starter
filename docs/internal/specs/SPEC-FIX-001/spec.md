# SPEC-FIX-001: 관리자 페이지 검색 입력 필드 브라우저 Autocomplete 차단

## 메타데이터

| 항목 | 값 |
|------|-----|
| SPEC ID | SPEC-FIX-001 |
| 제목 | Browser Autocomplete 차단 |
| 생성일 | 2026-02-02 |
| 상태 | Planned |
| 우선순위 | High |
| 담당 | expert-frontend |
| 도메인 | FIX |

---

## 문제 정의

### 현상
관리자 페이지(`/admin/*`)의 검색 입력 필드에서 브라우저(Chrome, Edge, Whale)가 저장된 이메일/비밀번호 자격 증명을 자동 완성하여 검색 기능을 방해한다.

### 영향 범위
- `/admin/staff` 페이지: 직원 검색 필드
- `/admin/customers` 페이지: 고객 검색 필드
- 기타 관리자 페이지의 검색 입력 필드

### 근본 원인
1. 현대 브라우저(Chrome 91+, Edge, Whale)는 보안상의 이유로 `autocomplete="off"` 속성을 의도적으로 무시함
2. DSInput 디자인 시스템 컴포넌트가 autocomplete prop을 지원하지 않음
3. 일부 페이지에서 autocomplete 속성 자체가 누락됨

---

## 요구사항 (EARS 형식)

### Ubiquitous (항상 적용)

**REQ-U-001**: 시스템은 **항상** 관리자 페이지의 모든 검색 입력 필드에서 브라우저 자동 완성을 비활성화해야 한다.

**REQ-U-002**: DSInput 컴포넌트는 **항상** autocomplete prop을 지원하여 각 인스턴스에서 자동 완성 동작을 제어할 수 있어야 한다.

### Event-Driven (이벤트 기반)

**REQ-E-001**: **WHEN** 사용자가 검색 입력 필드에 포커스할 때 **THEN** 브라우저의 자격 증명 자동 완성 드롭다운이 표시되지 않아야 한다.

**REQ-E-002**: **WHEN** 사용자가 검색 입력 필드에 텍스트를 입력할 때 **THEN** 브라우저가 저장된 이메일/비밀번호로 자동 완성하지 않아야 한다.

### State-Driven (상태 기반)

**REQ-S-001**: **IF** 입력 필드가 검색 목적으로 사용되는 경우 **THEN** 해당 필드는 브라우저 자동 완성 대상에서 제외되어야 한다.

### Unwanted Behavior (금지 사항)

**REQ-N-001**: 시스템은 검색 필드에서 브라우저 비밀번호 관리자의 자동 채우기 제안을 **표시하지 않아야 한다**.

**REQ-N-002**: 시스템은 기존 로그인/회원가입 폼의 정당한 autocomplete 기능을 **방해하지 않아야 한다**.

### Optional (선택 사항)

**REQ-O-001**: **가능하면** 통합 검색 컴포넌트를 만들어 autocomplete 차단 로직을 중앙화한다.

---

## 영향받는 파일

### 디자인 시스템 컴포넌트
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/components/admin/design-system/DSInput.astro` | 수정 | autocomplete prop 추가 |

### 관리자 페이지
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/pages/admin/staff/index.astro` | 수정 | 검색 입력에 autocomplete 차단 적용 |
| `src/pages/admin/customers/index.astro` | 수정 | autocomplete 속성 추가 및 차단 |
| `src/pages/admin/documents/index.astro` | 검토 | 기존 autocomplete="off" 대체 |
| `src/pages/admin/inventory/index.astro` | 검토 | 기존 autocomplete="off" 대체 |
| `src/pages/admin/reservations/index.astro` | 검토 | 기존 autocomplete="off" 대체 |
| `src/pages/admin/messages/index.astro` | 검토 | 기존 autocomplete="off" 대체 |
| `src/pages/admin/payments/index.astro` | 검토 | 기존 autocomplete="off" 대체 |
| `src/pages/admin/settings/tags.astro` | 검토 | 기존 autocomplete="off" 대체 |
| `src/pages/admin/campaigns/templates.astro` | 검토 | 기존 autocomplete="off" 대체 |

### 공통 컴포넌트
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/components/admin/common/GlobalPatientSearch.astro` | 검토 | 기존 autocomplete="off" 대체 |

---

## 기술적 해결 방안

### 전략 1: 근본 원인 해결 (권장)

**원인 분석**:
- 페이지 내 모달에 `type="email"` + `type="password"` 필드가 autocomplete 속성 없이 존재
- 브라우저가 해당 페이지를 "로그인 폼이 있는 페이지"로 분류
- 결과적으로 페이지 내 모든 text 필드에 자격 증명 자동완성 시도

**해결책**: 모달 내 폼 필드에 명시적 autocomplete 속성 설정

```html
<!-- 모달 폼을 form 태그로 감싸고 autocomplete="off" 설정 -->
<form autocomplete="off">
  <input type="text" name="name" autocomplete="off" />
  <input type="email" name="email" autocomplete="off" />
  <input type="password" name="password" autocomplete="new-password" />
</form>
```

### 전략 2: 검색 필드 추가 방어 (보조)

검색 필드에 추가 방어 계층 적용:

```html
<input
  type="text"
  name="search_query"
  autocomplete="off"
  data-form-type="other"           <!-- 비밀번호 관리자 힌트 -->
/>
```

### 권장 구현 순서

1. **1차**: 모달 내 email/password 필드에 autocomplete 속성 추가 (근본 원인 해결)
2. **2차**: 검색 필드에 `data-form-type="other"` 추가 (추가 방어)
3. **검증**: 모든 대상 브라우저에서 테스트

---

## 제약 사항

### 기술적 제약
- 브라우저별 동작 차이 (Chrome, Edge, Whale, Safari, Firefox)
- 비밀번호 관리자 확장 프로그램(1Password, LastPass 등)과의 호환성
- 접근성(a11y) 표준 준수 필요

### 비즈니스 제약
- 기존 로그인/회원가입 폼의 정당한 autocomplete 기능 유지
- 사용자 경험 저하 최소화

---

## 성공 기준

| 기준 | 목표 |
|------|------|
| 브라우저 호환성 | Chrome 91+, Edge 91+, Whale, Safari 15+, Firefox 90+ |
| 기능 검증 | 모든 대상 검색 필드에서 자격 증명 자동 완성 차단 |
| 회귀 테스트 | 로그인 페이지의 autocomplete 기능 정상 동작 |
| 접근성 | WCAG 2.1 AA 준수 |

---

## 참조

- [Chrome autocomplete behavior](https://developer.chrome.com/blog/autocomplete/)
- [MDN autocomplete attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete)
- [WCAG 1.3.5 Identify Input Purpose](https://www.w3.org/WAI/WCAG21/Understanding/identify-input-purpose.html)
