# SPEC-PLUGIN-MARKETPLACE-001: Acceptance Criteria

## TAG BLOCK

```
TAG: SPEC-PLUGIN-MARKETPLACE-001
TYPE: feature
DOMAIN: plugin-marketplace
STATUS: planned
PRIORITY: high
PHASE: plan
```

## Acceptance Criteria by Requirement

### REQ-PLUGIN-001: 로컬 플러그인 개발 지원

**AC-001-1: 로컬 플러그인 자동 로딩**

```
GIVEN: 개발자가 src/plugins/local/{plugin-id}/ 폴더에 플러그인을 생성
WHEN: 다음 빌드을 실행
THEN: 플러그인이 자동으로 로드되고 getInstalledPlugins()에 포함된다
AND: 콘솔에 "Loaded plugin: {plugin-id}" 메시지가 출력된다
```

**AC-001-2: 코어 플러그인 오버라이드**

```
GIVEN: src/plugins/local/custom-homepage/가 존재
WHEN: 플러그인 로더가 실행됨
THEN: 로컬 버전이 코어 버전보다 우선 적용된다
AND: getPageOverride('/')가 로컬 버전을 반환한다
```

**AC-001-3: 매니페스트 누락 처리**

```
GIVEN: 플러그인 폴더에 manifest.json이 없음
WHEN: 빌드이 실행됨
THEN: 플러그인이 로드되지 않는다
AND: 콘솔에 "Missing manifest.json for {plugin-id}" 경고가 출력된다
```

### REQ-PLUGIN-002: 플러그인 제출 기능

**AC-002-1: 제출 성공**

```
GIVEN: 인증된 개발자가 유효한 플러그인 번들 소유
WHEN: POST /api/plugins/submit 요청을 보냄
THEN: 201 상태 코드와 제출 ID가 반환된다
AND: plugin_submissions 테이블에 레코드가 생성된다
AND: plugin_versions 테이블에 review_status='pending' 레코드가 생성된다
AND: validation_status='passed'로 설정된다
```

**AC-002-2: 개발자 등급 부족**

```
GIVEN: trust_level='basic'인 개발자
WHEN: restricted 카테고리 플러그인 제출
THEN: 403 상태 코드가 반환된다
AND: "Developer tier insufficient" 메시지가 포함된다
```

**AC-002-3: 매니페스트 검증 실패**

```
GIVEN: 유효하지 않은 manifest.json을 포함하는 플러그인
WHEN: 제출 요청을 보냄
THEN: 400 상태 코드가 반환된다
AND: validation_errors 배열에 구체적인 오류 메시지가 포함된다
```

**AC-002-4: 보안 스캔 실패**

```
GIVEN: eval()을 포함하는 플러그인 코드
WHEN: 제출 요청을 보냄
THEN: 400 상태 코드가 반환된다
AND: security_scan_result에 critical 심각도의 이슈가 포함된다
```

### REQ-PLUGIN-003: 개발자 라이선스 검증

**AC-003-1: 유효한 라이선스**

```
GIVEN: 활성 라이선스를 보유한 사용자
WHEN: 개발자 등록을 요청
THEN: 201 상태 코드와 개발자 ID가 반환된다
AND: plugin_developers 테이블에 레코드가 생성된다
AND: trust_level='basic'으로 설정된다
```

**AC-003-2: 만료된 라이선스**

```
GIVEN: 라이선스가 만료된 사용자
WHEN: 개발자 등록을 요청
THEN: 403 상태 코드가 반환된다
AND: "License expired" 메시지가 포함된다
```

**AC-003-3: 제출 시 라이선스 확인**

```
GIVEN: 만료된 라이선스의 개발자
WHEN: 플러그인 제출을 시도
THEN: 403 상태 코드가 반환된다
AND: 제출이 생성되지 않는다
```

### REQ-PLUGIN-004: 관리자 리뷰 워크플로우

**AC-004-1: 리뷰 대기열 추가**

```
GIVEN: 검증을 통과한 플러그인 제출
WHEN: 제출이 완료됨
THEN: GET /api/admin/plugins/review-queue에 제출이 표시된다
AND: official 개발자의 제출이 목록 상단에 표시된다
```

