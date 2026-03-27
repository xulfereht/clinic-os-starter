# SPEC-FIX-001 구현 계획

## 태그 추적

| 태그 | SPEC 참조 |
|------|-----------|
| SPEC-FIX-001 | [spec.md](./spec.md) |
| REQ-U-001, REQ-U-002 | Ubiquitous Requirements |
| REQ-E-001, REQ-E-002 | Event-Driven Requirements |
| REQ-S-001 | State-Driven Requirements |
| REQ-N-001, REQ-N-002 | Unwanted Behavior Requirements |

---

## 마일스톤

### Primary Goal: DSInput 컴포넌트 확장

**우선순위**: High

**작업 내용**:
1. DSInput.astro Props 인터페이스에 autocomplete prop 추가
2. preventBrowserAutocomplete boolean prop 추가
3. 방어 계층 로직 구현
4. 컴포넌트 문서화

**영향 파일**:
- `src/components/admin/design-system/DSInput.astro`

**의존성**: 없음

---

### Secondary Goal: 주요 검색 필드 적용

**우선순위**: High

**작업 내용**:
1. `/admin/staff` 검색 필드에 방어 계층 적용
2. `/admin/customers` 검색 필드에 방어 계층 적용
3. GlobalPatientSearch 컴포넌트 업데이트

**영향 파일**:
- `src/pages/admin/staff/index.astro`
- `src/pages/admin/customers/index.astro`
- `src/components/admin/common/GlobalPatientSearch.astro`

**의존성**: Primary Goal 완료

---

### Tertiary Goal: 나머지 관리자 페이지 적용

**우선순위**: Medium

**작업 내용**:
1. documents, inventory, reservations 페이지 업데이트
2. messages, payments, settings/tags 페이지 업데이트
3. campaigns/templates 페이지 업데이트

**영향 파일**:
- `src/pages/admin/documents/index.astro`
- `src/pages/admin/inventory/index.astro`
- `src/pages/admin/reservations/index.astro`
- `src/pages/admin/messages/index.astro`
- `src/pages/admin/payments/index.astro`
- `src/pages/admin/settings/tags.astro`
- `src/pages/admin/campaigns/templates.astro`

**의존성**: Secondary Goal 완료

---

### Final Goal: 검증 및 회귀 테스트

**우선순위**: High

**작업 내용**:
1. 모든 대상 브라우저에서 수동 검증
2. 로그인 페이지 autocomplete 기능 회귀 테스트
3. 접근성 검사

**의존성**: Tertiary Goal 완료

---

## 기술적 접근 방식

### DSInput 컴포넌트 확장 설계

```typescript
// Props 인터페이스 확장
interface Props {
  // ... 기존 props
  autocomplete?: string;                    // 표준 autocomplete 값
  preventBrowserAutocomplete?: boolean;     // 브라우저 자동완성 차단 플래그
}
```

### 방어 계층 구현

`preventBrowserAutocomplete=true`일 경우 다음을 자동 적용:

1. **고유 name 생성**: `name` prop이 없으면 랜덤 ID 기반 name 생성
2. **autocomplete 강제 설정**: `autocomplete="off"` 적용
3. **data 속성 추가**: `data-form-type="other"` (비밀번호 관리자 힌트)
4. **aria 속성 추가**: `aria-autocomplete="none"`
5. **readonly 트릭**: 초기 readonly + focus 시 제거

### 코드 예시

```astro
---
// DSInput.astro 확장 예시
const {
  // ... 기존 props
  autocomplete,
  preventBrowserAutocomplete = false,
} = Astro.props;

const uniqueId = `ds-input-${Math.random().toString(36).substr(2, 9)}`;
const inputName = name || (preventBrowserAutocomplete ? `search_${uniqueId}` : undefined);
const inputAutocomplete = preventBrowserAutocomplete ? 'off' : autocomplete;
---

<input
  type={type}
  name={inputName}
  autocomplete={inputAutocomplete}
  data-form-type={preventBrowserAutocomplete ? 'other' : undefined}
  aria-autocomplete={preventBrowserAutocomplete ? 'none' : undefined}
  readonly={preventBrowserAutocomplete ? true : undefined}
  onfocus={preventBrowserAutocomplete ? "this.removeAttribute('readonly')" : undefined}
  {...otherProps}
/>
```

---

## 위험 요소 및 대응

### 위험 1: 브라우저 업데이트로 인한 방어 우회

**가능성**: Medium
**영향**: High
**대응**: 다중 방어 계층 적용으로 단일 방어 실패 시에도 다른 계층이 동작

### 위험 2: 접근성 문제

**가능성**: Low
**영향**: Medium
**대응**: readonly 트릭 사용 시 스크린 리더 테스트, aria-autocomplete 적절히 설정

### 위험 3: 비밀번호 관리자 확장 프로그램 호환성

**가능성**: Medium
**영향**: Low
**대응**: data-form-type="other" 속성으로 대부분의 확장 프로그램과 호환

---

## 검증 방법

### 수동 테스트 체크리스트

- [ ] Chrome 91+에서 검색 필드 자동완성 차단 확인
- [ ] Edge 91+에서 검색 필드 자동완성 차단 확인
- [ ] Whale 브라우저에서 검색 필드 자동완성 차단 확인
- [ ] Safari 15+에서 검색 필드 자동완성 차단 확인
- [ ] Firefox 90+에서 검색 필드 자동완성 차단 확인
- [ ] 로그인 페이지(/admin/login) autocomplete 정상 동작 확인
- [ ] 회원가입/비밀번호 변경 페이지 autocomplete 정상 동작 확인
- [ ] 스크린 리더(VoiceOver/NVDA)로 접근성 확인

### 자동화 테스트 (선택적)

```typescript
// Playwright E2E 테스트 예시
test('검색 필드에서 브라우저 자동완성이 표시되지 않아야 함', async ({ page }) => {
  await page.goto('/admin/staff');
  const searchInput = page.locator('#staffSearch');

  // 입력 필드 속성 검증
  await expect(searchInput).toHaveAttribute('autocomplete', 'off');
  await expect(searchInput).toHaveAttribute('data-form-type', 'other');
  await expect(searchInput).toHaveAttribute('aria-autocomplete', 'none');
});
```

---

## 롤백 계획

변경 사항에 문제가 발생할 경우:

1. DSInput 컴포넌트의 preventBrowserAutocomplete 로직 비활성화
2. 개별 페이지의 방어 계층 속성 제거
3. 기존 `autocomplete="off"` 상태로 복원

롤백 기준:
- 로그인 페이지 autocomplete 기능 장애
- 접근성 심각한 문제 발생
- 50% 이상의 브라우저에서 방어 실패
