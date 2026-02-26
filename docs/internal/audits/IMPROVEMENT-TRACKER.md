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

### 운영 커맨드 & 배포 체계 감사 (2026-02-26)

- [x] 2026-02-26 H1: `BRD Clinic` 하드코딩 → 제네릭 이름으로 교체 (8건)
- [x] 2026-02-26 H2: `admin@brd.clinic` → `admin@example.com` 교체 (3건)
- [x] 2026-02-26 H3: `src/moai_adk/` Python 패키지 제거
- [x] 2026-02-26 M1: `public/content-api-docs.md` → `your-clinic.pages.dev` 교체 (3건)
