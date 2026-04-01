# Plugin Marketplace System Test Plan

## TAG BLOCK

```
TAG: SPEC-PLUGIN-MARKETPLACE-001
TYPE: test-plan
DOMAIN: plugin-marketplace
STATUS: planned
PRIORITY: high
VERSION: 1.0.0
CREATED: 2026-02-10
```

## Test Overview

### 테스트 범위

이 테스트 계획은 Clinic-OS Plugin Marketplace 시스템의 핵심 기능을 검증하기 위한 포괄적인 수동 테스트 시나리오를 제공합니다.

**테스트 대상 시스템 구성요소:**
1. 개발자 등록 및 인증 시스템
2. 플러그인 제출 및 검증 워크플로우
3. 관리자 리뷰 시스템
4. 플러그인 스토어 탐색 및 검색
5. 플러그인 설치 및 업데이트
6. 개발자 포털 대시보드

### 테스트 환경

**필요 환경:**
- Clinic-OS 클라이언트 (개발 모드)
- HQ 서버 (Cloudflare Workers 로컬 또는 스테이징)
- 테스트 데이터베이스 (D1)
- 테스트용 R2 스토리지 버킷

**테스트 도구:**
- Postman/Insomnia (API 테스트)
- 브라우저 개발자 도구
- Wrangler (Cloudflare Workers 로컬 테스트)

---

## Test Data Setup

### 1. 기본 테스트 사용자 생성

```sql
-- 테스트 관리자
INSERT INTO users (id, email, role, license_key, license_expires_at) VALUES
('admin-test-001', 'admin-test@clinic-os.test', 'admin', 'LICENSE-ADMIN-001', '2030-12-31');

-- 테스트 개발자 (Official 등급)
INSERT INTO users (id, email, role, license_key, license_expires_at) VALUES
('dev-test-001', 'dev-official@clinic-os.test', 'developer', 'LICENSE-DEV-001', '2030-12-31');

INSERT INTO plugin_developers (id, user_id, name, trust_level, status, total_plugins) VALUES
('dev-official-001', 'dev-test-001', 'Official Test Developer', 'official', 'active', 0);

-- 테스트 개발자 (Verified 등급)
INSERT INTO users (id, email, role, license_key, license_expires_at) VALUES
('dev-test-002', 'dev-verified@clinic-os.test', 'developer', 'LICENSE-DEV-002', '2030-12-31');

INSERT INTO plugin_developers (id, user_id, name, trust_level, status, total_plugins) VALUES
('dev-verified-001', 'dev-test-002', 'Verified Test Developer', 'verified', 'active', 0);

-- 테스트 개발자 (Basic 등급)
INSERT INTO users (id, email, role, license_key, license_expires_at) VALUES
('dev-test-003', 'dev-basic@clinic-os.test', 'developer', 'LICENSE-DEV-003', '2030-12-31');

INSERT INTO plugin_developers (id, user_id, name, trust_level, status, total_plugins) VALUES
('dev-basic-001', 'dev-test-003', 'Basic Test Developer', 'basic', 'active', 0);

-- 테스트 최종 사용자
INSERT INTO users (id, email, role, license_key, license_expires_at) VALUES
('user-test-001', 'user-test@clinic-os.test', 'user', 'LICENSE-USER-001', '2030-12-31');

-- 만료된 라이선스 사용자 (부정 케이스용)
INSERT INTO users (id, email, role, license_key, license_expires_at) VALUES
('user-expired-001', 'user-expired@clinic-os.test', 'developer', 'LICENSE-EXPIRED-001', '2020-12-31');
```

### 2. 테스트용 플러그인 샘플 데이터

