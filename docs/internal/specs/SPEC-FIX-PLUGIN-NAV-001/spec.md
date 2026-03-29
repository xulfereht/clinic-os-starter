---
id: SPEC-FIX-PLUGIN-NAV-001
version: 1.0.0
status: approved
created: 2026-02-11
updated: 2026-02-11
author: MoAI
priority: high
lifecycle_level: spec-first
---

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 2026-02-11 | 1.0.0 | 초기 SPEC 작성 | MoAI |

---

# SPEC-FIX-PLUGIN-NAV-001: 플러그인 내비게이션 링크 전면 수정

## 1. 환경 (Environment)

### 1.1 프로젝트 개요

- **프로젝트**: Clinic OS (Astro 기반 SaaS 플랫폼)
- **영향 범위**: 플러그인 시스템 전체 페이지 내비게이션
- **기술 스택**: Astro, TypeScript, Tailwind CSS

### 1.2 현재 페이지 아키텍처

| 경로 | 파일 | 역할 |
|------|------|------|
| `/admin/plugins` | `index.astro` | 플러그인 관리 대시보드 |
| `/admin/plugins/store` | `store.astro` | 플러그인 마켓플레이스 |
| `/admin/plugins/developer` | `developer.astro` | 개발자 포털 |
| `/admin/plugins/review` | `review.astro` | 관리자 리뷰 큐 |
| `/admin/plugins/updates` | `updates.astro` | 업데이트 관리 |
| `/admin/plugins/violations` | `violations.astro` | 보안 위반 관리 |
| `/admin/plugins/analytics` | `analytics.astro` | 분석 대시보드 |
| `/admin/hub/[...path]` | `[...path].astro` | 플러그인 상세/문서 뷰어 |
| `/admin/plugins/run/[...path]` | `[...path].astro` | 레거시 플러그인 실행기 (플레이스홀더) |
| `/ext/[...path]` | `[...path].astro` | 퍼블릭 플러그인 페이지 |

### 1.3 문제 요약

플러그인 시스템 내 다수의 페이지 간 내비게이션 링크가 존재하지 않는 경로를 참조하거나, 뒤로 가기 링크가 누락되어 사용자가 페이지 간 이동 시 404 오류에 빈번히 노출되고 있다.

---

## 2. 가정 (Assumptions)

- A1: `/admin/hub/[...path].astro`가 플러그인 상세/문서 뷰어의 정식 경로이며, 별도의 store detail 페이지 생성은 불필요하다.
- A2: `/admin/plugins/run/[...path].astro`는 레거시 경로로, hub 경로로 대체 가능하다.
- A3: 플러그인 리뷰 API(`POST /api/plugins/review`)는 아직 구현되지 않았으며, HQ API로의 전환이 필요하다.
- A4: 개발자 제출 페이지(`/admin/plugins/developer/submit`)는 별도 구현 대신 HQ 페이지로의 리다이렉트가 적절하다.
- A5: 모든 내비게이션 변경은 기존 사용자 워크플로우를 파괴하지 않아야 한다.

---

## 3. 요구사항 (Requirements)

### REQ-001: 스토어 상세 링크 수정 [CRITICAL]

**WHEN** 사용자가 스토어 페이지에서 플러그인 카드를 클릭 **THEN** 시스템은 `/admin/hub/${pluginId}` 경로로 이동해야 한다.

- 현재 상태: `/admin/plugins/store/${plugin.id}` (존재하지 않는 경로)
- 대상 파일: `src/pages/admin/plugins/store.astro`
- 수정 방향: 링크 href를 `/admin/hub/${pluginId}`로 변경

### REQ-002: 스토어 뒤로가기 내비게이션 추가 [HIGH]

시스템은 **항상** 스토어 페이지 상단에 `/admin/plugins`로 돌아가는 브레드크럼 또는 뒤로가기 링크를 표시해야 한다.

- 대상 파일: `src/pages/admin/plugins/store.astro`
- 수정 방향: 페이지 상단에 "플러그인 관리" 뒤로가기 링크 추가

### REQ-003: 허브 뒤로가기 링크 수정 [HIGH]

**WHEN** 사용자가 허브 상세 페이지에서 "기능 허브" 뒤로가기 링크를 클릭 **THEN** 시스템은 `/admin/plugins` (플러그인 관리 페이지)로 이동해야 한다.

- 현재 상태: `/admin/hub` (레거시 인덱스 페이지, 존재 여부 불확실)
- 대상 파일: `src/pages/admin/hub/[...path].astro` (line 112 부근)
- 수정 방향: href를 `/admin/plugins`로 변경

### REQ-004: 리뷰 페이지 API 엔드포인트 처리 [MEDIUM]

**WHEN** 관리자가 리뷰 페이지에서 플러그인을 승인/거부 **THEN** 시스템은 유효한 API 엔드포인트로 요청을 전송해야 한다.

