# SPEC-PLUGIN-MARKETPLACE-001: Plugin Marketplace System

## TAG BLOCK

```
TAG: SPEC-PLUGIN-MARKETPLACE-001
TYPE: feature
DOMAIN: plugin-marketplace
STATUS: planned
PRIORITY: high
ASSIGNED: TBD
```

## Environment

### 시스템 개요

Clinic-OS Plugin Marketplace는 서드파티 개발자가 플러그인을 개발, 제출, 승인받아 공개 저장소에서 배포할 수 있는 생태계 시스템입니다.

### 현재 상태

**기존 인프라스트럭처 (완료됨):**
- 로컬 플러그인 시스템: `src/plugins/local/` 폴더 기반 개발
- 코어 플러그인: `src/plugins/` 폴더에 내장
- 플러그인 로더: `src/lib/plugin-loader.ts` - Vite import.meta.glob 기반 빌드타임 로딩
- 플러그인 SDK: `src/lib/plugin-sdk.ts` - 권한 정의, 보안 스캔, 훅 시스템
- HQ 서버: `hq/` - Cloudflare Workers 기반 API 서버

**데이터베이스 스키마 (기존 완료됨):**
- `plugin_developers`: 개발자 계정 (신뢰 등급, 상태)
- `plugins`: 플러그인 메타데이터
- `plugin_versions`: 버전 관리, 리뷰 상태
- `plugin_reviews`: 리뷰 이력
- `plugin_installs`: 클라이언트별 설치 현황
- `plugin_ratings`: 사용자 평점
- `plugin_access`: 접근 권한 (유료 플러그인)
- `plugin_purchases`: 구매 기록
- `plugin_categories`: 카테고리 정의
- `plugin_scan_rules`: 보안 스캔 규칙

### 기술 스택

**HQ 서버:**
- Cloudflare Workers
- Hono 프레임워크
- D1 데이터베이스 (SQLite)
- R2 스토리지 (플러그인 코드 저장)
- JWT 인증

**클라이언트:**
- Astro
- React
- TypeScript
- Vite

## Assumptions

1. **개발자 계정**: Clinic-OS 라이선스를 보유한 사용자만 개발자 등록 가능
2. **신뢰 등급 시스템**: `official` > `verified` > `basic` 순으로 리뷰 우선순위 차등
3. **보안 스캔**: 자동 스캔 통과는 최소 조건, 수동 리뷰 필수
4. **버전 관리**: 시맨틱 버전닝 (Semantic Versioning) 준수
5. **저장소 공간**: R2 스토리지를 통해 플러그인 소스 코드 압축 저장
6. **라이선스 검증**: 클라이언트의 유효한 라이선스 키로 접근 권한 확인

## Requirements (EARS Format)

### REQ-PLUGIN-001: 로컬 플러그인 개발 지원

**Ubiquitous:** 시스템은 개발자가 로컬 환경에서 플러그인을 개발하고 테스트할 수 있어야 한다.

**WHEN** 개발자가 `src/plugins/local/{plugin-id}/` 폴더에 플러그인을 생성하면 **THEN** 시스템은 다음 빌드 시 자동으로 플러그인을 로드해야 한다.

**WHILE** 로컬 플러그인이 코어 플러그인과 동일한 ID를 가지면 **THEN** 로컬 버전이 우선 적용되어야 한다.

**IF** 플러그인에 `manifest.json` 파일이 없으면 **THEN** 시스템은 플러그인을 로드하지 않고 경고를 출력해야 한다.

### REQ-PLUGIN-002: 플러그인 제출 기능

**WHEN** 인증된 개발자가 플러그인을 HQ 서버에 제출하면 **THEN** 시스템은 제출을 수신하고 검증을 시작해야 한다.

**IF** 개발자가 `official` 또는 `verified` 등급이 아니면 **THEN** 시스템은 제출을 거부하고 개발자 등록을 요구해야 한다.

**WHEN** 제출이 수신되면 **THEN** 시스템은 다음 검증을 수행해야 한다:
- manifest.json 스키마 유효성
- 필수 파일 존재 확인 (README.md, CHANGELOG.md)
- 보안 스캔 (위험 패턴 검출)
- 버전 형식 검증 (시맨틱 버전닝)