```sql
-- 카테고리
INSERT INTO plugin_categories (id, name, slug, description, icon) VALUES
('cat-001', 'Integration', 'integration', 'Third-party service integrations', 'extension'),
('cat-002', 'UI Enhancement', 'ui-enhancement', 'User interface improvements', 'palette'),
('cat-003', 'Automation', 'automation', 'Workflow automation tools', 'zap'),
('cat-004', 'Reporting', 'reporting', 'Custom reports and exports', 'chart'),
('cat-005', 'Restricted', 'restricted', 'Restricted access enterprise features', 'lock');

-- 활성 플러그인 (스토어 표시용)
INSERT INTO plugins (id, developer_id, name, slug, description, category_id, access_type, status, current_version_id) VALUES
('plugin-active-001', 'dev-official-001', 'Payment Integration', 'payment-integration', 'Stripe payment gateway integration', 'cat-001', 'public', 'active', NULL),
('plugin-active-002', 'dev-verified-001', 'Dark Mode Plus', 'dark-mode-plus', 'Enhanced dark mode with custom themes', 'cat-002', 'public', 'active', NULL),
('plugin-active-003', 'dev-official-001', 'Auto Scheduler', 'auto-scheduler', 'Automated appointment scheduling', 'cat-003', 'public', 'active', NULL),
('plugin-restricted-001', 'dev-official-001', 'Enterprise Analytics', 'enterprise-analytics', 'Advanced analytics dashboard', 'cat-005', 'restricted', 'active', NULL);

-- 플러그인 버전
INSERT INTO plugin_versions (id, plugin_id, version, changelog, review_status, created_at) VALUES
('ver-001', 'plugin-active-001', '1.0.0', 'Initial release', 'approved', unixepoch() - 86400 * 30),
('ver-002', 'plugin-active-002', '2.1.0', 'Added custom theme support', 'approved', unixepoch() - 86400 * 15),
('ver-003', 'plugin-active-003', '1.5.0', 'Bug fixes and performance improvements', 'approved', unixepoch() - 86400 * 7),
('ver-004', 'plugin-restricted-001', '1.0.0', 'Enterprise analytics initial release', 'approved', unixepoch() - 86400 * 5);

-- 플러그인 현재 버전 업데이트
UPDATE plugins SET current_version_id = 'ver-001' WHERE id = 'plugin-active-001';
UPDATE plugins SET current_version_id = 'ver-002' WHERE id = 'plugin-active-002';
UPDATE plugins SET current_version_id = 'ver-003' WHERE id = 'plugin-active-003';
UPDATE plugins SET current_version_id = 'ver-004' WHERE id = 'plugin-restricted-001';

-- 플러그인 평점
INSERT INTO plugin_ratings (id, plugin_id, user_id, rating, comment, created_at) VALUES
('rating-001', 'plugin-active-001', 'user-test-001', 5, 'Excellent payment integration!', unixepoch() - 86400 * 20),
('rating-002', 'plugin-active-002', 'user-test-001', 4, 'Great dark mode but needs more themes', unixepoch() - 86400 * 10);
```

### 3. 테스트용 플러그인 코드 샘플

**유효한 플러그인 구조:**
```
test-plugin-valid/
├── manifest.json
├── index.ts
├── README.md
├── CHANGELOG.md
└── assets/
    └── icon.png
```

**manifest.json (유효한 예시):**
```json
{
  "id": "test-plugin-valid",
  "name": "Test Plugin Valid",
  "version": "1.0.0",
  "description": "A valid test plugin for submission testing",
  "author": "dev-test-001",
  "category": "integration",
  "permissions": ["read:patients"],
  "entry": "index.ts",
  "icon": "assets/icon.png"
}
```

**보안 취약점이 있는 플러그인 (부정 테스트용):**
```javascript
// test-plugin-vulnerable/index.ts
// 이 코드는 eval() 사용으로 보안 스캔에서 실패해야 합니다

export function processUserData(data: string) {
  // VULNERABLE: eval() usage should be detected
  const result = eval(data);
  return result;
}
```

---

## Test Scenario 1: Developer Registration Flow

### 목표
사용자가 개발자 계정을 등록하고 라이선스 검증이 올바르게 작동하는지 확인합니다.

### 전제 조건
- Clinic-OS 클라이언트가 설치되어 있고 실행 중
- 유효한 Clinic-OS 라이선스 키를 보유한 사용자 계정

### 테스트 케이스

#### TC-DEV-001: 유효한 라이선스로 개발자 등록 성공

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 사용자가 로그인 상태로 `/plugins/developer` 페이지 접속 | 개발자 포털 페이지 표시 |
| 2 | "개발자 등록" 버튼 클릭 | 개발자 등록 폼 표시 |
| 3 | 개발자 이름 입력 후 "등록" 클릭 | 라이선스 검증 진행 |
| 4 | 라이선스가 유효하면 개발자 프로필 생성 | `trust_level='basic'`으로 설정된 개발자 계정 생성 |
| 5 | 개발자 대시보드로 리다이렉션 | 개발자 통계, 제출 현황 표시 |

**검증 항목:**
- [ ] `plugin_developers` 테이블에 새 레코드 생성
- [ ] `trust_level`이 'basic'으로 설정
- [ ] `status`가 'active'로 설정
- [ ] 성공 메시지 표시

#### TC-DEV-002: 만료된 라이선스로 개발자 등록 실패

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 만료된 라이선스 사용자(`user-expired-001`)로 로그인 | 로그인 성공 |
| 2 | `/plugins/developer` 페이지 접속 | 개발자 포털 페이지 표시 |
| 3 | "개발자 등록" 버튼 클릭 | 등록 폼 표시 |
| 4 | 개발자 이름 입력 후 "등록" 클릭 | 라이선스 검증 실패 |
| 5 | 에러 메시지 표시 | "라이선스가 만료되었습니다" 메시지 |

**검증 항목:**
- [ ] 403 상태 코드 반환
- [ ] "License expired" 또는 동등한 메시지 표시
- [ ] `plugin_developers` 테이블에 레코드 생성 안 됨

#### TC-DEV-003: 중복 개발자 등록 방지

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 이미 개발자로 등록된 계정으로 로그인 | 로그인 성공 |
| 2 | `/plugins/developer` 페이지 접속 | 개발자 포털 표시 |
| 3 | 등록 폼 접근 시도 | 등록 완료 상태 표시 |

