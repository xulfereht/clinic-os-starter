---
id: SPEC-PLUGIN-SYSTEM-001
title: Plugin System v2 - Admin UI 기반 Submit/Install 파이프라인
version: "1.0.0"
status: planned
created: 2026-02-10
updated: 2026-02-10
author: amu
priority: high
lifecycle_level: spec-anchored
supersedes: SPEC-PLUGIN-MARKETPLACE-001 (submit/install 플로우 부분)
tags: plugin, marketplace, install, submit, admin-ui, rebuild
---

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 2026-02-10 | 1.0.0 | 초기 SPEC 작성 - Admin UI 기반 플러그인 시스템 v2 | amu |

---

# SPEC-PLUGIN-SYSTEM-001: Plugin System v2

## Environment

### 시스템 개요

Clinic-OS Plugin System v2는 AI 코딩 에이전트가 로컬에서 플러그인을 개발하고, 관리자 UI를 통해 HQ에 제출하거나 HQ에서 설치하는 **Admin UI 중심 아키텍처**를 구현한다. CLI/npx 명령어 없이 모든 플러그인 라이프사이클을 웹 인터페이스에서 관리한다.

### 아키텍처 결정 사항 (확정)

1. **AI 코딩 에이전트**: `src/plugins/local/{id}/`에 플러그인 초기 개발만 담당
2. **Admin UI**: 제출(Submit to HQ)과 설치(Install from HQ) 전 과정을 처리
3. **CLI 불필요**: 초기 개발 이후 CLI/npx 명령어 없음
4. **Store 페이지**: 로컬 `store.astro`가 HQ API에서 동적으로 데이터 fetch
5. **빌드타임 로딩**: `plugin-loader.ts`가 `import.meta.glob` 사용 = 신규 설치 후 리빌드 필수

### 현재 상태

**HQ 백엔드 (완료됨):**
- `hq/src/index.js`: 플러그인 CRUD, 개발자 등록, 라이선스 검증, 제출/검증/보안 스캔, 리뷰 큐, 설치/삭제 추적, 업데이트 체크, 롤백, 위반 보고, 통계/분석 API
- `hq/migrations/0014_plugin_marketplace.sql`: 13개 테이블 + 2개 뷰

**HQ 데이터베이스 (완료됨):**
- `plugin_developers`: 개발자 계정 (신뢰 등급, 상태)
- `plugins`: 플러그인 메타데이터
- `plugin_versions`: 버전 관리, 리뷰 상태
- `plugin_reviews`: 리뷰 이력
- `plugin_installs`: 클라이언트별 설치 현황
- `plugin_ratings`: 사용자 평점
- `plugin_access`: 접근 권한 (유료 플러그인)
- `plugin_purchases`: 구매 기록
- `plugin_categories`: 카테고리 정의
- `plugin_submissions`: 제출 기록
- `plugin_downloads`: 다운로드 기록
- `plugin_violations`: 위반 기록
- `plugin_scan_rules`: 보안 스캔 규칙
- `v_plugins_public`, `v_plugin_review_queue`: 공개/리뷰 뷰

**프론트엔드 페이지 (완료됨):**
- `src/pages/plugins/store.astro` - 스토어 목록 (HQ fetch)
- `src/pages/plugins/developer.astro` - 개발자 등록 포털
- `src/pages/admin/plugins/review.astro` - 관리자 리뷰 대시보드
- `src/pages/admin/plugins/updates.astro` - 플러그인 업데이트 관리
- `src/pages/admin/plugins/violations.astro` - 보안 위반 관리
- `src/pages/admin/plugins/analytics.astro` - 분석 대시보드

**로컬 API (부분 완료):**
- `src/pages/api/plugins/install.ts` - 설치 엔드포인트 (메타데이터 저장만, 파일 다운로드 미구현)
- `src/pages/api/plugins/toggle.ts` - 활성화/비활성화
- `src/pages/api/plugins/uninstall.ts` - 삭제

**Plugin SDK & 로더 (완료됨):**
- `src/lib/plugin-sdk.ts` - 21개 권한, 13개 훅 타입
- `src/lib/plugin-sdk/` - 내부 SDK 모듈 (patients, database, storage APIs)
- `src/lib/plugin-loader.ts` - `import.meta.glob` 기반 빌드타임 로더

### 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| Frontend | Astro 5.16, React 18, Tailwind CSS 4.1, TypeScript 5.9 | Islands Architecture |
| Backend (HQ) | Cloudflare Workers, Hono, D1, R2 | 플러그인 저장/배포 |
| Backend (Local) | Cloudflare Workers (Astro SSR) | 로컬 API |
| Package Manager | Bun | 빌드/개발 |
| Plugin Loader | Vite import.meta.glob | 빌드타임 번들링 |

---

## Assumptions

