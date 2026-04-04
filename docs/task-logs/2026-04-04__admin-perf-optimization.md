# Task Log: Admin 성능 최적화

> task: Admin 성능 최적화
> bu: SAAS
> mission: Admin 성능 최적화
> status: active
> workspaces: [clinic-os]
> created: 2026-04-04

## Progress

### 2026-04-04 Session 1: 분석 + 미션 수립

**병목 분석 완료:**
- patients: correlated subquery 6개/페이지 (60+ DB 호출)
- Analytics API 6종: 순차 쿼리 (Promise.all 없음), journey 13개, flow 9개, details 8~10개
- payments: LIMIT 200 하드코딩, 페이지네이션 없음
- AEO: 128KB 단일 파일, 10+개 순차 쿼리
- leads: 부분 페이지네이션 (모달당 20건)
- customers: 미사용 레거시 확인 (사이드바 미노출, 참조 없음)

**Phase 1 완료: 테스트 인프라**
- `scripts/generate-perf-test-data.cjs` — 20K 환자 + 관련 테이블 29만행 생성
- `scripts/perf-measure.cjs` — API/페이지 자동 TTFB 측정
- baseline 측정 완료 (80건 vs 20K건)

**Phase 3 완료: Analytics API 병렬화**
- journey.ts: 10 sequential → Promise.all (리모트 예상 75% 개선)
- flow.ts: 8 sequential → Promise.all (리모트 예상 64% 개선)
- leakage.ts: 4 sequential → Promise.all
- continuity.ts: 2 queries parallel + LAG scope 제한
- service.ts getDashboardStats: 12 sequential → Promise.all (리모트 예상 59% 개선)
- 빌드 검증 통과

**다음 세션:**
- Phase 2: patients correlated subquery → LEFT JOIN
- Phase 4: payments 페이지네이션
- Phase 5: AEO 대시보드 병렬화
- 프론트엔드 성능 측정 + 최적화