**검증 항목:**
- [ ] 이미 등록된 개발자임을 나타내는 UI 표시
- [ ] 중복 등록 방지

---

## Test Scenario 2: Plugin Submission with Security Scanning

### 목표
개발자가 플러그인을 제출하고 자동 검증 및 보안 스캔이 올바르게 작동하는지 확인합니다.

### 전제 조건
- 개발자 계정으로 로그인 (`dev-basic-001`)
- 제출할 플러그인 코드 준비 완료

### 테스트 케이스

#### TC-SUBMIT-001: 유효한 플러그인 제출 성공

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 개발자 포털에서 "새 플러그인 제출" 클릭 | 제출 폼 표시 |
| 2 | 플러그인 ZIP 파일 업로드 | 파일 업로드 성공 |
| 3 | manifest.json 자동 검증 | 검증 통과 |
| 4 | 보안 스캔 자동 실행 | 스캔 통과 (no critical issues) |
| 5 | 제출 완료 메시지 표시 | `submission_id` 반환 |
| 6 | 리뷰 대기열에 추가 | `status='pending'` |

**검증 항목:**
- [ ] 201 상태 코드 반환
- [ ] `plugin_submissions` 테이블에 레코드 생성
- [ ] `plugin_versions` 테이블에 `review_status='pending'` 레코드 생성
- [ ] `validation_status='passed'`로 설정
- [ ] 성공 메시지에 제출 ID 포함

**API 테스트 (Postman):**
```http
POST /api/plugins/submit
Authorization: Bearer {dev-basic-token}
Content-Type: multipart/form-data

{
  "plugin_bundle": (binary file upload),
  "manifest": {...}
}
```

#### TC-SUBMIT-002: 매니페스트 누락으로 제출 실패

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | manifest.json이 없는 ZIP 파일 업로드 | 업로드 시도 |
| 2 | 자동 검증 실행 | 검증 실패 |
| 3 | 에러 메시지 표시 | "manifest.json 파일이 누락되었습니다" |

**검증 항목:**
- [ ] 400 상태 코드 반환
- [ ] `validation_errors` 배열에 구체적 오류 포함
- [ ] `validation_status='failed'`

#### TC-SUBMIT-003: 보안 취약점 감지로 제출 실패

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | eval()을 포함하는 플러그인 코드 업로드 | 업로드 성공 |
| 2 | 보안 스캔 실행 | 취약점 감지 |
| 3 | 스캔 결과 표시 | "Critical: eval() usage detected" |
| 4 | 제출 거부 | 400 상태 코드 |

**검증 항목:**
- [ ] 400 상태 코드 반환
- [ ] `security_scan_result`에 critical 심각도 이슈 포함
- [ ] 취약점 유형과 위치 식별 정보 제공

#### TC-SUBMIT-004: Basic 등급 개발자의 Restricted 카테고리 제출 제한

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | `trust_level='basic'` 개발자로 로그인 | 로그인 성공 |
| 2 | `category='restricted'` 플러그인 제출 시도 | 제출 시도 |
| 3 | 권한 확인 | 권한 부족 |
| 4 | 에러 메시지 표시 | "Developer tier insufficient" |

**검증 항목:**
- [ ] 403 상태 코드 반환
- [ ] "Developer tier insufficient" 또는 동등한 메시지
- [ ] 제출 레코드 생성 안 됨

#### TC-SUBMIT-005: 시맨틱 버전 형식 검증

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 버전이 "1.0" (형식 오류)인 플러그인 업로드 | 업로드 시도 |
| 2 | 버전 형식 검증 | 검증 실패 |
| 3 | 에러 메시지 표시 | "Invalid version format. Use semantic versioning (e.g., 1.0.0)" |

**검증 항목:**
- [ ] 400 상태 코드
- [ ] 버전 형식 오류 메시지

---

## Test Scenario 3: Admin Review Workflow

### 목표
관리자가 제출된 플러그인을 리뷰하고 승인/거부/변경 요청 워크플로우를 검증합니다.

### 전제 조건
- 관리자 계정으로 로그인 (`admin-test-001`)
- 리뷰 대기 중인 제출 존재

### 테스트 케이스

#### TC-ADMIN-001: 리뷰 대기열 조회

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 관리자로 `/admin/plugins/review-queue` 접속 | 대기열 페이지 표시 |
| 2 | 대기 중인 제출 목록 확인 | 제출 목록 표시 |
| 3 | Official 개발자 제출 우선순위 확인 | Official 제출이 목록 상단에 위치 |

**검증 항목:**
- [ ] 200 상태 코드
- [ ] 제출 배열 반환
- [ ] 각 제출에 plugin_id, developer_name, submitted_at, trust_level 포함
- [ ] trust_level 순으로 정렬 (official > verified > basic)

