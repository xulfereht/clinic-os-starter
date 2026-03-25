# SPEC-FIX-001 인수 조건

## 태그 추적

| 태그 | SPEC 참조 |
|------|-----------|
| SPEC-FIX-001 | [spec.md](./spec.md) |
| AC-001 ~ AC-010 | 인수 조건 |

---

## 인수 조건 (Given-When-Then 형식)

### AC-001: 직원 검색 필드 자동완성 차단

**REQ 참조**: REQ-E-001, REQ-N-001

```gherkin
Given 관리자가 Chrome, Edge 또는 Whale 브라우저를 사용하고
  And 브라우저에 이메일/비밀번호 자격 증명이 저장되어 있고
  And /admin/staff 페이지에 접속해 있을 때
When 관리자가 직원 검색 입력 필드를 클릭하면
Then 브라우저의 자격 증명 자동완성 드롭다운이 표시되지 않아야 한다
  And 검색 입력 필드는 비어있는 상태를 유지해야 한다
```

---

### AC-002: 고객 검색 필드 자동완성 차단

**REQ 참조**: REQ-E-001, REQ-N-001

```gherkin
Given 관리자가 Chrome, Edge 또는 Whale 브라우저를 사용하고
  And 브라우저에 이메일/비밀번호 자격 증명이 저장되어 있고
  And /admin/customers 페이지에 접속해 있을 때
When 관리자가 고객 검색 입력 필드를 클릭하면
Then 브라우저의 자격 증명 자동완성 드롭다운이 표시되지 않아야 한다
  And 검색 입력 필드는 비어있는 상태를 유지해야 한다
```

---

### AC-003: 검색 입력 시 자동완성 방지

**REQ 참조**: REQ-E-002

```gherkin
Given 관리자가 /admin/staff 페이지의 검색 필드에 포커스하고 있을 때
When 관리자가 "홍"을 입력하면
Then 입력 필드에는 "홍"만 표시되어야 한다
  And 브라우저가 저장된 이메일 주소로 자동완성하지 않아야 한다
  And 검색 결과가 "홍"으로 시작하는 직원으로 필터링되어야 한다
```

---

### AC-004: DSInput 컴포넌트 autocomplete prop 지원

**REQ 참조**: REQ-U-002

```gherkin
Given DSInput 컴포넌트가 사용되는 페이지가 있을 때
When 개발자가 DSInput에 autocomplete="email" prop을 전달하면
Then 렌더링된 input 요소에 autocomplete="email" 속성이 포함되어야 한다

Given DSInput 컴포넌트가 사용되는 페이지가 있을 때
When 개발자가 DSInput에 preventBrowserAutocomplete={true} prop을 전달하면
Then 렌더링된 input 요소에 다음 속성들이 포함되어야 한다:
  | 속성 | 값 |
  | autocomplete | off |
  | data-form-type | other |
  | aria-autocomplete | none |
```

---

### AC-005: 로그인 페이지 autocomplete 기능 유지

**REQ 참조**: REQ-N-002

```gherkin
Given 사용자가 /admin/login 페이지에 접속해 있고
  And 브라우저에 이전 로그인 자격 증명이 저장되어 있을 때
When 사용자가 이메일 입력 필드를 클릭하면
Then 브라우저의 저장된 이메일 자동완성이 정상적으로 제안되어야 한다

When 사용자가 비밀번호 입력 필드를 클릭하면
Then 브라우저의 저장된 비밀번호 자동완성이 정상적으로 제안되어야 한다
```

---

### AC-006: 비밀번호 변경 페이지 autocomplete 기능 유지

**REQ 참조**: REQ-N-002

```gherkin
Given 관리자가 /admin/change-password 페이지에 접속해 있을 때
When 관리자가 현재 비밀번호 필드를 클릭하면
Then 브라우저의 autocomplete="current-password" 기능이 정상 동작해야 한다

When 관리자가 새 비밀번호 필드를 클릭하면
Then 브라우저의 autocomplete="new-password" 기능이 정상 동작해야 한다
```

