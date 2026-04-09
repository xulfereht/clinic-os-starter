# Admin Performance Optimization Report

> Created: 2026-04-04
> Mission: Admin 성능 최적화 (Phase 1-5)
> Test data: 20,000 patients + 70K reservations + 40K payments + 6K leads

## Summary

Analytics API 6종 + AnalyticsService + AEO 대시보드를 `Promise.all()` 병렬화.
patients 페이지 correlated subquery → LEFT JOIN 전환. payments 페이지네이션 추가.
로컬 SQLite에서는 병렬 효과가 제한적이나 (단일 파일 I/O), Cloudflare D1 리모트에서는 네트워크 라운드트립이 병렬화되어 실질적 개선 기대.

## Measurement Results (Local D1, 20K patients)

### Before (순차 실행)

| API | TTFB (ms) | Queries | Pattern |
|-----|-----------|---------|---------|
| journey | 75 | 10 sequential | JOINs + NOT EXISTS |
| flow | 105 | 8 sequential | JOINs + COUNT DISTINCT |
| funnel | 39 | 4 sequential | Simple COUNT |
| details | 25 | 8-10 sequential | Paginated |
| channel-explorer | 67 | 2 + N+1 | Subqueries per row |
| doctor-perf | 22 | 1 | Window function |
| continuity | 122 | 2 sequential | LAG() full table scan |
| leakage | 167 | 4 sequential | GROUP BY + stale check |

### After (Promise.all 병렬화)

| API | Before | After | Change | Note |
|-----|--------|-------|--------|------|
| journey | 75ms | 62ms | -17% | 10 queries → 1 Promise.all |
| flow | 105ms | 93ms | -11% | 8 queries → 1 Promise.all |
| funnel | 39ms | 23ms | -41% | Already fast |
| details | 25ms | 17ms | -32% | Paginated, less benefit |
| channel-explorer | 67ms | 46ms | -31% | |
| doctor-perf | 22ms | 8ms | -64% | Single query, variance |
| continuity | 122ms | 146ms | +20% | LAG() still heavy; added patient scope |
| leakage | 167ms | 167ms | 0% | 4 queries parallel, but SQLite single-thread |

### Expected Remote D1 Improvement

Cloudflare D1 remote adds ~20-50ms per query roundtrip.

| API | Before (est.) | After (est.) | Improvement |
|-----|--------------|-------------|-------------|
| journey (10 queries) | 75 + 10×30 = **375ms** | 62 + 30 = **92ms** | **75% faster** |
| flow (8 queries) | 105 + 8×30 = **345ms** | 93 + 30 = **123ms** | **64% faster** |
| leakage (4 queries) | 167 + 4×30 = **287ms** | 167 + 30 = **197ms** | **31% faster** |
| service.getDashboardStats (12 queries) | 200 + 12×30 = **560ms** | 200 + 30 = **230ms** | **59% faster** |

## Changes Made

### Files Modified

| File | Change |
|------|--------|
| `src/pages/api/analytics/journey.ts` | 10 sequential → 1 Promise.all |
| `src/pages/api/analytics/flow.ts` | 8 sequential → 1 Promise.all |
| `src/pages/api/analytics/continuity.ts` | 2 queries parallel + LAG scoped to active patients |
| `src/pages/api/analytics/leakage.ts` | 4 queries → 1 Promise.all |
| `src/lib/analytics/service.ts` | getDashboardStats: 12 sequential → 1 Promise.all |
| `src/pages/admin/patients/index.astro` | 6 correlated subqueries → 4 LEFT JOINs + count/stats parallel |
| `src/pages/admin/payments/index.astro` | LIMIT 200 → offset pagination (30/page) + count/stats parallel |
| `src/pages/admin/aeo/index.astro` | 7 Promise.all blocks (PRAGMA, metadata, links, verification, bot traffic, FAQ, trends) |

### Test Infrastructure Created

| File | Purpose |
|------|---------|
| `scripts/generate-perf-test-data.cjs` | 대량 데이터 생성기 (is_sample=1 격리) |
| `scripts/perf-measure.cjs` | 페이지/API 자동 측정 (TTFB, total, size) |
| `.gitignore` | `.perf-test/` 제외 추가 |

## Completed (v1.36.1~v1.36.3)