#### TC-ADMIN-002: 제출 상세 조회

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 대기열에서 제출 선택 | 제출 상세 페이지 표시 |
| 2 | 플러그인 정보 확인 | 이름, 설명, 버전, 카테고리 표시 |
| 3 | 개발자 정보 확인 | 이름, 이메일, 신뢰 등급 표시 |
| 4 | 검증 결과 확인 | 검증 상태, 스캔 결과 표시 |
| 5 | 코드 미리보기 확인 | 주요 파일 내용 표시 |

**검증 항목:**
- [ ] 200 상태 코드
- [ ] 제출 상세 응답에 submission, plugin, developer, validation_result 포함
- [ ] 코드 뷰어에서 주요 파일 확인 가능

**API 테스트:**
```http
GET /api/admin/plugins/submissions/{submission_id}
Authorization: Bearer {admin-token}
```

#### TC-ADMIN-003: 제출 승인

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 제출 상세 페이지에서 "승인" 클릭 | 승인 확인 대화상자 표시 |
| 2 | 승인 확인 | 승인 처리 진행 |
| 3 | 플러그인 상태 변경 | `status='active'` |
| 4 | `current_version_id` 업데이트 | 현재 버전 설정 |
| 5 | 개발자 `total_plugins` 증가 | 카운트 +1 |
| 6 | 승인 이메일 전송 | 개발자에게 알림 |
| 7 | 성공 메시지 표시 | "플러그인이 승인되었습니다" |

**검증 항목:**
- [ ] 200 상태 코드
- [ ] `plugins` 테이블에서 `status='active'`
- [ ] `plugin_versions`에서 `review_status='approved'`
- [ ] `plugin_developers`에서 `total_plugins` 증가
- [ ] 스토어에서 플러그인 표시

**API 테스트:**
```http
POST /api/admin/plugins/versions/{version_id}/approve
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "review_notes": "Excellent implementation. Approved."
}
```

#### TC-ADMIN-004: 제출 거부

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 제출 상세 페이지에서 "거부" 클릭 | 거부 사유 입력 폼 표시 |
| 2 | 거부 사유 입력 후 "거부 확인" 클릭 | 거부 처리 진행 |
| 3 | 플러그인 상태 변경 | `review_status='rejected'` |
| 4 | 거부 사유 전송 | 개발자에게 알림 |
| 5 | 성공 메시지 표시 | "제출이 거부되었습니다" |

**검증 항목:**
- [ ] 200 상태 코드
- [ ] `plugin_versions`에서 `review_status='rejected'`
- [ ] 거부 사유가 개발자 포털에 표시
- [ ] 개발자가 수정 후 재제출 가능

**API 테스트:**
```http
POST /api/admin/plugins/versions/{version_id}/reject
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "reason": "Security concerns: excessive permissions requested. Please reduce to minimum required."
}
```

#### TC-ADMIN-005: 변경 요청 (Request Changes)

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | "변경 요청" 클릭 | 변경 요청 폼 표시 |
| 2 | 변경 사항 입력 후 전송 | 요청 전송 |
| 3 | 제출 상태 유지 | `review_status='pending'` |
| 4 | 변경 요청 알림 | 개발자에게 알림 |

**검증 항목:**
- [ ] 200 상태 코드
- [ ] 변경 요청 내용이 개발자 포털에 표시
- [ ] 개발자가 수정 후 재제출 가능

---

## Test Scenario 4: Plugin Store Browsing and Installation

### 목표
사용자가 스토어에서 플러그인을 검색, 조회, 설치하는 과정을 검증합니다.

### 전제 조건
- 최종 사용자 계정으로 로그인 (`user-test-001`)
- 활성 플러그인이 스토어에 게시됨

### 테스트 케이스

#### TC-STORE-001: 공개 플러그인 목록 조회

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | `/plugins/store` 페이지 접속 | 스토어 메인 페이지 표시 |
| 2 | 활성 플러그인 목록 확인 | `status='active'` 플러그인만 표시 |
| 3 | restricted 플러그인 필터링 | 접근 권한이 없는 플러그인 제외 |
| 4 | 각 플러그인 카드 표시 | 이름, 설명, 평점, 카테고리 표시 |

**검증 항목:**
- [ ] 200 상태 코드
- [ ] 플러그인 배열 반환
- [ ] 각 플러그인에 id, name, description, category 포함
- [ ] restricted 플러그인 제외 (권한 없는 사용자)

**API 테스트:**
```http
GET /api/plugins
Authorization: Bearer {user-token}
```

#### TC-STORE-002: 카테고리 필터링

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 카테고리 필터에서 "Integration" 선택 | 필터 적용 |
| 2 | 결과 목록 확인 | Integration 카테고리 플러그인만 표시 |
| 3 | URL 확인 | `?category=integration` 쿼리 파라미터 |

**검증 항목:**
- [ ] 200 상태 코드
- [ ] 선택된 카테고리의 플러그인만 반환
- [ ] 필터 상태가 UI에 표시

**API 테스트:**
```http
GET /api/plugins?category=integration
Authorization: Bearer {user-token}
```