1. **빌드타임 제약**: `plugin-loader.ts`의 `import.meta.glob`은 빌드타임에 실행되므로, 새 플러그인 설치 후 `astro build` 또는 `bun run build`가 필요하다
2. **로컬 파일시스템 접근**: Cloudflare Workers 환경에서 로컬 파일 R/W가 제한적이므로, 개발 서버(dev mode) 환경에서만 파일 추출이 가능하다
3. **라이선스 인증**: 모든 HQ 통신에는 유효한 라이선스 키가 필요하다
4. **Admin 권한**: 플러그인 제출/설치는 admin 세션이 필요하다
5. **R2 스토리지**: HQ의 R2에 플러그인 zip 번들이 저장되어 있다
6. **기존 HQ API 안정성**: HQ 백엔드 API는 현재 구현 그대로 사용 가능하다
7. **개발 서버 전제**: 플러그인 설치/제출은 `bun run dev` 상태에서 수행한다 (프로덕션 배포 후에는 빌드 파이프라인 필요)

---

## Requirements (EARS Format)

### REQ-001: 로컬 플러그인 탐지 API

**WHEN** 관리자가 플러그인 관리 페이지에 접근하면 **THEN** 시스템은 `src/plugins/local/` 디렉토리를 스캔하여 모든 로컬 플러그인의 manifest 정보, 파일 목록, HQ 제출 상태를 반환해야 한다.

**IF** `src/plugins/local/{id}/manifest.json`이 존재하지 않으면 **THEN** 시스템은 해당 디렉토리를 유효하지 않은 플러그인으로 표시하고 제출 대상에서 제외해야 한다.

**구현 범위:**
- `GET /api/plugins/local` 엔드포인트 신규 생성
- `manifest.json` 파싱 및 유효성 검증
- 각 플러그인의 파일 목록 및 크기 정보 반환
- HQ 제출 이력과 대조하여 "미제출", "제출됨", "승인됨" 상태 표시

**기존 구현과의 관계:**
- `plugin-loader.ts`의 `getInstalledPlugins()`를 참고하되, 런타임 파일시스템 접근이 필요하므로 별도 API로 구현

---

### REQ-002: 자동 패키징 및 HQ 제출

**WHEN** 관리자가 로컬 플러그인의 "HQ에 제출" 버튼을 클릭하면 **THEN** 시스템은 다음을 순차적으로 수행해야 한다:
1. `manifest.json` 유효성 검증 (필수 필드, 버전 형식, 권한 정의)
2. 로컬 파일을 zip으로 패키징
3. Base64 인코딩
4. HQ의 `handleSubmitPlugin` API에 전송

**WHILE** 패키징이 진행되는 동안 **THEN** 시스템은 Admin UI에 진행 상태(검증 중, 패키징 중, 전송 중, 완료/실패)를 표시해야 한다.

**IF** manifest 검증에 실패하면 **THEN** 시스템은 제출을 중단하고 구체적인 오류 메시지(누락 필드, 잘못된 형식 등)를 반환해야 한다.

**구현 범위:**
- `POST /api/plugins/submit` 엔드포인트 신규 생성
- manifest 유효성 검증 로직 (기존 `validateManifest` 재사용)
- 파일 읽기 -> zip 생성 -> base64 인코딩 파이프라인
- HQ `handleSubmitPlugin` API 호출
- Admin UI 제출 상태 컴포넌트

**기존 구현과의 관계:**
- `plugin-sdk.ts`의 `validateManifest()` 함수 재사용
- HQ의 `handleSubmitPlugin` API 그대로 활용

---

### REQ-003: 설치 상태가 포함된 플러그인 스토어

**WHEN** 관리자가 플러그인 스토어 페이지에 접근하면 **THEN** 시스템은 HQ 카탈로그를 로컬 `installed_plugins` 테이블과 대조하여 각 플러그인에 다음 상태를 표시해야 한다:
- "설치" - 미설치 플러그인
- "설치됨" - 이미 설치된 플러그인
- "업데이트 가능" - 새 버전이 HQ에 있는 플러그인

**WHEN** 관리자가 특정 플러그인을 클릭하면 **THEN** 시스템은 플러그인 상세 정보(설명, 스크린샷, 권한 요청, 버전 이력, 리뷰)를 인라인 모달 또는 상세 페이지로 표시해야 한다.

**구현 범위:**
- `store.astro` 개선: 설치 상태 비교 로직 추가
- `GET /api/plugins/install-status` 엔드포인트 (로컬 설치 목록 반환)
- 플러그인 상세 뷰 (모달 또는 `/plugins/store/[id].astro`)
- 설치/업데이트 버튼 동적 렌더링

**기존 구현과의 관계:**
- `store.astro` 기존 구현 확장
- `installed_plugins` 테이블 활용

---

### REQ-004: 번들 다운로드 및 파일 추출