**AC-004-2: 제출 승인**

```
GIVEN: review_status='pending'인 플러그인 버전
WHEN: 관리자가 POST /api/admin/plugins/versions/:versionId/approve 요청
THEN: 플러그인 상태가 'active'로 변경된다
AND: current_version_id가 업데이트된다
AND: 개발자의 total_plugins가 증가한다
AND: 승인 이메일이 개발자에게 전송된다
```

**AC-004-3: 제출 거부**

```
GIVEN: review_status='pending'인 플러그인 버전
WHEN: 관리자가 POST /api/admin/plugins/versions/:versionId/reject 요청과 거부 사유
THEN: 플러그인 상태가 'rejected'로 변경된다
AND: 거부 사유가 개발자에게 전송된다
AND: 개발자가 수정 후 재제출할 수 있다
```

**AC-004-4: 제출 상세 조회**

```
GIVEN: 존재하는 제출 ID
WHEN: GET /api/admin/plugins/submissions/:id 요청
THEN: 제출, 플러그인, 개발자, 검증 결과가 포함된 응답이 반환된다
```

### REQ-PLUGIN-005: 플러그인 스토어 발견

**AC-005-1: 공개 플러그인 목록**

```
GIVEN: status='active'인 플러그인 10개 존재
WHEN: GET /api/plugins 요청
THEN: 200 상태 코드와 플러그인 배열이 반환된다
AND: 각 플러그인에 id, name, description, category가 포함된다
AND: restricted 플러그인은 제외된다
```

**AC-005-2: 카테고리 필터링**

```
GIVEN: 다양한 카테고리의 플러그인 존재
WHEN: GET /api/plugins?category=integration 요청
THEN: integration 카테고리의 플러그인만 반환된다
```

**AC-005-3: 검색 기능**

```
GIVEN: 이름에 "payment"를 포함하는 플러그인 존재
WHEN: GET /api/plugins?search=payment 요청
THEN: "payment"가 이름/설명에 포함된 플러그인만 반환된다
```

**AC-005-4: 제한된 플러그인 접근**

```
GIVEN: access_type='restricted'인 플러그인
WHEN: 접근 권한이 없는 사용자가 목록 조회
THEN: 해당 플러그인이 결과에서 제외된다
```

**AC-005-5: 플러그인 상세**

```
GIVEN: 존재하는 플러그인 ID
WHEN: GET /api/plugins/:id 요청
THEN: 플러그인 상세 정보가 반환된다
AND: 스크린샷, 개발자 정보, 권한 목록, 가격이 포함된다
AND: 평점과 리뷰 요약이 포함된다
```

### REQ-PLUGIN-006: 플러그인 설치 흐름

**AC-006-1: 무료 플러그인 설치**

```
GIVEN: 로그인한 사용자와 access_type='public'인 플러그인
WHEN: POST /api/plugins/install 요청
THEN: 200 상태 코드와 install_id가 반환된다
AND: plugin_installs 레코드가 생성된다
AND: 다운로드 URL이 반환된다
```

**AC-006-2: 유료 플러그인 구매 필요**

```
GIVEN: access_type='restricted'인 플러그인
WHEN: 구매하지 않은 사용자가 설치 시도
THEN: 402 상태 코드가 반환된다
AND: 결제 안내 URL이 포함된다
```

**AC-006-3: 권한 동의**

```
GIVEN: 설치하려는 플러그인
WHEN: 설치 전 권한 목록이 표시됨
THEN: 사용자가 모든 권한에 명시적으로 동의해야 한다
AND: 거부 시 설치가 진행되지 않는다
```

**AC-006-4: 설치 완료**

```
GIVEN: 다운로드 URL과 동의한 권한
WHEN: 클라이언트가 플러그인을 다운로드하고 설치
THEN: src/plugins/local/{plugin-id}/ 폴더에 플러그인이 설치된다
AND: plugin_installs 레코드의 status='active'로 변경된다
AND: 플러그인이 자동으로 활성화된다
```

**AC-006-5: 중복 설치 방지**