### 백엔드 쿼리 병렬화 (20+ 파일)
- [x] Analytics API 6종 (journey, flow, continuity, leakage, operations, channels)
- [x] AnalyticsService.getDashboardStats (12→1 Promise.all)
- [x] Dashboard radiator API (10 순차 → 2 batch Promise.all) — **대시보드 진입 속도 근본 원인**
- [x] CRM overview API (7→1 Promise.all)
- [x] patients/index: 6 correlated subquery → 4 LEFT JOIN + parallel count/stats
- [x] patients/[id]: 18 순차 → 2 Promise.all (11+7)
- [x] payments: LIMIT 200 → offset 페이지네이션 (30/page)
- [x] leads: 9 순차 → 1 Promise.all
- [x] tasks: 5 → 1 Promise.all
- [x] settings/schedule: 6 → 1 Promise.all
- [x] AEO: 20+ 쿼리 → 8 Promise.all 블록 + 3탭 분할
- [x] 복합 인덱스 13개 추가 (migration 0939)

### 프론트엔드 최적화
- [x] analytics: fetchData + fetchDoctorPerformance → Promise.all
- [x] AEO 탭 분할 (overview/content/traffic) — 초기 쿼리 20+ → 7개
- [x] phone-utils.js: is:inline 제거 → defer (매 페이지 인라인 제거)
- [x] Chat polling: 5초 → 30초 (12 req/min → 2 req/min)
- [x] Pretendard: render-blocking → preload+swap
- [x] Notification console.log 4개 제거
- [x] Toast UI Editor: CDN latest → vendored local (reviews, notices)
- [x] ApexCharts: unversioned CDN → pinned v3.54.1

## Remaining Work (별도 미션 필요)

### 🔴 환자 상세 페이지 분할 (patients/[id].astro)

**현황:**
- SSR 모듈: **671KB** (전체 admin 중 최대)
- HTML 출력: **~650KB** (prod 추정, 30,000줄)
- 탭 10개 + 모달 10+개가 한 번에 SSR
- DB 쿼리 18개는 이미 병렬화 완료 → 추가 쿼리 개선 여지 없음
- Workers cold start ~2초 (모듈 크기 때문)

**구조적 원인:**
- `[id].astro` 단일 파일에 모든 탭 콘텐츠가 포함
- 탭(timeline, messages, prescription, inquiry, payment, info, survey, tests, visit, images)이 전부 서버에서 렌더링
- 모달(SMS, 예약, 결제, 환불, 이벤트, 검사, 공유 등) HTML도 항상 포함
- survey JSON blob(SURVEY_LIBRARY, PANEL_QUESTIONS, symptomItems 등)이 매 요청마다 인라인

**개선 방향 (택1):**
1. **탭별 lazy SSR** — URL param `?tab=timeline` 방식 (AEO 패턴). 간단하지만 탭 전환 시 full reload
2. **API 기반 탭 전환** — 각 탭 데이터를 API로 분리, 클라이언트에서 fetch. 빠르지만 리팩토링 규모 큼
3. **모달 lazy render** — 모달 HTML을 초기에 빈 껍데기만 두고, 버튼 클릭 시 fetch로 로드. 중간 난이도
4. **Survey JSON lazy load** — `/api/admin/survey-meta` 엔드포인트 생성, 탭 클릭 시 fetch

**추천:** 방향 1 (탭별 lazy SSR) + 방향 4 (survey lazy load) 조합. AEO에서 검증된 패턴이고, UI 변경 최소.

### 🟡 웹분석 쿼리 구조 개선

**현황:**
- getDashboardStats 내부 12개 쿼리 이미 병렬화 완료
- 느린 원인: `page_views` 테이블의 날짜 함수 연산 (`date(datetime(created_at, '+9 hours'))`)
- `COUNT(DISTINCT ip_hash)` + 새 방문자 서브쿼리 (이중 스캔)

**개선 방향:**
- 날짜 인덱스 최적화 — KST 변환 없이 UTC 기반으로 쿼리 재작성
- 새 방문자 서브쿼리 단순화 — approximate count 허용 시 성능 대폭 개선
- page_views에 `date_kst TEXT` 컬럼 추가 (pre-computed) — INSERT 시 계산

### 🟡 radiator 파이프라인 REPLACE() 제거

**현황:**
- `REPLACE(l.contact, '-', '') = REPLACE(p.current_phone, '-', '')` — 모든 행에 문자열 함수 실행
- 인덱스 무력화, 2만 건에서 매우 느림

**개선 방향:**
- leads 테이블에 `normalized_contact` 컬럼 추가 (INSERT/UPDATE 트리거로 `-` 제거)
- JOIN을 `patient_id` FK만 사용하도록 단순화 (정확도 트레이드오프)

### 🟢 AdminLayout 인라인 스크립트 분리

- 알림 시스템 ~300줄, 사이드바 ~100줄이 매 페이지 인라인
- 외부 JS 파일로 분리하면 브라우저 캐싱 가능
- 영향: 미미 (두 번째 로드부터 캐싱)