**WHEN** 관리자가 플러그인 "설치" 버튼을 클릭하면 **THEN** 시스템은 다음을 수행해야 한다:
1. HQ API를 통해 R2에서 플러그인 zip 번들 다운로드
2. 체크섬 검증으로 무결성 확인
3. `src/plugins/local/{id}/` 디렉토리에 파일 추출
4. 로컬 `installed_plugins` 테이블에 메타데이터 저장

**IF** 대상 디렉토리에 이미 파일이 존재하면 **THEN** 시스템은 기존 파일을 백업하고 덮어쓰기해야 한다.

**IF** 체크섬 검증에 실패하면 **THEN** 시스템은 설치를 중단하고 오류를 보고해야 한다.

시스템은 설치 과정에서 다운로드된 파일을 `src/plugins/local/{id}/` 외부에 저장하지 않아야 한다.

**구현 범위:**
- `install.ts` 개선: 파일 다운로드 + 추출 로직 추가
- zip 다운로드 (HQ R2 -> 로컬)
- 파일 추출 엔진 (zip -> 파일시스템)
- 체크섬 검증 (SHA-256)
- 기존 파일 백업 메커니즘
- `pluginId` 파라미터명 통일 (기존 `plugin_id` 불일치 수정)

**기존 구현과의 관계:**
- `install.ts`의 메타데이터 저장 로직 유지
- HQ의 `/api/plugins/{id}/download` API 활용
- `install.ts`의 `pluginId` 파라미터를 이미 사용 중이나, 일부 호출부에서 `plugin_id`로 전송하는 불일치 수정 필요

---

### REQ-005: 설치 후 리빌드 알림

**WHEN** 플러그인 파일 추출이 완료되면 **THEN** 시스템은 관리자에게 "리빌드 필요" 알림을 표시하고, 플러그인 상태를 "설치됨 (리빌드 대기)"로 설정해야 한다.

**WHEN** 관리자가 "리빌드 실행" 버튼을 클릭하면 **THEN** 시스템은 로컬 API를 통해 `astro build`를 트리거하고 빌드 진행 상태를 표시해야 한다.

**WHILE** 리빌드가 진행되는 동안 **THEN** 시스템은 플러그인 상태를 "빌드 중"으로 표시하고, 완료 시 "활성"으로 변경해야 한다.

**IF** 리빌드가 실패하면 **THEN** 시스템은 오류 로그를 표시하고 플러그인 상태를 "빌드 실패"로 설정해야 한다.

**구현 범위:**
- 플러그인 상태 필드 확장: `installed_pending_rebuild`, `building`, `active`, `build_failed`
- `POST /api/plugins/rebuild` 엔드포인트 (빌드 트리거)
- 리빌드 진행 상태 폴링 또는 SSE
- Admin UI 알림 배너 컴포넌트

**기존 구현과의 관계:**
- `installed_plugins` 테이블의 `status` 컬럼 활용 (현재 `active`만 사용)
- 빌드 트리거는 로컬 프로세스 실행이므로 dev 환경에서만 동작

---

### REQ-006: 플러그인 마이그레이션 시스템

**WHEN** 설치된 플러그인에 `migrations/` 디렉토리가 포함되어 있으면 **THEN** 시스템은 로컬 D1 데이터베이스에 SQL 마이그레이션을 실행해야 한다.

**WHILE** 마이그레이션이 실행되는 동안 **THEN** 시스템은 진행 상태를 추적하고 각 마이그레이션 파일의 실행 결과를 기록해야 한다.

**IF** 마이그레이션 실행 중 오류가 발생하면 **THEN** 시스템은 해당 마이그레이션을 중단하고 이전까지 실행된 마이그레이션 상태를 보존해야 한다.

**구현 범위:**
- `plugin_migrations` 로컬 테이블 신규 생성 (plugin_id, migration_file, executed_at, status)
- `POST /api/plugins/migrate` 엔드포인트
- 마이그레이션 파일 순차 실행 (`NNNN_description.sql` 패턴)
- 이미 실행된 마이그레이션 스킵
- 롤백 지원 (선택적: `NNNN_description.rollback.sql` 파일 존재 시)

**기존 구현과의 관계:**
- 프로젝트의 기존 마이그레이션 패턴 (`migrations/NNNN_*.sql`) 준수
- `wrangler d1 execute` 패턴 참고

---

### REQ-007: SDK 위반 보고

**WHEN** 플러그인 SDK 런타임에서 권한 위반이 감지되면 **THEN** 시스템은 HQ의 위반 보고 API에 자동으로 보고해야 한다.

**IF** 특정 플러그인의 위반 횟수가 설정된 임계값을 초과하면 **THEN** 시스템은 해당 플러그인을 자동 비활성화하고 관리자에게 알림을 표시해야 한다.