#### TC-STORE-003: 검색 기능

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 검색창에 "payment" 입력 후 검색 | 검색 실행 |
| 2 | 결과 목록 확인 | 이름/설명에 "payment" 포함된 플러그인만 표시 |
| 3 | 검색 결과 강조 | 일치 텍스트 하이라이트 |

**검증 항목:**
- [ ] 200 상태 코드
- [ ] 검색어와 일치하는 플러그인만 반환
- [ ] 검색 결과 수 표시

**API 테스트:**
```http
GET /api/plugins?search=payment
Authorization: Bearer {user-token}
```

#### TC-STORE-004: 플러그인 상세 조회

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 플러그인 카드 클릭 | 상세 페이지 이동 |
| 2 | 기본 정보 확인 | 이름, 설명, 스크린샷 표시 |
| 3 | 개발자 정보 확인 | 개발자 이름, 신뢰 등급 표시 |
| 4 | 평점 및 리뷰 확인 | 평균 평점, 리뷰 요약 표시 |
| 5 | 권한 목록 확인 | 요청 권한 목록 표시 |
| 6 | 가격 정보 확인 | 무료/유료 표시 (유료 플러그인 경우) |

**검증 항목:**
- [ ] 200 상태 코드
- [ ] 플러그인 상세 정보 반환
- [ ] 스크린샷, 개발자 정보, 권한 목록, 가격 포함
- [ ] 평점과 리뷰 요약 포함

**API 테스트:**
```http
GET /api/plugins/{plugin_id}
Authorization: Bearer {user-token}
```

#### TC-STORE-005: 무료 플러그인 설치

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 무료 플러그인 상세 페이지에서 "설치" 클릭 | 권한 동의 모달 표시 |
| 2 | 요청 권한 목록 확인 | 모든 권한 목록과 설명 표시 |
| 3 | "동의 및 설치" 클릭 | 설치 진행 |
| 4 | 라이선스 검증 | 라이선스 유효성 확인 |
| 5 | 다운로드 URL 생성 | 서명된 URL 반환 |
| 6 | 플러그인 다운로드 및 설치 | `src/plugins/local/`에 설치 |
| 7 | `plugin_installs` 레코드 생성 | 설치 기록 저장 |
| 8 | 활성화 완료 | 플러그인 자동 활성화 |

**검증 항목:**
- [ ] 200 상태 코드
- [ ] `install_id` 반환
- [ ] `plugin_installs` 레코드 생성
- [ ] 다운로드 URL 반환 (서명된 URL)
- [ ] 플러그인이 로컬 폴더에 설치됨

**API 테스트:**
```http
POST /api/plugins/install
Authorization: Bearer {user-token}
Content-Type: application/json

{
  "plugin_id": "plugin-active-001",
  "version_id": "ver-001",
  "permissions_accepted": ["read:patients"]
}
```

#### TC-STORE-006: 유료 플러그인 구매 필요 안내

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | restricted 플러그인 상세 페이지 접속 | 상세 표시 (가격 정보 포함) |
| 2 | "설치" 클릭 | 권한 확인 |
| 3 | 구매 내역 확인 | 구매 내역 없음 |
| 4 | 결제 안내 표시 | 결제 페이지 링크와 안내 |

**검증 항목:**
- [ ] 402 상태 코드 (Payment Required)
- [ ] 결제 안내 URL 포함
- [ ] 플러그인 가격 정보 표시

#### TC-STORE-007: 중복 설치 방지

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 이미 설치된 플러그인 재설치 시도 | 설치 요청 |
| 2 | 중복 확인 | 이미 설치됨 감지 |
| 3 | 에러 메시지 표시 | "이미 설치된 플러그인입니다" |

**검증 항목:**
- [ ] 409 상태 코드 (Conflict)
- [ ] "Plugin already installed" 메시지

---

## Test Scenario 5: Developer Portal

### 목표
개발자가 자신의 제출 현황을 조회하고 재제출하는 과정을 검증합니다.

### 전제 조건
- 개발자 계정으로 로그인
- 하나 이상의 제출 기록 존재

### 테스트 케이스

#### TC-DEV-PORTAL-001: 개발자 대시보드 조회

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | `/plugins/developer` 페이지 접속 | 개발자 대시보드 표시 |
| 2 | 통계 요약 확인 | 총 플러그인, 다운로드, 평점 표시 |
| 3 | 최근 제출 현황 확인 | 제출 목록과 상태 표시 |
| 4 | 개발자 등급 확인 | 신뢰 등급 배지 표시 |

**검증 항목:**
- [ ] 200 상태 코드
- [ ] 개발자 정보 반환 (id, name, email, trust_level, status, total_plugins)
- [ ] 통계 데이터 표시
- [ ] 제출 목록 표시

**API 테스트:**
```http
GET /api/plugins/developer/me
Authorization: Bearer {dev-token}
```