```
GIVEN: 이미 설치된 플러그인
WHEN: 동일 플러그인 재설치 시도
THEN: 409 상태 코드가 반환된다
AND: "Plugin already installed" 메시지가 포함된다
```

### REQ-PLUGIN-007: 플러그인 업데이트

**AC-007-1: 업데이트 알림**

```
GIVEN: 설치된 플러그인의 새 버전이 존재
WHEN: 사용자가 관리자 페이지에 접속
THEN: "N개의 플러그인 업데이트 가능" 알림이 표시된다
```

**AC-007-2: 주요 버전 업데이트**

```
GIVEN: 설치된 플러그인 1.0.0과 새 버전 2.0.0
WHEN: 업데이트 알림 표시
THEN: "주요 업데이트" 뱃지가 표시된다
AND: 변경사항 요약이 포함된다
```

**AC-007-3: 업데이트 수행**

```
GIVEN: 업데이트 가능한 플러그인
WHEN: PUT /api/plugins/:install_id/update 요청
THEN: 새 버전이 다운로드되고 설치된다
AND: 이전 버전이 백업된다
AND: plugin_installs 레코드가 업데이트된다
```

**AC-007-4: 업데이트 롤백**

```
GIVEN: 업데이트 후 문제 발생
WHEN: 사용자가 롤백 요청
THEN: 백업된 이전 버전이 복원된다
AND: 플러그인이 정상 작동한다
```

### REQ-PLUGIN-008: 보안 및 샌드박싱

**AC-008-1: 권한 위반 감지**

```
GIVEN: write:patients 권한만 허용된 플러그인
WHEN: 플러그인이 payments 데이터 접근 시도
THEN: PluginPermissionError가 발생한다
AND: 위반 이벤트가 로깅된다
AND: 플러그인이 비활성화된다
```

**AC-008-2: 네트워크 접근 차단**

```
GIVEN: network:* 권한이 없는 플러그인
WHEN: 외부 API 호출 시도
THEN: 요청이 차단된다
AND: "Network access denied" 오류가 발생한다
```

**AC-008-3: 내부 네트워크 차단**

```
GIVEN: network:* 권한을 가진 플러그인
WHEN: localhost 또는 192.168.x.x로 요청
THEN: 요청이 차단된다
AND: "Internal network access blocked" 오류가 발생한다
```

### REQ-PLUGIN-009: 통계 및 모니터링

**AC-009-1: 다운로드 수집**

```
GIVEN: 플러그인 다운로드
WHEN: 다운로드가 발생
THEN: plugin_downloads 레코드가 생성된다
AND: 다운로드 수가 증가한다
```

**AC-009-2: 관리자 대시보드**

```
GIVEN: 관리자 권한
WHEN: GET /api/admin/plugins/stats 요청
THEN: 총 다운로드, 활성 설치, 평균 평점이 반환된다
AND: 기간별 추이 데이터가 포함된다
```

**AC-009-3: 개발자 통계**

```
GIVEN: 개발자 계정
WHEN: GET /api/plugins/developer/stats 요청
THEN: 자신의 플러그인별 다운로드, 수익이 반환된다
```

## Test Scenarios (Gherkin Format)

### Scenario 1: 개발자가 플러그인을 제출하고 승인받음

```gherkin
Feature: Plugin Submission and Approval

  Background:
    Given 활성 라이선스를 가진 개발자가 로그인함
    And 유효한 manifest.json을 가진 플러그인이 준비됨

  Scenario: 성공적인 제출과 승인
    When 개발자가 플러그인을 제출함
    Then 제출 ID가 반환됨
    And 검증이 통과됨
    And 제출이 리뷰 대기열에 추가됨

    When 관리자가 제출을 승인함
    Then 플러그인이 'active' 상태가 됨
    And 스토어에서 플러그인을 볼 수 있음

  Scenario: 보안 이슈로 인한 거부
    Given eval()을 포함하는 플러그인 코드
    When 개발자가 플러그인을 제출함
    Then 제출이 거부됨
    And 보안 이슈가 보고됨
    And 개발자가 수정 후 재제출할 수 있음
```

### Scenario 2: 사용자가 플러그인을 발견하고 설치함