**IF** 검증에 실패하면 **THEN** 시스템은 구체적인 오류 메시지와 함께 제출을 거부해야 한다.

### REQ-PLUGIN-003: 개발자 라이선스 검증

**WHEN** 사용자가 개발자 등록을 요청하면 **THEN** 시스템은 클라이언트 라이선스를 검증해야 한다.

**IF** 라이선스가 유효하지 않거나 만료되었으면 **THEN** 시스템은 등록을 거부해야 한다.

**WHEN** 개발자가 제출을 생성하면 **THEN** 시스템은 개발자 등급(`trust_level`)을 확인해야 한다.

**IF** `trust_level`이 `basic`이고 제출이 `restricted` 카테고리면 **THEN** 시스템은 제출을 제한해야 한다.

### REQ-PLUGIN-004: 관리자 리뷰 워크플로우

**WHEN** 플러그인 제출이 검증을 통과하면 **THEN** 시스템은 제출을 리뷰 대기열에 추가해야 한다.

**IF** 개발자가 `official` 등급이면 **THEN** 시스템은 리뷰 우선순위를 상위로 설정해야 한다.

**WHEN** 관리자가 제출을 승인하면 **THEN** 시스템은 다음 작업을 수행해야 한다:
- 플러그인 상태를 `active`로 변경
- 공개 저장소에 표시
- 개발자의 `total_plugins` 카운트 증가
- 승인 이벤트 로그 기록

**WHEN** 관리자가 제출을 거부하면 **THEN** 시스템은 다음 작업을 수행해야 한다:
- 제출 상태를 `rejected`로 변경
- 거부 사유를 개발자에게 전송
- 개발자에게 수정 재제출 허용

### REQ-PLUGIN-005: 플러그인 스토어 발견

**WHEN** 사용자가 공개 저장소에 접근하면 **THEN** 시스템은 `active` 상태의 모든 플러그인을 표시해야 한다.

**WHEN** 사용자가 카테고리, 검색어, 필터를 적용하면 **THEN** 시스템은 해당 조건에 맞는 플러그인만 표시해야 한다.

**IF** 플러그인이 `restricted` 접근 타입이면 **THEN** 시스템은 접근 권한이 있는 사용자에게만 표시해야 한다.

**WHEN** 사용자가 플러그인 상세 페이지를 조회하면 **THEN** 시스템은 다음 정보를 제공해야 한다:
- 플러그인 이름, 설명, 스크린샷
- 개발자 정보 (신뢰 등급 포함)
- 사용자 평점 및 리뷰
- 요구 권한 목록
- 가격 정보 (유료 플러그인)

### REQ-PLUGIN-006: 플러그인 설치 흐름

**WHEN** 사용자가 플러그인을 설치하려고 하면 **THEN** 시스템은 다음 확인을 수행해야 한다:
- 사용자의 라이선스 유효성
- 플러그인 접근 권한 (유료 플러그인)
- 충분한 저장소 공간

**IF** 플러그인이 유료이고 사용자가 구매하지 않았으면 **THEN** 시스템은 결제 안내를 표시해야 한다.

**WHEN** 권한 검토를 통과하면 **THEN** 시스템은 요청 권한 목록을 표시하고 사용자 동의를 요구해야 한다.

**WHEN** 사용자가 설치를 확인하면 **THEN** 시스템은 다음 작업을 수행해야 한다:
- R2 스토리지에서 플러그인 코드 다운로드
- 클라이언트의 `src/plugins/local/` 폴더에 압축 해제
- `plugin_installs` 테이블에 설치 기록
- 플러그인 활성화

### REQ-PLUGIN-007: 플러그인 업데이트

**WHEN** 설치된 플러그인의 새 버전이 출시되면 **THEN** 시스템은 사용자에게 업데이트 알림을 표시해야 한다.

**IF** 새 버전이 주요 버전 업데이트(Major)이면 **THEN** 시스템은 변경사항 요약을 표시해야 한다.

