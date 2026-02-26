---
date: 2026-02-26
auditor: claude-opus-4-6
scope: 건강진단시스템, 퍼블리시플로우, 클라이언트배포, 트러블슈팅
status: completed
---

# Clinic-OS 건강진단 · 퍼블리시 · 배포 감사 보고서 (2026-02-26)

## 요약

세 영역에 대한 종합 감사를 수행했습니다:

1. **건강 진단 시스템** — 신규 구축 완료 (`scripts/health-audit.js`), core:pull/dev-start/deploy-guard 통합
2. **`npm run publish` 플로우** — `total-release.js` 기반 릴리스 파이프라인의 사전 검증·롤백·안전성 감사
3. **클라이언트 Cloudflare 배포** — `deploy-guard.js` + `setup-clinic.js` 기반 배포 과정의 gap 분석

---

## A. 건강 진단 시스템 (구현 완료)

### 구현된 항목

| ID | 항목 | 파일 | 상태 |
|----|------|------|------|
| HA1 | 통합 건강 진단 모듈 (6개 검사, score 0-100, --fix) | `scripts/health-audit.js` | **구현됨** |
| HA2 | package.json health/health:fix 스크립트 + minStarterVersion | `package.json` | **구현됨** |
| HA3 | fetch.js readStarterVersion() + pre-pull 건강검진 | `.docking/engine/fetch.js` | **구현됨** |
| HA4 | mirror-starter/create-starter-kit starter-version 기록 | `scripts/mirror-starter.js`, `scripts/create-starter-kit.js` | **구현됨** |
| HA5 | check-in.js 건강 텔레메트리 강화 | `scripts/check-in.js` | **구현됨** |
| HA6 | dev-start.js 건강 검진 (비차단, score < 70 경고) | `scripts/dev-start.js` | **구현됨** |
| HA7 | deploy-guard.js 건강 검진 (차단, score < 50 중단) | `scripts/deploy-guard.js` | **구현됨** |
| HA8 | update-starter.js FALLBACK_INFRA_FILES 추가 | `scripts/update-starter.js` | **구현됨** |
| HA9 | HQ handleHeartbeat 건강 데이터 저장 + advisory | `hq/src/index.js` | **구현됨** |
| HA10 | HQ devices 테이블 건강 컬럼 마이그레이션 | `hq/migrations/0016_device_health_columns.sql` | **구현됨** |

---

## B. `npm run publish` 퍼블리시 플로우 감사

### 파이프라인 구조

```
total-release.js (오케스트레이터)
  ├── [0] HQ 버전 동기화 (D1 쿼리)
  ├── [1] 버전 범프 (package.json)
  ├── [2] Git 동기화 (commit + tag + push)
  ├── [3] starter:push → mirror-starter.js
  ├── [4] create-starter-kit → create-starter-kit.js
  ├── [5] core:push → mirror-core.js
  ├── [6] release → publish-release.js (R2 + D1)
  └── [7] hq:deploy (cd hq && build && deploy)
```

### 발견사항

#### CRITICAL

| ID | 항목 | 위치 | 상태 |
|----|------|------|------|
| PB1 | 사전 검증 없음 — 빌드/테스트/health 없이 배포 진행 | `total-release.js` Step 0 전 | **해결됨** |
| PB2 | `git add .` — 의도치 않은 파일 커밋 가능 | `total-release.js:157` | **해결됨** |
| PB3 | 태그 `--force` 푸시 — 배포된 태그 덮어쓰기 | `total-release.js:179` | **해결됨** |
| PB4 | manifest.json 업로드 실패 무시 (클라이언트 업데이터 의존) | `publish-release.js:274` | **해결됨** |
| PB5 | 롤백이 package.json만 복구 — Git/R2/D1 잔존 | `total-release.js:218-235` | **해결됨** |

#### HIGH

| ID | 항목 | 위치 | 상태 |
|----|------|------|------|
| PB6 | 인프라 파일 업로드 50% 실패 허용 | `publish-release.js:256` | **해결됨** |
| PB7 | STARTER_SCRIPTS와 STARTER_INFRA_FILES 이중 관리 | mirror-starter vs publish-release | **해결됨** |
| PB8 | HQ 배포 후 헬스체크 없음 (새 버전 서빙 미확인) | `total-release.js` Step 7 후 | **해결됨** |
| PB9 | D1 업데이트(Step 6) → HQ 배포(Step 7) 순서 역전 | `total-release.js` | **해결됨** |

#### MEDIUM

| ID | 항목 | 위치 | 상태 |
|----|------|------|------|
| PB10 | .core/version 파일 범프 시 미업데이트 → health-audit 불일치 | `total-release.js` Step 1 | **해결됨** |
| PB11 | CORE_FILES 수동 관리 — protection-manifest.yaml과 미동기화 | `mirror-core.js:29-63` | **해결됨** |
| PB12 | 스테이징 디렉토리 영구 보존 (incremental용 의도적) | `mirror-core.js:683` | **해결불요** |
| PB13 | ZIP 크기 검증 없음 (0바이트 가능) | `create-starter-kit.js` | **해결됨** |

