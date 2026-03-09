# Clinic-OS 개선 트래커

> 감사 결과 발견된 개선 항목을 한 곳에서 관리합니다.

## 완료

### 구조 감사 (2026-02-26)

- [x] 2026-02-26 잔여 개인정보 파일 삭제 (업로드 이미지, favicon 등)
- [x] 2026-02-26 소스코드 실명 교체 (DoctorIntro, topics, telemedicine)
- [x] 2026-02-26 시드 데이터 실명 교체
- [x] 2026-02-26 BRD Clinic 브랜딩 교체
- [x] 2026-02-26 CLAUDE.md MoAI 참조 → 프로젝트 컨텍스트 재구성
- [x] 2026-02-26 C1: chat-widget.js:50 주석 실명 제거
- [x] 2026-02-26 C2: clinic-os-safety.md ↔ fetch.js CORE_PATHS 동기화
- [x] 2026-02-26 C3: GEMINI.md 보호 목록 + 버전 동기화
- [x] 2026-02-26 C4: .claude/settings.json 하드 가드레일 생성
- [x] 2026-02-26 M3: 감사 체계 구축 (docs/audits/, /audit, /safety-check, /improvement)
- [x] 2026-02-26 C5: protection-manifest.yaml SOT 구축 — 6곳 분산 규칙을 단일 YAML로 통합
- [x] 2026-02-26 C6: HQ 가이드 아웃데이트 정리
- [x] 2026-02-26 C7: docs/ 참조 정확성 점검 (db:push → db:migrate 수정)
- [x] 2026-02-26 D1: safety:check CI/자동화 스크립트 — scripts/safety-check.js (--ci 지원)
- [x] 2026-02-26 L1: analytics.js 점검 완료 — 하드코딩 ID 없음, 모두 DB 설정 기반
- [x] 2026-02-26 L2: AGENTS.md 생성 — 매니페스트 기반 자동생성 (generate-protection-docs.js)

### deploy-guard.js 강화 (2026-02-26)

- [x] 2026-02-26 DG1: `database_id` 플레이스홀더 검증 — 기본값이면 배포 중단
- [x] 2026-02-26 DG2: `dist/_routes.json` 빌드 산출물 검증 — 없으면 동적 경로 404
- [x] 2026-02-26 DG3: 리모트 D1 마이그레이션 적용 확인/실행 — 빈 DB → 500
- [x] 2026-02-26 DG4: MW DB 바인딩 실패 시 503 에러 페이지 반환 (로그인 루프 방지)
- [x] 2026-02-26 DG5: `ADMIN_PASSWORD` 기본값(`change-me-in-production`) 검증
- [x] 2026-02-26 DG6: Secrets 설정 — echo 파이프로 실제 동작 구현
- [x] 2026-02-26 DG7: setup-clinic.js Pages 형식 toml 생성 (Workers → Pages)
- [x] 2026-02-26 DG8: MW IP 필터 fail-open — 에러 로깅 강화
- [x] 2026-02-26 DG9: `ALIGO_TESTMODE = "Y"` 프로덕션 경고
- [x] 2026-02-26 DG10: `compatibility_date` 6개월 경과 시 경고
- [x] 2026-02-26 DG11: `CLOUDFLARE_URL` — setup-clinic.js 생성 toml에 주석 가이드 추가
- [x] 2026-02-26 DG12: `site` URL 고정값 검증 — deploy-guard에서 sample-clinic.com 감지 경고
- [x] 2026-02-26 DG13: R2 버킷 미존재 시 경고 → 배포 중단

### total-release.js 강화 (2026-02-26)