- 현재 상태: `POST /api/plugins/review` (존재하지 않는 엔드포인트)
- 대상 파일: `src/pages/admin/plugins/review.astro` (line 806 부근)
- 수정 방향: HQ API 호출로 전환하거나 해당 API 엔드포인트 생성

### REQ-005: 개발자 제출 링크 수정 [MEDIUM]

**WHEN** 개발자가 개발자 포털에서 "플러그인 제출" 버튼을 클릭 **THEN** 시스템은 유효한 제출 페이지로 이동해야 한다.

- 현재 상태: `/admin/plugins/developer/submit` (존재하지 않는 경로)
- 대상 파일: `src/pages/admin/plugins/developer.astro` (line 162 부근)
- 수정 방향: HQ 제출 페이지로 리다이렉트 또는 `/admin/plugins/developer` 내 모달/인라인 폼으로 전환

### REQ-006: 레거시 run 경로 디프리케이션 [LOW]

**IF** 사용자가 `/admin/plugins/run/${pluginId}` 경로에 접근 **THEN** 시스템은 `/admin/hub/${pluginId}`로 리다이렉트해야 한다.

- 현재 상태: 플레이스홀더 텍스트만 표시
- 대상 파일: `src/pages/admin/plugins/run/[...path].astro`
- 수정 방향: hub 경로로 301 리다이렉트 추가

### REQ-007: 스토어 설치 후 내비게이션 흐름 추가 [HIGH]

**WHEN** 사용자가 스토어에서 플러그인 설치를 완료 **THEN** 시스템은 `/admin/hub/${pluginId}`로 이동할 수 있는 링크를 표시해야 한다.

- 대상 파일: `src/pages/admin/plugins/store.astro`
- 수정 방향: 설치 성공 후 "허브에서 보기" 링크/버튼 표시

### REQ-008: 내비게이션 일관성 [UBIQUITOUS]

시스템은 **항상** 모든 플러그인 관련 페이지에서 유효한 링크만 렌더링해야 한다. 존재하지 않는 경로를 참조하는 링크는 **존재하지 않아야 한다**.

---

## 4. 명세 (Specifications)

### 4.1 링크 매핑 테이블

| 현재 링크 | 수정 후 링크 | 대상 파일 |
|-----------|-------------|-----------|
| `/admin/plugins/store/${plugin.id}` | `/admin/hub/${pluginId}` | store.astro |
| (없음 - 뒤로가기) | `/admin/plugins` | store.astro |
| `/admin/hub` | `/admin/plugins` | hub/[...path].astro |
| `POST /api/plugins/review` | HQ API 또는 신규 엔드포인트 | review.astro |
| `/admin/plugins/developer/submit` | HQ 리다이렉트 또는 인라인 폼 | developer.astro |
| (플레이스홀더) | 301 -> `/admin/hub/${pluginId}` | run/[...path].astro |
| (없음 - 설치 후) | `/admin/hub/${pluginId}` 링크 표시 | store.astro |

### 4.2 수정 대상 파일 목록

1. `src/pages/admin/plugins/store.astro` - REQ-001, REQ-002, REQ-007
2. `src/pages/admin/hub/[...path].astro` - REQ-003
3. `src/pages/admin/plugins/review.astro` - REQ-004
4. `src/pages/admin/plugins/developer.astro` - REQ-005
5. `src/pages/admin/plugins/run/[...path].astro` - REQ-006
6. (조건부) `src/pages/api/plugins/review.ts` - REQ-004 (신규 생성 시)

### 4.3 제약사항

- C1: Astro SSR/SSG 빌드 호환성을 유지해야 한다.
- C2: 기존 플러그인 설치/관리 기능에 영향을 주지 않아야 한다.
- C3: HQ API 의존성이 있는 경우, HQ 서버 가용성을 고려한 에러 처리가 필요하다.
- C4: 모든 링크 변경은 접근성(a11y) 표준을 준수해야 한다.

### 4.4 추적성 태그

- [SPEC-FIX-PLUGIN-NAV-001:REQ-001] -> store.astro 플러그인 카드 링크
- [SPEC-FIX-PLUGIN-NAV-001:REQ-002] -> store.astro 뒤로가기 내비게이션
- [SPEC-FIX-PLUGIN-NAV-001:REQ-003] -> hub/[...path].astro 뒤로가기 링크
- [SPEC-FIX-PLUGIN-NAV-001:REQ-004] -> review.astro API 엔드포인트
- [SPEC-FIX-PLUGIN-NAV-001:REQ-005] -> developer.astro 제출 링크
- [SPEC-FIX-PLUGIN-NAV-001:REQ-006] -> run/[...path].astro 리다이렉트
- [SPEC-FIX-PLUGIN-NAV-001:REQ-007] -> store.astro 설치 후 내비게이션
- [SPEC-FIX-PLUGIN-NAV-001:REQ-008] -> 전체 플러그인 페이지 링크 유효성