---

## C. 클라이언트 Cloudflare 배포 감사

### deploy-guard.js 검사 갭

#### CRITICAL

| ID | 항목 | 위치 | 증상 | 상태 |
|----|------|------|------|------|
| DG1 | `database_id` 플레이스홀더 검증 없음 | `deploy-guard.js:80` | 모든 DB 접근 500 | **해결됨** |
| DG2 | `dist/_routes.json` 빌드 산출물 검증 없음 | `deploy-guard.js` Step 5 후 | 모든 동적 경로 404 | **해결됨** |
| DG3 | 리모트 D1 마이그레이션 적용 확인/실행 없음 | `deploy-guard.js` Step 3 | 빈 DB → 500 | **해결됨** |
| DG4 | MW: DB 바인딩 실패 시 세션 인증 건너뜀 → 로그인 루프 | `src/middleware.ts:118` | 어드민 접근 불가 | **해결됨** |

#### HIGH

| ID | 항목 | 위치 | 상태 |
|----|------|------|------|
| DG5 | `ADMIN_PASSWORD` 기본값(`change-me-in-production`) 검증 없음 | `wrangler.toml:23` | **해결됨** |
| DG6 | Secrets 설정 단계가 실제 동작 안 함 (안내만) | `deploy-guard.js:139` | **해결됨** |
| DG7 | setup-clinic.js가 Pages가 아닌 Workers 형식 toml 생성 | `setup-clinic.js:466-491` | **해결됨** |
| DG8 | MW: IP 필터 fail-open — DB 오류 시 보안 우회 | `src/middleware.ts:174` | **해결됨** |

#### MEDIUM

| ID | 항목 | 위치 | 상태 |
|----|------|------|------|
| DG9 | `ALIGO_TESTMODE = "Y"` 프로덕션 배포 경고 없음 | `wrangler.toml:29` | **해결됨** |
| DG10 | `compatibility_date` 불일치 (toml vs astro.config) | `wrangler.toml:10` | **해결됨** |
| DG11 | `CLOUDFLARE_URL` 템플릿에 없음 (커스텀 도메인 안내 부족) | `wrangler.toml` | **해결됨** |
| DG12 | `site` URL이 `sample-clinic.com`으로 고정 (PROTECTED_EXACT) | `astro.config.mjs:89` | **해결됨** |
| DG13 | R2 버킷 미존재 시 경고만 (배포 중단 안 함) | `deploy-guard.js:121` | **해결됨** |

---

## 개선 방향

### Phase 1: deploy-guard.js 강화 (DG1-DG6)

`deploy-guard.js`에 다음 검증 단계를 추가:

1. **플레이스홀더 검증** — `database_id`, `bucket_name`, `ADMIN_PASSWORD` 등 기본값 감지 → 배포 중단
2. **빌드 산출물 검증** — `dist/_routes.json`, `dist/_worker.js` 존재 확인
3. **리모트 DB 검진** — 리모트 D1 테이블 수 확인 + 마이그레이션 제안
4. **보안 설정 검증** — 기본 비밀번호 감지, TESTMODE 경고

### Phase 2: total-release.js 강화 (PB1-PB5)

1. **Pre-flight 단계** — `npm test` + `npm run build` + `npm run health` + uncommitted 확인
2. **태그 force push 제거** — 충돌 시 에러로 처리
3. **manifest.json 업로드 실패 → throw** — 클라이언트 업데이터 의존 파일
4. **실행 순서 조정** — HQ 배포 → 정상 확인 → D1 업데이트 (클라이언트 노출)

### Phase 3: 배포 진단 도구 신규 생성

`scripts/deploy-check.js` — 배포 전 종합 진단 (health-audit의 배포 특화 버전)

검사 항목:
- wrangler.toml 완전성 (플레이스홀더, 보안, 바인딩)
- 리모트 리소스 접근 (D1, R2, KV)
- 리모트 DB 스키마 상태
- 빌드 산출물 검증
- 환경 변수/Secrets 정합성

---

## 참조 파일

| 파일 | 역할 |
|------|------|
| `scripts/health-audit.js` | 건강 진단 모듈 (신규) |
| `scripts/total-release.js` | 퍼블리시 오케스트레이터 |
| `scripts/publish-release.js` | R2 + D1 릴리스 |
| `scripts/mirror-core.js` | 코어 Git 미러 |
| `scripts/mirror-starter.js` | 스타터 Git 미러 |
| `scripts/create-starter-kit.js` | 스타터 ZIP 생성 |
| `scripts/deploy-guard.js` | 클라이언트 배포 가드 |
| `scripts/setup-clinic.js` | Cloudflare 초기 설정 |
| `src/middleware.ts` | 전역 미들웨어 (인증/IP) |
| `hq/src/index.js` | HQ 서버 |
