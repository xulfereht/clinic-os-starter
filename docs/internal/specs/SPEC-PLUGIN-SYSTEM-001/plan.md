---
id: SPEC-PLUGIN-SYSTEM-001
document: plan
version: "1.0.0"
status: planned
created: 2026-02-10
updated: 2026-02-10
---

# SPEC-PLUGIN-SYSTEM-001: 구현 계획

## 구현 전략

3단계 점진적 구현 전략을 채택한다. Phase 1(Install Pipeline)이 가장 높은 우선순위를 가지며, 관리자가 HQ에서 플러그인을 설치하는 핵심 플로우를 완성한다. Phase 2(Submit Pipeline)는 로컬 개발 플러그인을 HQ에 제출하는 플로우를, Phase 3(Runtime)은 SDK 위반 보고 연동을 구현한다.

---

## Phase 1: Install Pipeline (최고 우선순위)

플러그인 설치의 전체 플로우를 완성한다. 현재 `install.ts`가 메타데이터만 저장하는 상태에서, 실제 파일 다운로드 -> 추출 -> 리빌드 알림까지 구현한다.

### Task 1-1: install.ts 파일 다운로드 및 추출 기능 추가 (REQ-004)

**목표:** HQ R2에서 zip 번들을 다운로드하고 `src/plugins/local/{id}/`에 추출

**작업 내역:**
- HQ download API에서 zip 바이너리 다운로드 로직 구현
- zip 파일 파싱 및 추출 (JSZip 또는 fflate 라이브러리 활용)
- SHA-256 체크섬 검증
- 경로 순회(path traversal) 방어: 추출 경로가 `src/plugins/local/{id}/` 내부인지 검증
- 기존 파일 존재 시 백업 (`{id}.backup-{timestamp}/`) 후 덮어쓰기
- `pluginId` 파라미터명 통일 (프론트엔드 호출부 확인 및 수정)
- `installed_plugins` 테이블에 `source`, `hq_version`, `checksum` 컬럼 추가

**의존성:** 없음 (독립 실행 가능)

**영향 파일:**
- `src/pages/api/plugins/install.ts` (개선)
- `migrations/` (새 마이그레이션 파일 - installed_plugins 컬럼 추가)

### Task 1-2: 설치 상태 API 구현 (REQ-003)

**목표:** 로컬 설치 목록을 반환하여 스토어 페이지에서 설치 상태를 비교할 수 있도록 함

**작업 내역:**
- `GET /api/plugins/install-status` 엔드포인트 생성
- `installed_plugins` 테이블에서 id, installed_version, status 반환
- HQ 카탈로그 버전과 비교하여 "update_available" 판단 로직

**의존성:** Task 1-1 (컬럼 추가)

**영향 파일:**
- `src/pages/api/plugins/install-status.ts` (신규)

### Task 1-3: 스토어 페이지 개선 (REQ-003)

**목표:** 설치 상태 배지와 플러그인 상세 뷰 추가

**작업 내역:**
- `store.astro`에서 `/api/plugins/install-status` 호출하여 상태 비교
- 각 플러그인 카드에 "설치" / "설치됨" / "업데이트 가능" 배지 표시
- 플러그인 클릭 시 상세 모달 (또는 `/plugins/store/[id].astro`) 표시
  - 설명, 스크린샷, 권한 요청 목록, 버전 이력, 평점
- 설치 버튼 클릭 시 `POST /api/plugins/install` 호출
- 설치 진행 상태 표시 (다운로드 중, 추출 중, 완료)

**의존성:** Task 1-1, Task 1-2

**영향 파일:**
- `src/pages/plugins/store.astro` (개선)
- `src/pages/plugins/store/[id].astro` (신규, 선택사항)
- React 컴포넌트: `PluginDetailModal`, `InstallStatusBadge`

### Task 1-4: 리빌드 알림 및 트리거 (REQ-005)

**목표:** 파일 추출 후 리빌드 필요 상태 관리 및 빌드 트리거

**작업 내역:**
- `installed_plugins.status` 확장: `installed_pending_rebuild`, `building`, `build_failed`
- `POST /api/plugins/rebuild` 엔드포인트 생성
  - `Bun.spawn` 또는 `child_process.exec`로 `bun run build` 실행
  - 빌드 상태를 파일 또는 DB에 기록
  - 빌드 완료 시 상태를 `active`로 갱신
- Admin UI에 "리빌드 필요" 배너 컴포넌트
- 리빌드 진행 상태 폴링 (`GET /api/plugins/rebuild-status`)