---

### AC-007: GlobalPatientSearch 자동완성 차단

**REQ 참조**: REQ-U-001

```gherkin
Given 관리자가 GlobalPatientSearch 컴포넌트가 있는 페이지에 접속해 있고
  And 브라우저에 이메일/비밀번호 자격 증명이 저장되어 있을 때
When 관리자가 환자 검색 입력 필드를 클릭하면
Then 브라우저의 자격 증명 자동완성 드롭다운이 표시되지 않아야 한다
```

---

### AC-008: 다중 브라우저 호환성

**REQ 참조**: REQ-U-001

```gherkin
Given 다음 브라우저 중 하나를 사용하는 관리자가 있을 때:
  | 브라우저 | 최소 버전 |
  | Chrome | 91 |
  | Edge | 91 |
  | Whale | 최신 |
  | Safari | 15 |
  | Firefox | 90 |
  And /admin/staff 페이지에 접속해 있을 때
When 관리자가 검색 입력 필드를 클릭하면
Then 해당 브라우저에서 자격 증명 자동완성이 차단되어야 한다
```

---

### AC-009: 접근성 준수

**REQ 참조**: REQ-U-001

```gherkin
Given 스크린 리더(VoiceOver 또는 NVDA)를 사용하는 관리자가 있을 때
  And /admin/staff 페이지에 접속해 있을 때
When 스크린 리더가 검색 입력 필드를 읽을 때
Then 스크린 리더가 해당 필드의 용도를 올바르게 안내해야 한다
  And readonly 속성으로 인한 "읽기 전용" 알림이 발생하지 않아야 한다
  (focus 시 readonly가 제거되므로)
```

---

### AC-010: 검색 기능 정상 동작

**REQ 참조**: REQ-S-001

```gherkin
Given 관리자가 /admin/staff 페이지의 검색 필드에 있을 때
When 관리자가 "개발팀"을 입력하면
Then 부서가 "개발팀"인 직원 목록이 필터링되어 표시되어야 한다
  And 검색 기능이 자동완성 차단 로직과 충돌 없이 정상 동작해야 한다
```

---

## Quality Gate 체크리스트

### 기능 검증
- [ ] AC-001: 직원 검색 필드 자동완성 차단 통과
- [ ] AC-002: 고객 검색 필드 자동완성 차단 통과
- [ ] AC-003: 검색 입력 시 자동완성 방지 통과
- [ ] AC-004: DSInput autocomplete prop 지원 통과
- [ ] AC-005: 로그인 페이지 autocomplete 유지 통과
- [ ] AC-006: 비밀번호 변경 페이지 autocomplete 유지 통과
- [ ] AC-007: GlobalPatientSearch 자동완성 차단 통과
- [ ] AC-010: 검색 기능 정상 동작 통과

### 호환성 검증
- [ ] AC-008: Chrome 91+ 호환성 통과
- [ ] AC-008: Edge 91+ 호환성 통과
- [ ] AC-008: Whale 호환성 통과
- [ ] AC-008: Safari 15+ 호환성 통과
- [ ] AC-008: Firefox 90+ 호환성 통과

### 접근성 검증
- [ ] AC-009: VoiceOver 접근성 통과
- [ ] AC-009: NVDA 접근성 통과
- [ ] WCAG 2.1 AA 준수 확인

### 회귀 테스트
- [ ] 로그인 페이지 autocomplete 정상 동작
- [ ] 비밀번호 변경 페이지 autocomplete 정상 동작
- [ ] 직원 등록 페이지 autocomplete 정상 동작

---

## Definition of Done

1. 모든 인수 조건(AC-001 ~ AC-010) 통과
2. 5개 대상 브라우저 모두에서 검증 완료
3. 로그인/비밀번호 관련 페이지 회귀 테스트 통과
4. 접근성(a11y) 검사 통과
5. 코드 리뷰 승인
6. main 브랜치 머지 완료
