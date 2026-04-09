---
id: SPEC-FIX-PLUGIN-NAV-001
document: plan
version: 1.0.0
created: 2026-02-11
updated: 2026-02-11
---

# SPEC-FIX-PLUGIN-NAV-001: 구현 계획

## 1. 작업 분해 (Task Decomposition)

### Task 1: 스토어 상세 링크 수정 [CRITICAL]
- **REQ**: REQ-001
- **우선순위**: Primary Goal
- **대상 파일**: `src/pages/admin/plugins/store.astro`
- **작업 내용**:
  - 플러그인 카드의 href를 `/admin/plugins/store/${plugin.id}`에서 `/admin/hub/${pluginId}`로 변경
  - pluginId 변수가 올바르게 참조되는지 확인
- **예상 변경**: 1 파일, 1-3줄
- **의존성**: 없음

### Task 2: 스토어 뒤로가기 내비게이션 추가 [HIGH]
- **REQ**: REQ-002
- **우선순위**: Primary Goal
- **대상 파일**: `src/pages/admin/plugins/store.astro`
- **작업 내용**:
  - 페이지 상단 영역에 `/admin/plugins`로 돌아가는 브레드크럼 링크 추가
  - 기존 페이지 레이아웃 스타일과 일관성 유지
- **예상 변경**: 1 파일, 5-10줄
- **의존성**: 없음

### Task 3: 허브 뒤로가기 링크 수정 [HIGH]
- **REQ**: REQ-003
- **우선순위**: Primary Goal
- **대상 파일**: `src/pages/admin/hub/[...path].astro`
- **작업 내용**:
  - line 112 부근의 "기능 허브" 링크 href를 `/admin/hub`에서 `/admin/plugins`로 변경
- **예상 변경**: 1 파일, 1줄
- **의존성**: 없음

### Task 4: 스토어 설치 후 내비게이션 흐름 [HIGH]
- **REQ**: REQ-007
- **우선순위**: Primary Goal
- **대상 파일**: `src/pages/admin/plugins/store.astro`
- **작업 내용**:
  - 플러그인 설치 성공 콜백/핸들러에서 "허브에서 보기" 링크 또는 버튼 렌더링
  - 링크 대상: `/admin/hub/${pluginId}`
  - 설치 실패 시에는 표시하지 않음
- **예상 변경**: 1 파일, 10-20줄
- **의존성**: Task 1 (store.astro 수정과 병행)

### Task 5: 리뷰 페이지 API 엔드포인트 처리 [MEDIUM]
- **REQ**: REQ-004
- **우선순위**: Secondary Goal
- **대상 파일**:
  - `src/pages/admin/plugins/review.astro` (API 호출 부분)
  - (조건부) `src/pages/api/plugins/review.ts` (신규 엔드포인트 생성 시)
- **작업 내용**:
  - 옵션 A: HQ API 엔드포인트로 호출 경로 변경
  - 옵션 B: `src/pages/api/plugins/review.ts` 엔드포인트 신규 생성
  - 두 옵션 모두 적절한 에러 처리 포함
- **예상 변경**: 1-2 파일, 10-50줄 (옵션에 따라 상이)
- **의존성**: HQ API 엔드포인트 존재 여부 확인 필요

### Task 6: 개발자 제출 링크 수정 [MEDIUM]
- **REQ**: REQ-005
- **우선순위**: Secondary Goal
- **대상 파일**: `src/pages/admin/plugins/developer.astro`
- **작업 내용**:
  - 옵션 A: HQ 제출 페이지 URL로 리다이렉트
  - 옵션 B: developer 페이지 내 모달 또는 인라인 제출 폼 구현
  - 현재 기존의 submit API (`/api/plugins/submit`)와의 관계 확인
- **예상 변경**: 1 파일, 5-20줄
- **의존성**: Task 5와 유사한 HQ API 확인 필요