- [x] 2026-02-26 PB1: 사전 검증 추가 — build/test/health 없이 배포 진행 방지
- [x] 2026-02-26 PB2: `git add .` → 명시적 파일 스테이징으로 변경
- [x] 2026-02-26 PB3: 태그 `--force` 푸시 제거 — 충돌 시 에러 처리
- [x] 2026-02-26 PB4: manifest.json 업로드 실패 → throw (클라이언트 업데이터 의존)
- [x] 2026-02-26 PB5: 롤백 범위 확장 — Git 태그 정리 + .core/version 복구
- [x] 2026-02-26 PB6: 인프라 파일 업로드 임계값 50% → 20%로 강화
- [x] 2026-02-26 PB7: STARTER_SCRIPTS/STARTER_INFRA_FILES → shared-file-lists.js 단일 소스 통합
- [x] 2026-02-26 PB8: HQ 배포 후 헬스체크 추가
- [x] 2026-02-26 PB9: D1 업데이트 → HQ 배포 순서 조정
- [x] 2026-02-26 PB10: .core/version 파일 범프 시 업데이트
- [x] 2026-02-26 PB11: CORE_FILES ↔ protection-manifest.yaml 동기화 (누락 스크립트 6개 추가)
- [x] 2026-02-26 PB12: 스테이징 디렉토리 — incremental update용 의도적 보존 (해결불요)
- [x] 2026-02-26 PB13: ZIP 크기 검증 (1KB 미만 시 에러)

### 운영 커맨드 & 배포 체계 감사 (2026-02-26)

- [x] 2026-02-26 C1: fetch.js fallback CORE_PATHS에 `.claude/commands/`, `.claude/rules/` 추가
- [x] 2026-02-26 C2: clinic-os-safety.md 재생성 (generate-protection-docs.js 실행)

## 미완료

### 로컬 에이전트 반복 오류 → HQ 이슈 보고 강화 (2026-03-07)

- [x] P0: 로컬 반복 오류 fingerprint/history 기반 `agent:report-issue` CLI 추가
- [x] P0: support-agent-worker `/support/report-bug` duplicate append / 신규 생성 경로 연결
- [x] P0: `agent:doctor`에 `issue_reporting` 요약 및 안전 제안 연결
- [x] P1: 스타터킷 배포물에 issue reporting 스크립트/ignore 파일 포함
- [x] P2: `.agent/last-error.json` 발생원 스키마를 fetch/migrate/recovery 경로에서 완전 통일
- [x] P2: HQ `/admin/support/issues`에서 raw bug report 조회/triage/GitHub 생성 가능하게 연결
- [x] P2: HQ 운영면에서 반복 설치/업데이트 오류 집계 뷰 강화

### Public Skin System 확장 (2026-03-07)

- [x] P0: 관리자 설정 변경 -> 퍼블릭 반영 계약 테스트에 skin 변경 축 추가
- [x] P0: `/admin/design` 미리보기를 multi-surface preview pack으로 확장
- [x] P0: skin pack 검증 커맨드 (`skin:check`) 추가
- [x] P1: 코어 신규 프리셋 2-3종 실제 디자인 제작
- [x] P1: skin pack 공유/스토어 제출 포맷 정의
- [x] P1: direct-import 페이지(`programs/[id]` 등)도 skin override helper로 정렬
- [x] P2: Pencil MCP가 연결된 환경에서 skin preset 디자인 authoring 경로 문서화
- [x] P2: HQ 공개 페이지에 스킨 라이브러리와 최신 가이드 연결
- [x] P2: 로컬 관리자 `/admin/skins/store` 와 HQ `/api/skins` 기반 curated skin install 흐름 연결
- [x] P3: HQ에서 스킨 제출/심사/승인까지 다루는 중앙 마켓플레이스 스키마 설계 및 1차 구현
- [x] P3: 운영 HQ 기준 테스트 클라이언트/임시 community skin 스모크 검증

### HQ 공개면 최신화 (2026-03-07)

- [x] P0: HQ 홈 랜딩에 agent-driven 설치/복원/스킨 스토어 흐름 반영
- [x] P0: HQ `Windows/macOS 설치 가이드`를 최신 에이전트 경로 기준으로 정렬
- [x] P0: HQ `로컬 vs 프로덕션`, `마이그레이션과 재설치 이관` 최신화
- [x] P1: HQ `/plugins`, `/survey-tools` 소개면의 최신 agent-driven 경로 감사
- [x] P1: HQ 홈/가이드의 고정 운영 카피 재감사

### Release Pipeline 감사 (2026-03-07)