#### TC-DEV-PORTAL-002: 내 제출 목록 조회

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | "내 제출" 탭 클릭 | 제출 목록 표시 |
| 2 | 상태별 필터링 | pending/approved/rejected 필터 작동 |
| 3 | 각 제출 상태 확인 | 상태, 제출일, 검증 결과 표시 |

**검증 항목:**
- [ ] 200 상태 코드
- [ ] 제출 배열 반환
- [ ] 필터 파라미터 작동

**API 테스트:**
```http
GET /api/plugins/developer/submissions?status=pending&limit=20
Authorization: Bearer {dev-token}
```

#### TC-DEV-PORTAL-003: 거부된 제출 상세 조회

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 거부된 제출 클릭 | 제출 상세 표시 |
| 2 | 거부 사유 확인 | 관리자가 입력한 거부 사유 표시 |
| 3 | 검증 오류 확인 | 구체적인 오류 메시지 표시 |

**검증 항목:**
- [ ] 200 상태 코드
- [ ] 거부 사유 포함
- [ ] 검증 오류 세부 정보 포함

#### TC-DEV-PORTAL-004: 수정 후 재제출

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 거부된 제출 상세에서 "수정 후 재제출" 클릭 | 수정 폼 표시 |
| 2 | 수정된 플러그인 코드 업로드 | 파일 업로드 |
| 3 | 재제출 요청 전송 | 새로운 검증 시작 |
| 4 | 검증 결과 확인 | 새로운 제출 ID 생성 |
| 5 | 리뷰 대기열에 재추가 | `status='pending'` |

**검증 항목:**
- [ ] 200 상태 코드
- [ ] 새로운 제출 ID 반환
- [ ] 이전 제출과 연결 정보 유지

**API 테스트:**
```http
PUT /api/plugins/submissions/{submission_id}/resubmit
Authorization: Bearer {dev-token}
Content-Type: multipart/form-data

{
  "plugin_bundle": (binary file upload),
  "manifest": {...}
}
```

#### TC-DEV-PORTAL-005: 개발자 통계 조회

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | "통계" 탭 클릭 | 통계 대시보드 표시 |
| 2 | 플러그인별 다운로드 확인 | 다운로드 수 차트 표시 |
| 3 | 수익 확인 (유료 플러그인) | 수익 금액 표시 |
| 4 | 기간별 추이 확인 | 일/주/월별 추이 차트 |

**검증 항목:**
- [ ] 200 상태 코드
- [ ] 플러그인별 다운로드 수 반환
- [ ] 수익 데이터 반환 (유료 플러그인)
- [ ] 기간별 추이 데이터 포함

**API 테스트:**
```http
GET /api/plugins/developer/stats
Authorization: Bearer {dev-token}
Query: ?period=30d
```

---

## Test Scenario 6: Plugin Updates

### 목표
설치된 플러그인의 업데이트 알림, 설치, 롤백 기능을 검증합니다.

### 전제 조건
- 사용자가 플러그인 v1.0.0 설치
- 새 버전 v2.0.0이 승인됨

### 테스트 케이스

#### TC-UPDATE-001: 업데이트 알림 표시

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 사용자가 `/plugins` 관리 페이지 접속 | 관리 페이지 표시 |
| 2 | 업데이트 가능 플러그인 확인 | "N개의 플러그인 업데이트 가능" 배지 |
| 3 | 주요 버전 업데이트 확인 | "주요 업데이트" 뱃지 표시 |

**검증 항목:**
- [ ] 업데이트 알림 표시
- [ ] Major 버전 업데이트 시 특별 표시
- [ ] 변경사항 요약 포함

#### TC-UPDATE-002: 업데이트 수행

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 업데이트 버튼 클릭 | 변경사항 요약 표시 |
| 2 | "업데이트" 클릭 | 업데이트 진행 |
| 3 | 이전 버전 백업 | 백업 파일 생성 |
| 4 | 새 버전 다운로드 및 설치 | 새 버전 설치 |
| 5 | `plugin_installs` 레코드 업데이트 | `version_id` 업데이트 |
| 6 | 활성화 완료 | 새 버전 작동 |

**검증 항목:**
- [ ] 200 상태 코드
- [ ] 새로운 `install_id` 또는 업데이트된 레코드
- [ ] 백업 파일 존재
- [ ] 플러그인 정상 작동

**API 테스트:**
```http
PUT /api/plugins/{install_id}/update
Authorization: Bearer {user-token}
Content-Type: application/json

{
  "target_version_id": "ver-new-002"
}
```

#### TC-UPDATE-003: 업데이트 실패 시 롤백

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 업데이트 진행 중 오류 발생 상황 시뮬레이션 | 업데이트 실패 |
| 2 | 자동 롤백 실행 | 백업된 버전 복원 |
| 3 | 플러그인 정상 작동 확인 | 이전 버전으로 복원 완료 |
| 4 | 오류 메시지 표시 | "업데이트 실패, 이전 버전으로 복원되었습니다" |

