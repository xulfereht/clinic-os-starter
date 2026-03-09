# 2026-03-07 HQ Skin Alignment Audit

## 판단

스킨 시스템 자체는 코어/로컬 앱 쪽에서 상당 부분 닫혔지만, HQ 공개면은 그 속도를 따라오지 못하고 있었다.

기존 HQ 상태:

1. 플러그인 스토어와 검사도구 스토어는 있으나 스킨 전용 진입점이 없었다.
2. 스킨은 이미 `skin:create / skin:check / skin:bundle / skin:install` 흐름을 갖고 있는데, HQ 공개 문서는 이를 거의 설명하지 못했다.
3. HQ 공개 페이지는 최근 추가된 `pageTemplates`, detail template, multi-surface preview pack, Pencil MCP 연계를 반영하지 못했다.
4. 사용자 입장에서는 "스킨도 플러그인처럼 HQ 스토어에 올리는가?"가 불명확했다.

## 이번 배치에서 정렬한 것

- HQ 공개 라우트 `/skins`, `/skins/{skinId}` 추가
- HQ build-time skin registry 생성 (`generated-skin-library.js`)
- HQ public API 추가
  - `/api/skins`
  - `/api/skins/{skinId}`
  - `/api/skins/{skinId}/download`
- HQ 내비게이션/푸터/홈 랜딩/플러그인 스토어에서 스킨 라이브러리로 교차 연결
- 로컬 관리자 스킨 스토어 추가
  - `/admin/skins/store`
  - `/api/admin/skins/install`
  - `/api/admin/skins/uninstall`
- HQ 가이드 추가
  - `vibe-skins`
  - `skin-sharing`
- 기존 HQ 가이드 보강
  - `overview`
  - `vibe-start`
  - `ai-effective-requests`
  - `plugin-sharing`
  - `vibe-plugins`
- 루트 스킨 문서와 에이전트 워크플로 최신화
  - detail template 실사용 범위
  - `/admin/design` preview pack 확장
  - HQ 라이브러리 경로
  - Pencil MCP 설계 메모

## 현재 HQ에서 가능한 수준

### 이미 가능

- 코어 스킨 프리셋 카탈로그 공개
- HQ curated 스킨 번들 공개
- 로컬 관리자에서 curated 스킨 설치/제거
- 스킨별 template/recipe/override/명령 요약
- 로컬 제작/검증/공유 흐름 안내
- 플러그인/검사도구와의 역할 구분 안내

### 아직 얕거나 미완

- preview asset 업로드와 시각 diff 리뷰
- 다운로드/설치 telemetry 세분화
- 스킨 평점/노출 순위

## 결론

지금 HQ는 스킨에 대해 **커뮤니티 제출/심사/승인형 마켓플레이스 1차 버전**까지는 닫혔고, 운영 지표와 시각 검수 쪽은 아직 얕다.

이 상태는 현재 코드베이스와 배포 리스크를 기준으로는 적절하다.

이유:

- 스킨은 플러그인보다 아티팩트 구조가 단순하지만, review 기준은 오히려 시각 확인과 preview asset이 필요하다.
- 기존 plugin marketplace 스키마에 억지로 넣으면 제출/검수 기준이 섞이고, 설치 포맷도 혼동될 가능성이 높다.
- 현재는 HQ curated install + community submit/review + zip bundle/install 공유가 모두 가능하므로, 다음 투자 포인트는 시각 검수와 운영 telemetry 쪽이다.

## 다음 단계 제안

1. `artifact registry` 방향으로 일반화
   - `artifact_type = plugin | survey-tool | skin`
   - 공통 submission/version/review 테이블로 확장

2. 스킨 전용 preview 자산 계약 추가
   - 홈
   - topic/faq/notice detail
   - hero still
   - mobile preview

3. 설치 telemetry 추가
   - skin install
   - active skin change
   - bundle hash

4. HQ review UI 고도화
   - template coverage
   - override file presence
   - preview asset diff

한 줄로 정리하면, **HQ 스킨 공개면과 중앙 제출/승인 경로는 붙었고, 다음 단계는 시각 검수와 telemetry**다.