**WHEN** 사용자가 업데이트를 확인하면 **THEN** 시스템은 기존 플러그인을 백업하고 새 버전을 설치해야 한다.

**IF** 업데이트 후 문제가 발생하면 **THEN** 시스템은 이전 버전으로 롤백할 수 있어야 한다.

### REQ-PLUGIN-008: 보안 및 샌드박싱

**WHILE** 플러그인이 실행 중이면 **THEN** 시스템은 다음 샌드박싱을 적용해야 한다:
- 허용된 권한 외 접근 차단
- 내부 네트워크 접근 차단 (localhost, 192.168.x.x, 10.x.x.x)
- 파일 시스템 접근 제한 (플러그인 전용 저장소만)

**IF** 플러그인이 위반 행위를 감지되면 **THEN** 시스템은 즉시 플러그인을 비활성화하고 관리자에게 알려야 한다.

### REQ-PLUGIN-009: 통계 및 모니터링

**Ubiquitous:** 시스템은 다음 통계를 수집하고 제공해야 한다:
- 플러그인별 다운로드 수
- 활성 설치 수
- 사용자 평점 평균
- 개발자별 수익 (유료 플러그인)

**WHEN** 관리자가 통계 대시보드를 조회하면 **THEN** 시스템은 시각화된 차트와 테이블을 제공해야 한다.

## Specifications

### 데이터베이스 스키마 (기존 + 추가)

**기존 테이블 (사용):**
- `plugin_developers`, `plugins`, `plugin_versions`, `plugin_reviews`, `plugin_installs`, `plugin_ratings`, `plugin_access`, `plugin_purchases`

**추가 필요 테이블:**

```sql
-- 플러그인 제출 로그 (제출 흐름 추적)
CREATE TABLE IF NOT EXISTS plugin_submissions (
    id TEXT PRIMARY KEY,
    plugin_version_id TEXT NOT NULL REFERENCES plugin_versions(id),
    developer_id TEXT NOT NULL REFERENCES plugin_developers(id),

    -- 제출 메타데이터
    submitted_at INTEGER NOT NULL DEFAULT (unixepoch()),
    submitted_from TEXT, -- IP, User-Agent

    -- 검증 결과
    validation_status TEXT NOT NULL, -- 'pending' | 'passed' | 'failed'
    validation_errors TEXT, -- JSON array
    security_scan_result TEXT, -- JSON object

    -- 제출 상태
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'

    INDEX (developer_id, submitted_at),
    INDEX (validation_status),
    INDEX (status)
);

-- 플러그인 다운로드 로그 (사용 통계)
CREATE TABLE IF NOT EXISTS plugin_downloads (
    id TEXT PRIMARY KEY,
    plugin_version_id TEXT NOT NULL REFERENCES plugin_versions(id),
    client_id TEXT REFERENCES clients(id),

    downloaded_at INTEGER NOT NULL DEFAULT (unixepoch()),
    download_source TEXT, -- 'store' | 'update' | 'admin'

    INDEX (plugin_version_id, downloaded_at),
    INDEX (client_id)
);

-- 플러그인 위반 보고 (보안 모니터링)
CREATE TABLE IF NOT EXISTS plugin_violations (
    id TEXT PRIMARY KEY,
    plugin_id TEXT NOT NULL REFERENCES plugins(id),
    install_id TEXT REFERENCES plugin_installs(id),

    violation_type TEXT NOT NULL, -- 'permission' | 'network' | 'security'
    violation_details TEXT, -- JSON object
    detected_at INTEGER NOT NULL DEFAULT (unixepoch()),
    resolved_at INTEGER,
    status TEXT DEFAULT 'active', -- 'active' | 'resolved' | 'false_positive'

    INDEX (plugin_id, detected_at),
    INDEX (status)
);
```

### API 엔드포인트 설계

**개발자 API:**