**검증 항목:**
- [ ] 롤백 자동 실행
- [ ] 플러그인 정상 작동
- [ ] 사용자에게 적절한 오류 메시지

---

## Edge Cases and Negative Testing

### TC-EDGE-001: 잘못된 플러그인 ID 조회

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 존재하지 않는 플러그인 ID로 조회 요청 | 조회 시도 |
| 2 | 404 응답 | "Plugin not found" 메시지 |

**검증 항목:**
- [ ] 404 상태 코드
- [ ] 적절한 오류 메시지

### TC-EDGE-002: 무단 사용자의 관리자 API 접근

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 일반 사용자로 관리자 API 호출 | 접근 시도 |
| 2 | 403 응답 | "Forbidden" 메시지 |

**검증 항목:**
- [ ] 403 상태 코드
- [ ] 인증 오류 메시지

### TC-EDGE-003: 대용량 플러그인 업로드

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 50MB 이상의 플러그인 번들 업로드 시도 | 업로드 시도 |
| 2 | 파일 크기 검증 | 검증 실패 |
| 3 | 413 응답 | "Payload too large" 메시지 |

**검증 항목:**
- [ ] 413 상태 코드
- [ ] 파일 크기 제한 메시지

### TC-EDGE-004: Rate Limiting

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | 단시간 내 다수의 플러그인 검색 요청 | 요청 전송 |
| 2 | Rate Limit 초과 | 429 응답 |
| 3 | Retry-After 헤더 확인 | 대기 시간 정보 |

**검증 항목:**
- [ ] 429 상태 코드
- [ ] Retry-After 헤더 존재

---

## Security Testing Scenarios

### TC-SEC-001: 권한 위반 감지

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | `write:patients` 권한만 허용된 플러그인 실행 | 플러그인 활성화 |
| 2 | 플러그인이 `payments` 데이터 접근 시도 | 샌드박스 차단 |
| 3 | `PluginPermissionError` 발생 | 오류 발생 |
| 4 | 위반 이벤트 로깅 | `plugin_violations` 레코드 생성 |
| 5 | 플러그인 비활성화 | 자동 비활성화 |
| 6 | 관리자 알림 전송 | 이메일/알림 발송 |

**검증 항목:**
- [ ] 권한 위반 차단
- [ ] 위반 이벤트 로깅
- [ ] 플러그인 비활성화
- [ ] 관리자 알림

### TC-SEC-002: 네트워크 접근 차단

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | `network:*` 권한 없는 플러그인 실행 | 플러그인 활성화 |
| 2 | 외부 API 호출 시도 | 요청 차단 |
| 3 | "Network access denied" 오류 | 적절한 오류 메시지 |

**검증 항목:**
- [ ] 네트워크 요청 차단
- [ ] 명확한 오류 메시지

### TC-SEC-003: 내부 네트워크 차단

| 단계 | 수행 단계 | 예상 결과 |
|------|----------|----------|
| 1 | `network:*` 권한을 가진 플러그인 실행 | 플러그인 활성화 |
| 2 | localhost 또는 192.168.x.x로 요청 | 내부 네트워크 요청 |
| 3 | 요청 차단 | "Internal network access blocked" |

**검증 항목:**
- [ ] 내부 네트워크 요청 차단
- [ ] 명확한 오류 메시지

---

## Performance Testing

### TC-PERF-001: API 응답 시간

| 측정 항목 | 목표 | 측정 방법 |
|----------|------|----------|
| 플러그인 목록 조회 | P95 < 500ms | Postman/Benchmark |
| 플러그인 상세 조회 | P95 < 300ms | Postman/Benchmark |
| 플러그인 제출 | P95 < 2s | Postman/Benchmark |
| 플러그인 다운로드 시작 | P95 < 1s | Postman/Benchmark |

### TC-PERF-002: 동시 사용자 부하

| 시나리오 | 목표 | 측정 방법 |
|----------|------|----------|
| 100명 동시 스토어 접속 | 오류율 < 1% | k6/Locust |
| 50명 동시 플러그인 설치 | 오류율 < 1% | k6/Locust |

---

## Test Execution Checklist

### 사전 준비

- [ ] 테스트 데이터베이스 초기화
- [ ] 테스트 사용자 생성
- [ ] 테스트 플러그인 샘플 준비
- [ ] HQ 서버 로컬/스테이징 환경 구성
- [ ] Postman Collection 준비

### 테스트 실행

#### 개발자 등록 플로우 (TC-DEV-001 ~ TC-DEV-003)
- [ ] TC-DEV-001: 유효한 라이선스로 등록 성공
- [ ] TC-DEV-002: 만료된 라이선스로 등록 실패
- [ ] TC-DEV-003: 중복 등록 방지

#### 플러그인 제출 플로우 (TC-SUBMIT-001 ~ TC-SUBMIT-005)
- [ ] TC-SUBMIT-001: 유효한 플러그인 제출 성공
- [ ] TC-SUBMIT-002: 매니페스트 누락 실패
- [ ] TC-SUBMIT-003: 보안 취약점 감지
- [ ] TC-SUBMIT-004: Basic 등급 제한
- [ ] TC-SUBMIT-005: 버전 형식 검증