- [x] P0: HQ 배포 경로에 원격 D1 마이그레이션 자동 적용
- [x] P0: `starter:push -> create-starter -> publish-release` 사이 starter 중복 생성/검증 제거
- [x] P1: `publish-release` starter infra R2 업로드 제한 병렬화
- [x] P1: `total-release`의 `create-starter` / `core-mirror` 안전 병렬화
- [x] P1: 클라이언트 Phase 2에 `update:starter`를 공식 순서로 반영
- [x] P1: `release-validate`가 starter manifest drift와 로컬 starter infra 누락을 잡도록 강화
- [x] P1: master/HQ/client 전체 상태를 한 번에 보는 `release:pipeline:audit` 커맨드 추가
- [x] P1: `update:starter` manifest를 `.starter-staging` 기준 전체 starter 파일 세트로 확장
- [x] P1: 구형 클라이언트 bootstrap용 `update-starter-core` 경로 추가 및 package.json 별도 merge-safe 동기화
- [x] P2: 릴리스 단계별 duration/결과를 남기는 `release-last-run` 요약 파일 추가
- [x] P2: 릴리스 동시 실행 충돌 방지용 공통 release lock 추가
- [x] P2: `total-release` / `release-modular` 내부 npm 실행 경로를 Node 번들 npm 우선으로 안정화
- [x] P2: starter update를 `bundle + hash skip` 구조로 바꿔 이후 릴리스/클라이언트 업데이트 왕복 수를 축소
- [x] P2: `clinic-release` 단일 운영 진입점과 `.agent/release-ops-report.{json,md}` 요약 리포트 추가
- [x] P3: `release-conductor.sh`가 공통 lock / last-run / modular state를 함께 보여주고 시작 충돌을 막도록 정리
- [x] P3: `release-conductor`와 `release-modular` 상태 파일을 `.agent/release-modular-state.json` 하나로 통합하고 legacy `release-state.json` 자동 이관
- [x] P3: `DEPLOYED` 검증을 실제 Production deployment source + last-deploy metadata 기준으로 강화

### 운영 커맨드 & 배포 체계 감사 (2026-02-26)

- [x] 2026-02-26 H1: `BRD Clinic` 하드코딩 → 제네릭 이름으로 교체 (8건)
- [x] 2026-02-26 H2: `admin@brd.clinic` → `admin@example.com` 교체 (3건)
- [x] 2026-02-26 H3: `src/moai_adk/` Python 패키지 제거
- [x] 2026-02-26 M1: `public/content-api-docs.md` → `your-clinic.pages.dev` 교체 (3건)

### AEO & AI 챗봇 배포 안전성 감사 (2026-02-27)

- [x] 2026-02-27 C1: `create-placeholder-member.ts`에 `@brd.clinic` 이메일 → `@clinic.local` 교체
- [x] 2026-02-27 H1: `src/content/aeo/`를 `core_paths`에 추가 (protection-manifest + fetch.js)
- [x] 2026-02-27 H2: `InternalLinkingModule` AI 챗봇 버튼 → feature flag 조건부 렌더링
- [x] 2026-02-27 H3: `release-validate.sh` `brd-clinic-v2` → `$PAGES_PROJECT_NAME` 환경변수
- [x] 2026-02-27 H4: `CLAUDE.md` 코어 경로에 `src/content/aeo/` 추가
- [x] 2026-02-27 구조: `check-core-imports.js` 가드레일 구축 + deploy-guard/mirror-core 연동
- [x] 2026-02-27 구조: 스타터킷 버전 체크 경고→차단 강화
- [x] 2026-02-27 구조: 코어 폴백 `/ai-chat` 페이지 + `aeo.ts` 조건부 매니페스트

### DB 복구 & 보호 규칙 감사 (2026-02-27)

- [x] 2026-02-27 M1: GEMINI.md 코어 경로에 5개 누락 → 매니페스트 동기화 완료
- [x] 2026-02-27 M2: GEMINI.md 보호 파일에 `.agent/onboarding-state.json` + `src/plugins/local/` 추가

### First Contact 프로토콜 감사 (2026-02-27)

- [x] 2026-02-27 H1: fetch.js 하드코딩 폴백에 `.cursorrules`/`.windsurfrules`/`.clinerules` 추가
- [x] 2026-02-27 M1: GEMINI.md (마스터) 코어 단일 파일 목록에 에이전트 파일 3종 추가
