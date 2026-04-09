# M: Foreign Locale Banner → 백록담 로컬 오버라이드

**Date:** 2026-04-09
**Status:** 🟡 IN PROGRESS
**Owner:** charlie(SAS)

## Problem

baekrokdam.com/en에 렌더링되는 2개 배너:
1. **헤더 하단 거주외국인 안내 배너** (amber notice bar)
2. **챗위젯 상단 상담 CTA 배너** (floating consult banner)

현재 `src/components/local/ForeignLocaleBanner.astro`에 정의되어 있으나,
코어 BaseLayout에서 렌더링되거나 `custom_after_header` 원시 HTML로 주입됨.
→ 다른 클리닉에도 자동 적용되는 문제.

## Target

- **코어(BaseLayout):** 배너 렌더링하지 않음 (기본값 false)
- **백록담:** `features.foreignLocaleBanner = true` 설정 시에만 렌더링
- **패턴:** `remoteConsultation` feature flag와 동일한 방식

## Implementation

1. `ForeignLocaleBanner.astro` → `src/components/local/` 유지 (이미 있음)
2. BaseLayout에 feature flag 체크 + 조건부 렌더링 추가
3. ClinicSettings.features 타입에 `foreignLocaleBanner?` 추가
4. DB seed: 백록담 `site_settings`에 `foreign_locale_banner = true` INSERT
5. `custom_after_header` 원시 HTML → DB에서 제거 (컴포넌트로 대체)

## Files

- `src/components/layout/BaseLayout.astro` — feature flag 조건부 렌더링
- `src/components/local/ForeignLocaleBanner.astro` — 기존 컴포넌트 유지
- `src/lib/clinic.ts` — ClinicSettings.features 타입 업데이트
- `hq/seeds/` — 백록담 feature flag INSERT SQL