**의존성:** Task 1-1

**영향 파일:**
- `src/pages/api/plugins/rebuild.ts` (신규)
- `src/pages/api/plugins/rebuild-status.ts` (신규)
- Admin 컴포넌트: `RebuildBanner`, `RebuildProgress`

### Task 1-5: 플러그인 마이그레이션 시스템 (REQ-006)

**목표:** 플러그인이 DB 마이그레이션을 포함할 경우 자동 실행

**작업 내역:**
- `plugin_migrations_local` 테이블 생성 마이그레이션
- `POST /api/plugins/migrate` 엔드포인트 생성
  - `src/plugins/local/{id}/migrations/` 스캔
  - 파일명 순서대로 실행 (NNNN_description.sql)
  - 이미 실행된 파일 스킵
  - 실행 결과 기록 (성공/실패, 에러 메시지)
- 설치 완료 후 자동 마이그레이션 확인 프롬프트 (Admin UI)
- 롤백 지원 (`.rollback.sql` 파일 존재 시)

**의존성:** Task 1-1 (파일 추출이 먼저 완료되어야 함)

**영향 파일:**
- `src/pages/api/plugins/migrate.ts` (신규)
- `migrations/` (plugin_migrations_local 테이블 생성)

---

## Phase 2: Submit Pipeline (높은 우선순위)

로컬에서 개발한 플러그인을 HQ에 제출하는 플로우를 구현한다.

### Task 2-1: 로컬 플러그인 탐지 API (REQ-001)

**목표:** `src/plugins/local/` 디렉토리의 플러그인을 파일시스템에서 탐지하여 목록 반환

**작업 내역:**
- `GET /api/plugins/local` 엔드포인트 생성
- `src/plugins/local/*/manifest.json` 파일시스템 스캔
- manifest 파싱 및 유효성 검증
- 각 플러그인의 파일 목록, 총 크기 계산
- HQ 제출 이력 조회 (선택사항: HQ API 호출 또는 로컬 캐시)

**의존성:** 없음 (독립 실행 가능)

**영향 파일:**
- `src/pages/api/plugins/local.ts` (신규)

### Task 2-2: 자동 패키징 및 제출 API (REQ-002)

**목표:** 로컬 플러그인을 zip으로 패키징하여 HQ에 제출

**작업 내역:**
- `POST /api/plugins/submit` 엔드포인트 생성
- manifest 유효성 검증 (`validateManifest` 재사용)
- 파일 읽기 -> zip 생성 (JSZip/fflate)
- Base64 인코딩
- HQ `handleSubmitPlugin` API 호출
- 진행 상태 반환 (검증 -> 패키징 -> 전송 -> 완료)

**의존성:** Task 2-1 (로컬 탐지 API)

**영향 파일:**
- `src/pages/api/plugins/submit.ts` (신규)

### Task 2-3: Admin UI 플러그인 관리 탭 (REQ-001, REQ-002)

**목표:** 로컬 플러그인 목록과 제출 기능을 Admin UI에 통합

**작업 내역:**
- 관리자 플러그인 관리 페이지에 "로컬 플러그인" 탭 추가
- 각 플러그인에 "HQ에 제출" 버튼
- 제출 전 manifest 미리보기 (이름, 버전, 권한, 파일 목록)
- 제출 진행 상태 모달 (단계별 진행 표시)
- 제출 완료/실패 알림

**의존성:** Task 2-1, Task 2-2

**영향 파일:**
- Admin 플러그인 관리 페이지 (개선 또는 신규 탭)
- React 컴포넌트: `LocalPluginList`, `SubmitPluginModal`, `SubmitProgress`

---

## Phase 3: Runtime (보통 우선순위)

런타임 SDK 위반 보고를 HQ에 연동한다.

### Task 3-1: SDK 위반 보고 연동 (REQ-007)

**목표:** 플러그인 런타임 위반을 HQ에 자동 보고

**작업 내역:**
- `plugin-sdk.ts`의 권한 체크 함수에 위반 보고 훅 추가
- HQ `/api/plugins/violations/report` API 비동기 호출 (fire-and-forget)
- 보고 실패 시 로컬 큐에 저장, 다음 기회에 재전송
- 로컬 위반 카운터 (메모리 내)
- 임계값 초과 시 자동 비활성화 (`toggle.ts` 호출)
- `violations.astro` 대시보드에 로컬 위반 이력 표시 연동