```gherkin
Feature: Plugin Discovery and Installation

  Background:
    Given 스토어에 3개의 활성 플러그인이 존재
    And 사용자가 로그인함

  Scenario: 검색으로 플러그인 찾기
    When 사용자가 "payment"로 검색
    Then 이름/설명에 "payment"를 포함하는 플러그인만 표시됨

  Scenario: 무료 플러그인 설치
    Given access_type='public'인 플러그인
    When 사용자가 설치를 클릭
    Then 권한 목록이 표시됨
    And 사용자가 동의 시 설치가 시작됨
    And 플러그인이 활성화됨

  Scenario: 유료 플러그인 구매 필요
    Given access_type='restricted'인 플러그인
    And 구매하지 않은 사용자
    When 사용자가 설치를 클릭
    Then 결제 안내가 표시됨
    And 설치가 진행되지 않음
```

### Scenario 3: 플러그인 업데이트

```gherkin
Feature: Plugin Updates

  Background:
    Given 사용자가 플러그인 v1.0.0을 설치함
    And 플러그인 v2.0.0이 승인됨

  Scenario: 업데이트 알림 및 설치
    When 사용자가 관리자 페이지에 접속
    Then 업데이트 알림이 표시됨
    And "주요 업데이트" 뱃지가 표시됨

    When 사용자가 업데이트를 클릭
    Then v1.0.0이 백업됨
    And v2.0.0이 설치됨
    And 플러그인이 정상 작동함

  Scenario: 업데이트 실패 시 롤백
    Given v2.0.0에 버그가 존재
    When 업데이트가 완료된 후
    And 사용자가 문제를 신고
    Then 시스템이 v1.0.0으로 롤백함
    And 플러그인이 정상 작동함
```

### Scenario 4: 보안 위반 감지

```gherkin
Feature: Security Violation Detection

  Background:
    Given write:patients 권한만 허용된 플러그인이 설치됨

  Scenario: 권한 위반 시 차단
    When 플러그인이 payments 테이블 접근을 시도
    Then PluginPermissionError가 발생함
    And 위반 이벤트가 로깅됨
    And 플러그인이 비활성화됨
    And 관리자에게 알림이 전송됨

  Scenario: 네트워크 접근 차단
    Given network:* 권한이 없는 플러그인
    When 플러그인이 외부 API를 호출
    Then 요청이 차단됨
    And "Network access denied" 오류가 발생함
```

## Quality Gates

### TRUST 5 Validation

**Tested:**
- 모든 API 엔드포인트에 대한 테스트 케이스
- E2E 테스트 (제출 → 리뷰 → 설치)
- 보안 스캔 정확도 테스트

**Readable:**
- 명확한 함수/변수 네이밍
- 영어 주석
- 일관된 코드 스타일

**Unified:**
- ESLint/Prettier 설정 준수
- 타입스크립트 엄격 모드
- 통합된 에러 처리

**Secured:**
- OWASP Top 10 방지
- 입력 검증
- Rate Limiting
- 샌드박싱

**Trackable:**
- Git 커밋 메시지 규칙
- 이슈 트래커 연동
- 로깅 및 모니터링

### Performance Criteria

- API 응답 시간: P95 < 500ms
- 다운로드 속도: > 10MB/s
- 보안 스캔: < 30초
- 페이지 로드: < 2초

### Security Checklist

- [ ] 모든 입력 검증
- [ ] SQL Injection 방지
- [ ] XSS 방지
- [ ] CSRF 토큰
- [ ] Rate Limiting
- [ ] 권한 체크
- [ ] 민감 데이터 암호화
- [ ] 로그 민감 정보 제거

## Definition of Done

- [ ] 모든 Acceptance Criteria 충족
- [ ] 모든 테스트 시나리오 통과
- [ ] TRUST 5 품질 게이트 통과
- [ ] 성능 기준 충족
- [ ] 보안 체크리스트 완료
- [ ] API 문서 작성
- [ ] 사용자 가이드 작성
- [ ] 관리자 매뉴얼 작성
- [ ] 코드 리뷰 완료
- [ ] 프로덕션 배포 준비