#### 관리자 리뷰 플로우 (TC-ADMIN-001 ~ TC-ADMIN-005)
- [ ] TC-ADMIN-001: 리뷰 대기열 조회
- [ ] TC-ADMIN-002: 제출 상세 조회
- [ ] TC-ADMIN-003: 제출 승인
- [ ] TC-ADMIN-004: 제출 거부
- [ ] TC-ADMIN-005: 변경 요청

#### 스토어 플로우 (TC-STORE-001 ~ TC-STORE-007)
- [ ] TC-STORE-001: 공개 플러그인 목록
- [ ] TC-STORE-002: 카테고리 필터링
- [ ] TC-STORE-003: 검색 기능
- [ ] TC-STORE-004: 플러그인 상세
- [ ] TC-STORE-005: 무료 플러그인 설치
- [ ] TC-STORE-006: 유료 플러그인 구매 필요
- [ ] TC-STORE-007: 중복 설치 방지

#### 개발자 포털 플로우 (TC-DEV-PORTAL-001 ~ TC-DEV-PORTAL-005)
- [ ] TC-DEV-PORTAL-001: 개발자 대시보드
- [ ] TC-DEV-PORTAL-002: 내 제출 목록
- [ ] TC-DEV-PORTAL-003: 거부된 제출 상세
- [ ] TC-DEV-PORTAL-004: 수정 후 재제출
- [ ] TC-DEV-PORTAL-005: 개발자 통계

#### 업데이트 플로우 (TC-UPDATE-001 ~ TC-UPDATE-003)
- [ ] TC-UPDATE-001: 업데이트 알림
- [ ] TC-UPDATE-002: 업데이트 수행
- [ ] TC-UPDATE-003: 업데이트 실패 시 롤백

#### Edge Cases (TC-EDGE-001 ~ TC-EDGE-004)
- [ ] TC-EDGE-001: 잘못된 플러그인 ID
- [ ] TC-EDGE-002: 무단 관리자 API 접근
- [ ] TC-EDGE-003: 대용량 업로드
- [ ] TC-EDGE-004: Rate Limiting

#### 보안 테스트 (TC-SEC-001 ~ TC-SEC-003)
- [ ] TC-SEC-001: 권한 위반 감지
- [ ] TC-SEC-002: 네트워크 접근 차단
- [ ] TC-SEC-003: 내부 네트워크 차단

### 결과 보고

- [ ] 각 테스트 케이스 결과 기록
- [ ] 실패한 테스트 재현 단계 문서화
- [ ] 버그 리포트 생성 (Jira/이슈 트래커)
- [ ] 테스트 요약 보고서 작성

---

## Bug Reporting Template

```markdown
## Bug Report: [Brief Description]

### 발생 위치
- 테스트 케이스: TC-XXX-NNN
- 페이지/기능: [Page/Feature Name]
- API 엔드포인트: [Method] /api/path

### 재현 단계
1. [첫 번째 단계]
2. [두 번째 단계]
3. [세 번째 단계]

### 예상 동작
[예상 결과]

### 실제 동작
[실제 결과]

### 스크린샷/로그
[관련 스크린샷 또는 로그 첨부]

### 환경 정보
- 브라우저: [Browser Name & Version]
- 사용자: [Test User ID]
- 데이터: [Relevant Test Data]
```

---

## Appendix: Postman Collection Structure

```
Clinic-OS Plugin Marketplace Tests/
├── 01. Developer Registration/
│   ├── Register with Valid License
│   ├── Register with Expired License
│   └── Check Duplicate Registration
├── 02. Plugin Submission/
│   ├── Submit Valid Plugin
│   ├── Submit with Missing Manifest
│   ├── Submit with Security Issues
│   ├── Submit Restricted Category (Basic Tier)
│   └── Version Format Validation
├── 03. Admin Review/
│   ├── Get Review Queue
│   ├── Get Submission Details
│   ├── Approve Submission
│   ├── Reject Submission
│   └── Request Changes
├── 04. Plugin Store/
│   ├── List Public Plugins
│   ├── Filter by Category
│   ├── Search Plugins
│   ├── Get Plugin Details
│   ├── Install Free Plugin
│   ├── Attempt Install Paid Plugin (No Purchase)
│   └── Duplicate Install Prevention
├── 05. Developer Portal/
│   ├── Get Developer Dashboard
│   ├── List My Submissions
│   ├── Get Rejected Submission Details
│   ├── Resubmit After Changes
│   └── Get Developer Statistics
└── 06. Plugin Updates/
    ├── Check Update Notifications
    ├── Perform Update
    └── Rollback on Failure
```

---

## Version History

| 버전 | 날짜 | 변경사항 | 작성자 |
|------|------|----------|--------|
| 1.0.0 | 2026-02-10 | 초기 테스트 계획 작성 | Expert Testing Agent |