```typescript
// 개발자 정보 조회
GET /api/plugins/developer/me
// Response: { id, name, email, trust_level, status, total_plugins }

// 제출 생성
POST /api/plugins/submit
// Body: { plugin_id, version, manifest, code_bundle_url }
// Response: { submission_id, validation_status }

// 내 제출 목록
GET /api/plugins/developer/submissions
// Query: ?status=pending&limit=20
// Response: { submissions: [...] }

// 제출 수정 재제출
PUT /api/plugins/submissions/:id/resubmit
// Body: { manifest, code_bundle_url }
```

**관리자 API (기존 확장):**

```typescript
// 리뷰 대기열 (기존)
GET /api/admin/plugins/review-queue

// 제출 상세 조회
GET /api/admin/plugins/submissions/:id
// Response: { submission, plugin, developer, validation_result }

// 제출 승인/거부 (기존)
POST /api/admin/plugins/versions/:versionId/approve
POST /api/admin/plugins/versions/:versionId/reject

// 위반 보고 목록
GET /api/admin/plugins/violations
// Query: ?status=active&plugin_id=xxx
```

**공개 스토어 API:**

```typescript
// 플러그인 목록 (기존)
GET /api/plugins
// Query: ?category=integration&search=payment&access=public

// 플러그인 상세 (기존)
GET /api/plugins/:id

// 플러그인 다운로드 (새로 추가)
POST /api/plugins/:id/download
// Body: { client_id, license_key }
// Response: { download_url, version, checksum }

// 내 설치 플러그인
GET /api/plugins/installed
// Headers: Authorization: Bearer {token}
// Response: { installed: [...] }
```

**클라이언트 설치 API:**

```typescript
// 로컬 플러그인 목록
GET /api/plugins/local
// Response: { local_plugins: [...] }

// 플러그인 설치
POST /api/plugins/install
// Body: { plugin_id, version_id, permissions_accepted }
// Response: { install_id, status }

// 플러그인 업데이트
PUT /api/plugins/:install_id/update
// Response: { install_id, new_version_id }

// 플러그인 제거
DELETE /api/plugins/:install_id
// Response: { success: true }
```

### 보안 고려사항

1. **R2 스토리지 서명된 URL**: 다운로드 URL은 만료 기간이 있는 서명된 URL로 제공
2. **코드 검증**: 설치 전 체크섬 검증 및 위변조 방지
3. **권한 관리**: 최소 권한 원칙, 명시적인 사용자 동의 필요
4. **샌드박스 실행**: Cloudflare Workers 격리 환경에서 플러그인 코드 실행
5. **속도 제한**: API 엔드포인트에 Rate Limiting 적용

### 사용자 흐름

**개발자 제출 흐름:**
1. 로컬에서 플러그인 개발 (`src/plugins/local/`)
2. 제출 CLI 도구로 패키징 및 업로드
3. 자동 검증 (manifest, 보안 스캔)
4. 검증 통과 시 리뷰 대기열 대기
5. 관리자 리뷰 및 승인/거부
6. 승인 시 공개 저장소에 게시

**관리자 리뷰 흐름:**
1. 리뷰 대시보드에서 대기열 확인
2. 제출 상세 조회 (코드, 매니페스트, 스캔 결과)
3. 수동 코드 리뷰
4. 승인 또는 거부 결정 (피드백 포함)
5. 결정 알림 전송

**클라이언트 설치 흐름:**
1. 스토어에서 플러그인 발견
2. 상세 정보 확인 (권한, 리뷰, 가격)
3. 설치 클릭
4. 라이선스 검증 (유료 플러그인)
5. 권한 동의
6. 다운로드 및 설치
7. 자동 활성화

## Traceability

**관련 SPEC:**
- SPEC-AUTH-001: JWT 인증 시스템 (개발자 인증에 활용)
- SPEC-LICENSE-XXX: 라이선스 검증 시스템 (유료 플러그인 접근 제어)

**의존 모듈:**
- `src/lib/plugin-loader.ts`: 플러그인 로딩 시스템
- `src/lib/plugin-sdk.ts`: 권한 및 보안 시스템
- `hq/src/index.js`: HQ API 서버

**통합 포인트:**
- 관리자 대시보드: `/admin/hub/plugin-marketplace/`
- 스토어 프론트엔드: `/plugins/store`
- 개발자 포털: `/plugins/developer`