시스템은 위반 보고 실패로 인해 플러그인 기능이 중단되지 않아야 한다.

**구현 범위:**
- `plugin-sdk.ts`에 위반 보고 연동 추가
- HQ `/api/plugins/violations/report` API 호출 로직
- 로컬 위반 카운터 및 임계값 설정
- 자동 비활성화 로직 (`toggle.ts` 연동)
- 비동기 보고 (fire-and-forget, 실패 시 로컬 큐에 저장)

**기존 구현과의 관계:**
- `violations.astro` 관리 대시보드 이미 존재
- HQ의 위반 보고 API 이미 구현됨
- `plugin-sdk.ts`의 권한 체크 로직에 보고 훅 추가

---

## Specifications

### 데이터 모델

**로컬 `installed_plugins` 테이블 확장:**

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `status` | TEXT | `active`, `installed_pending_rebuild`, `building`, `build_failed`, `disabled` |
| `source` | TEXT | `local` (AI가 개발), `hq` (HQ에서 설치) |
| `hq_version` | TEXT | HQ에서 설치된 버전 (업데이트 비교용) |
| `checksum` | TEXT | 설치된 번들의 SHA-256 해시 |
| `last_rebuild_at` | INTEGER | 마지막 리빌드 시각 (unixepoch) |

**신규 `plugin_migrations_local` 테이블:**

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `plugin_id` | TEXT | 플러그인 ID |
| `migration_file` | TEXT | 마이그레이션 파일명 |
| `executed_at` | TEXT | 실행 시각 (ISO 8601) |
| `status` | TEXT | `success`, `failed` |
| `error_message` | TEXT | 실패 시 에러 메시지 |

### API 엔드포인트 설계

| 메서드 | 경로 | 설명 | 상태 |
|--------|------|------|------|
| GET | `/api/plugins/local` | 로컬 플러그인 목록 탐지 | **신규** |
| POST | `/api/plugins/submit` | HQ에 플러그인 제출 | **신규** |
| GET | `/api/plugins/install-status` | 로컬 설치 상태 목록 | **신규** |
| POST | `/api/plugins/install` | 플러그인 설치 (파일 다운로드 추가) | **개선** |
| POST | `/api/plugins/migrate` | 플러그인 마이그레이션 실행 | **신규** |
| POST | `/api/plugins/rebuild` | Astro 리빌드 트리거 | **신규** |
| POST | `/api/plugins/toggle` | 활성화/비활성화 | 기존 유지 |
| POST | `/api/plugins/uninstall` | 삭제 | 기존 유지 |

### UI 컴포넌트 설계

**Admin 플러그인 관리 탭:**
- 로컬 플러그인 목록 (제출 버튼 포함)
- 설치된 플러그인 목록 (상태 배지 포함)
- 리빌드 필요 배너

**Store 페이지 개선:**
- 설치 상태 배지 ("설치", "설치됨", "업데이트 가능")
- 플러그인 상세 모달
- 설치 진행 상태 표시

### 제약 사항

1. **빌드타임 로딩**: `import.meta.glob`은 빌드타임에 실행되므로 플러그인 설치 후 반드시 리빌드가 필요하다
2. **파일시스템 접근**: Cloudflare Workers 프로덕션 환경에서는 로컬 파일시스템 쓰기가 불가능하므로, 파일 추출은 개발 서버 환경에서만 동작한다
3. **동시성**: 동시에 여러 플러그인을 설치할 때 파일 충돌을 방지해야 한다
4. **보안**: zip 추출 시 경로 순회(path traversal) 공격을 방지해야 한다

### Traceability

| 요구사항 | 구현 파일 | 테스트 시나리오 |
|----------|----------|---------------|
| REQ-001 | `src/pages/api/plugins/local.ts` | AC-001 |
| REQ-002 | `src/pages/api/plugins/submit.ts` | AC-002 |
| REQ-003 | `src/pages/plugins/store.astro`, `src/pages/api/plugins/install-status.ts` | AC-003 |
| REQ-004 | `src/pages/api/plugins/install.ts` (개선) | AC-004 |
| REQ-005 | `src/pages/api/plugins/rebuild.ts` | AC-005 |
| REQ-006 | `src/pages/api/plugins/migrate.ts` | AC-006 |
| REQ-007 | `src/lib/plugin-sdk.ts` (개선) | AC-007 |

---

## 관련 문서

- SPEC-PLUGIN-MARKETPLACE-001: 원본 마켓플레이스 SPEC (본 SPEC이 submit/install 플로우를 대체)
- `src/lib/plugin-sdk.ts`: Plugin SDK 전체 정의
- `src/lib/plugin-loader.ts`: 빌드타임 플러그인 로더
- `hq/src/index.js`: HQ 백엔드 전체 API
- `hq/migrations/0014_plugin_marketplace.sql`: HQ 데이터베이스 스키마
