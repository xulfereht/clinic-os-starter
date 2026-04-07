# AEO Port PR Summary

## Branch

- base: `origin/main`
- head: `port/aeo-from-baekrokdam-20260312`

## PR Link

- https://github.com/xulfereht/clinic-os/pull/new/port/aeo-from-baekrokdam-20260312

## Recommended Title

`feat(aeo): port verified AEO generalization from baekrokdam`

## Summary

백록담 설치본에서 먼저 검증한 AEO 일반화 작업 중 공용 코어에 반영 가능한 부분만 `clinic-os`로 포트했다.

이번 포트에는 다음이 포함된다.

- AEO 메타데이터 저장 및 백필 구조
- 관련 링크 인덱스와 관리자 재생성 진입점
- `clinic.ts` 기반 공개 URL/클리닉 정보 source of truth 정리
- `llms.txt`, `llms-full.txt`, `/for-ai`, `/mcp`, sitemap/rss, JSON-LD 일반화
- topic / condition / faq / blog / program / home 공개면의 공용 helper 적용
- starter seed / SQL의 clinic-specific 기본값 제거

이번 포트에는 다음이 포함되지 않는다.

- `shipping / converter` 묶음
  이미 `v1.27.4`에 반영됨
- `src/pages/intake.astro`
  백록담 전용 UX가 섞여 있어 제외
- `src/plugins/custom-homepage/pages/index.astro`
  병원 전용 랜딩 카피/이미지 성격이라 제외
- `_local` override, 상태 파일, 테스트 산출물

## Commit Breakdown

1. `65b6d96` `feat(aeo): add metadata backfill and related link indexing`
2. `169b7c0` `feat(aeo): generalize public AI discovery outputs`
3. `20357a2` `chore(aeo): remove clinic-specific starter defaults`

## Main Files

### AEO storage / backfill

- `src/lib/aeo-backfill.ts`
- `src/lib/aeo-content.ts`
- `src/lib/related-links.ts`
- `migrations/0924_aeo_log_verification.sql`
- `migrations/0925_content_aeo_metadata.sql`
- `migrations/0926_content_similarity_index.sql`
- `scripts/aeo-backfill-runner.js`

### Admin / API

- `src/pages/admin/aeo/index.astro`
- `src/pages/api/admin/aeo/backfill-metadata.ts`
- `src/pages/api/admin/aeo/rebuild-related-links.ts`
- `src/pages/api/admin/posts/index.ts`
- `src/pages/api/admin/posts/[id].ts`
- `src/pages/api/admin/topics/[action].ts`

### Public outputs

- `src/components/seo/AEOSchemas.astro`
- `src/components/seo/InternalLinkingModule.astro`
- `src/pages/llms.txt.ts`
- `src/pages/llms-full.txt.ts`
- `src/pages/for-ai.astro`
- `src/pages/mcp.ts`
- `src/pages/sitemap*.ts`
- `src/pages/rss.xml.ts`

## Validation

- `npm run build` passed on the port branch
- `AEOSchemas.astro` 기본 설명/전문분야를 공용 코어에 맞게 일반화
- 새로 추가한 `aeo-backfill-runner.js`의 example URL 하드코딩 제거

## Reviewer Focus

- `src/lib/clinic.ts`가 공개 URL/클리닉 정보 source of truth로 충분한지
- AEO 메타데이터와 관련 링크가 기존 게시물/토픽 저장 흐름을 깨지 않는지
- `/llms.txt`, `/llms-full.txt`, `/for-ai`, `/mcp` 출력이 설치본별 설정을 정상 반영하는지
- starter seed / SQL 일반화가 새 설치본 품질을 해치지 않는지

## Post-Merge Follow-up

1. 릴리즈 태그 컷
2. 백록담 설치본에서 core pull
3. `/admin/aeo`, `/llms.txt`, `/llms-full.txt`, `/for-ai`, `/.well-known/ai.json` 검증
4. 대표 topic / blog / program JSON-LD 확인
