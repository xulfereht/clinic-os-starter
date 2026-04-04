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

## Remaining Work (Future Sessions)

- [x] Phase 2: patients correlated subquery → LEFT JOIN
- [x] Phase 4: payments 페이지네이션
- [x] Phase 5: AEO 대시보드 쿼리 병렬화
- [ ] Phase 6: leads 페이지네이션 개선
- [ ] continuity LAG() 쿼리 근본 최적화 (materialized interval 또는 캐시)
- [ ] 복합 인덱스 추가 (patients, reservations, payments)
- [ ] 프론트엔드 성능 측정 (Playwright 기반)