**의존성:** 없음 (독립 실행 가능하나 Phase 1 완료 후 테스트 용이)

**영향 파일:**
- `src/lib/plugin-sdk.ts` (개선)
- `src/pages/api/plugins/toggle.ts` (자동 비활성화 트리거 추가)

---

## 의존성 그래프

```
Phase 1 (Install):
  Task 1-1 (install 개선) ─┬─> Task 1-2 (install-status API)
                            │
                            ├─> Task 1-3 (store 개선) ← Task 1-2
                            │
                            ├─> Task 1-4 (rebuild)
                            │
                            └─> Task 1-5 (migration)

Phase 2 (Submit):
  Task 2-1 (local 탐지) ──> Task 2-2 (submit API) ──> Task 2-3 (admin UI)

Phase 3 (Runtime):
  Task 3-1 (violation 보고) - 독립 실행 가능
```

---

## 기술적 결정 사항

### zip 라이브러리 선택

**fflate 추천:**
- 경량 (8KB gzip), 순수 JavaScript
- Cloudflare Workers 호환
- 압축/해제 모두 지원
- 대안: JSZip (더 큰 번들 사이즈, 더 많은 기능)

### 파일시스템 접근 전략

개발 서버(`bun run dev`) 환경에서는 Node.js `fs` 모듈을 통해 파일시스템에 접근 가능하다. Cloudflare Workers 프로덕션에서는 불가능하므로, 파일 추출/제출은 개발 환경에서만 동작하도록 명시적 가드를 추가한다.

```
// 환경 감지 패턴
const isDev = import.meta.env.DEV;
if (!isDev) {
  return error("Plugin file operations are only available in development mode");
}
```

### 리빌드 트리거 전략

**접근 방식:** `Bun.spawn`으로 `bun run build` 실행
- 빌드 상태를 임시 파일(`/tmp/plugin-rebuild-status.json`)에 기록
- 폴링 API(`GET /api/plugins/rebuild-status`)로 상태 확인
- 향후 SSE(Server-Sent Events)로 개선 가능

### 체크섬 검증

- HQ download API 응답에 `packageHash` (SHA-256) 포함
- 다운로드 후 로컬에서 SHA-256 계산하여 비교
- Web Crypto API (`crypto.subtle.digest`) 사용 (Workers 호환)

---

## 리스크 분석

### 리스크 1: 파일시스템 접근 제한

**설명:** Cloudflare Workers 프로덕션 환경에서 `fs` 모듈 사용 불가
**영향:** 플러그인 설치/제출이 프로덕션에서 동작하지 않음
**완화:** 개발 환경 전용으로 명시, 프로덕션은 빌드 파이프라인으로 해결 (CI/CD에서 설치 -> 빌드 -> 배포)
**가능성:** 높음 (아키텍처적 제약)

### 리스크 2: 리빌드 시간

**설명:** `astro build`가 오래 걸릴 수 있음 (프로젝트 크기에 따라 30초~5분)
**영향:** 관리자가 긴 대기 시간을 경험
**완화:** 비동기 빌드 + 상태 폴링, 빌드 중 다른 작업 가능하도록 UI 설계
**가능성:** 중간

### 리스크 3: zip 경로 순회 공격

**설명:** 악의적 zip 파일이 `../../` 경로로 시스템 파일 덮어쓰기 시도
**영향:** 보안 취약점
**완화:** 추출 전 모든 엔트리 경로를 검증하여 대상 디렉토리 외부 접근 차단
**가능성:** 낮음 (HQ에서 검증된 번들만 배포하지만 방어적 코딩 필요)

### 리스크 4: 동시 설치 충돌

**설명:** 여러 플러그인을 동시에 설치할 때 빌드 충돌
**영향:** 빌드 실패 또는 불완전한 설치
**완화:** 설치 큐 시스템 (한 번에 하나만 설치 진행) 또는 모든 설치 완료 후 단일 리빌드
**가능성:** 낮음 (일반적으로 한 번에 하나씩 설치)

---

## 마일스톤 요약

| 마일스톤 | 포함 Task | 우선순위 |
|----------|----------|----------|
| M1: 핵심 설치 파이프라인 | Task 1-1, 1-2 | 최고 |
| M2: 스토어 UI 완성 | Task 1-3, 1-4 | 높음 |
| M3: 마이그레이션 시스템 | Task 1-5 | 높음 |
| M4: 제출 파이프라인 | Task 2-1, 2-2, 2-3 | 높음 |
| M5: 런타임 보호 | Task 3-1 | 보통 |