### Task 7: 레거시 run 경로 리다이렉트 [LOW]
- **REQ**: REQ-006
- **우선순위**: Optional Goal
- **대상 파일**: `src/pages/admin/plugins/run/[...path].astro`
- **작업 내용**:
  - 현재 플레이스홀더 콘텐츠를 Astro 리다이렉트 로직으로 교체
  - path 파라미터에서 pluginId를 추출하여 `/admin/hub/${pluginId}`로 301 리다이렉트
- **예상 변경**: 1 파일, 5-15줄
- **의존성**: 없음

---

## 2. 실행 순서

### Phase 1: Critical/High 수정 (Primary Goal)
1. Task 1 + Task 2 + Task 4 (store.astro - 동일 파일이므로 일괄 수정)
2. Task 3 (hub/[...path].astro)

### Phase 2: Medium 수정 (Secondary Goal)
3. Task 5 (review.astro API 엔드포인트)
4. Task 6 (developer.astro 제출 링크)

### Phase 3: Low 수정 (Optional Goal)
5. Task 7 (run/[...path].astro 리다이렉트)

### Phase 4: 전체 검증
6. 전체 내비게이션 흐름 수동 검증
7. 빌드 테스트 (`npm run build` 또는 `astro build`)

---

## 3. 기술 접근 방식

### 3.1 링크 수정 전략

- Astro 페이지 내 `<a>` 태그 및 JavaScript `window.location` 기반 내비게이션 모두 검사
- 하드코딩된 경로를 상수 또는 유틸리티 함수로 추출하는 것은 이 SPEC 범위 밖 (향후 리팩토링 대상)

### 3.2 API 엔드포인트 전략

- 기존 HQ API 구조를 먼저 확인 (`/api/plugins/submit.ts` 등 참조)
- HQ API 패턴과 일치하도록 review 엔드포인트 구현 또는 프록시 설정
- 적절한 에러 응답 코드와 메시지 포함

### 3.3 리다이렉트 전략

- Astro의 서버사이드 리다이렉트 기능 활용 (`Astro.redirect()`)
- 301 (Permanent Redirect) 사용으로 검색엔진 및 브라우저 캐시 활용

### 3.4 브레드크럼/뒤로가기 UI 전략

- 기존 플러그인 페이지들의 UI 패턴을 참조하여 일관된 스타일 적용
- 접근성을 고려한 `aria-label` 속성 포함

---

## 4. 리스크 분석

### Risk 1: HQ API 엔드포인트 부재
- **확률**: Medium
- **영향**: Task 5, Task 6 진행 차단
- **완화**: 먼저 HQ API 구조를 확인하고, 부재 시 프록시 엔드포인트 생성

### Risk 2: store.astro 복잡한 설치 흐름
- **확률**: Low
- **영향**: Task 4 구현 복잡도 증가
- **완화**: 기존 설치 성공 콜백 구조를 먼저 파악하여 최소 침습적 변경

### Risk 3: run 경로에 대한 외부 참조
- **확률**: Low
- **영향**: 레거시 북마크/링크가 동작하지 않을 수 있음
- **완화**: 301 리다이렉트로 기존 참조를 자동 전환

### Risk 4: Astro 빌드 호환성
- **확률**: Low
- **영향**: 빌드 실패
- **완화**: 각 Task 완료 후 빌드 테스트 수행

---

## 5. 추적성 태그

- [SPEC-FIX-PLUGIN-NAV-001:PLAN:T1] -> Task 1: store 상세 링크
- [SPEC-FIX-PLUGIN-NAV-001:PLAN:T2] -> Task 2: store 뒤로가기
- [SPEC-FIX-PLUGIN-NAV-001:PLAN:T3] -> Task 3: hub 뒤로가기
- [SPEC-FIX-PLUGIN-NAV-001:PLAN:T4] -> Task 4: 설치 후 내비게이션
- [SPEC-FIX-PLUGIN-NAV-001:PLAN:T5] -> Task 5: review API
- [SPEC-FIX-PLUGIN-NAV-001:PLAN:T6] -> Task 6: developer 제출
- [SPEC-FIX-PLUGIN-NAV-001:PLAN:T7] -> Task 7: run 리다이렉트
