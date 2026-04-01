---
spec_id: SPEC-AUTH-001
version: "1.0.0"
created: "2026-01-29"
updated: "2026-01-29"
---

# SPEC-AUTH-001 수락 기준: JWT 인증 시스템 재설계

## 1. 수락 기준 개요

이 문서는 SPEC-AUTH-001의 모든 요구사항에 대한 수락 기준을 Given-When-Then 형식으로 정의합니다.

---

## 2. 수락 기준 상세

### AC-AUTH-001: RS256 JWT 토큰 사용

**관련 요구사항:** REQ-AUTH-001

```gherkin
Feature: RS256 JWT 토큰 서명

  Scenario: JWT 토큰이 RS256 알고리즘으로 서명됨
    Given 시스템에 유효한 RSA 키 쌍이 설정되어 있음
    When 새로운 Access Token이 생성됨
    Then 토큰 헤더의 "alg" 필드는 "RS256"이어야 함
    And 토큰 헤더의 "typ" 필드는 "JWT"이어야 함
    And 토큰은 Private Key로 서명되어야 함

  Scenario: JWT 토큰이 Public Key로 검증 가능
    Given RS256으로 서명된 유효한 JWT 토큰이 있음
    When Public Key로 토큰을 검증함
    Then 검증이 성공해야 함
    And payload가 정상적으로 추출되어야 함
```

### AC-AUTH-002: Access Token 15분 만료

**관련 요구사항:** REQ-AUTH-002

```gherkin
Feature: Access Token 만료 시간

  Scenario: Access Token이 15분 만료로 생성됨
    Given 사용자가 로그인에 성공함
    When Access Token이 발급됨
    Then 토큰의 "exp" claim은 발급 시점 + 900초여야 함
    And 응답의 "expiresIn" 필드는 900이어야 함

  Scenario: 만료된 Access Token 거부
    Given 15분이 경과한 Access Token이 있음
    When 해당 토큰으로 API를 호출함
    Then 응답 상태 코드는 401이어야 함
    And 응답 본문에 "token expired" 메시지가 포함되어야 함
```

### AC-AUTH-003: Refresh Token 7일 만료

**관련 요구사항:** REQ-AUTH-003

```gherkin
Feature: Refresh Token 만료 시간

  Scenario: Refresh Token이 7일 만료로 생성됨
    Given 사용자가 로그인에 성공함
    When Refresh Token이 발급됨
    Then 토큰의 "exp" claim은 발급 시점 + 604800초여야 함

  Scenario: Refresh Token이 HttpOnly 쿠키로 전달됨
    Given 사용자가 로그인에 성공함
    When 응답이 반환됨
    Then "Set-Cookie" 헤더에 "refreshToken" 쿠키가 포함되어야 함
    And 쿠키는 "HttpOnly" 속성을 가져야 함
    And 쿠키는 "Secure" 속성을 가져야 함
    And 쿠키는 "SameSite=Strict" 속성을 가져야 함
```

### AC-AUTH-004: 로그인 시 양쪽 토큰 발급

**관련 요구사항:** REQ-AUTH-004

```gherkin
Feature: 로그인 토큰 발급

  Scenario: 유효한 자격 증명으로 로그인 성공
    Given 유효한 이메일과 비밀번호가 있음
    When POST /api/auth/login 요청을 보냄
    Then 응답 상태 코드는 200이어야 함
    And 응답 본문에 "accessToken" 필드가 있어야 함
    And 응답 본문에 "expiresIn" 필드가 있어야 함
    And 응답 본문에 "tokenType" 필드가 "Bearer"여야 함
    And "Set-Cookie" 헤더에 Refresh Token 쿠키가 있어야 함

  Scenario: 잘못된 자격 증명으로 로그인 실패
    Given 잘못된 비밀번호가 있음
    When POST /api/auth/login 요청을 보냄
    Then 응답 상태 코드는 401이어야 함
    And 토큰이 발급되지 않아야 함
```

### AC-AUTH-005: Access Token 갱신

**관련 요구사항:** REQ-AUTH-005

```gherkin
Feature: Access Token 갱신

  Scenario: 유효한 Refresh Token으로 Access Token 갱신
    Given 유효한 Refresh Token 쿠키가 있음
    When POST /api/auth/refresh 요청을 보냄
    Then 응답 상태 코드는 200이어야 함
    And 응답 본문에 새로운 "accessToken"이 있어야 함
    And 새 Access Token의 "exp"는 현재 시점 + 900초여야 함

  Scenario: 만료된 Refresh Token으로 갱신 실패
    Given 만료된 Refresh Token 쿠키가 있음
    When POST /api/auth/refresh 요청을 보냄
    Then 응답 상태 코드는 401이어야 함
    And "refresh token expired" 메시지가 반환되어야 함

  Scenario: Refresh Token 쿠키 없이 갱신 요청
    Given Refresh Token 쿠키가 없음
    When POST /api/auth/refresh 요청을 보냄
    Then 응답 상태 코드는 401이어야 함
```

### AC-AUTH-006: 세션 무효화 (로그아웃)

**관련 요구사항:** REQ-AUTH-006

```gherkin
Feature: 로그아웃

  Scenario: 로그아웃 성공
    Given 유효한 Access Token과 Refresh Token이 있음
    When POST /api/auth/logout 요청을 보냄
    Then 응답 상태 코드는 200이어야 함
    And Refresh Token의 jti가 블랙리스트에 등록되어야 함
    And "Set-Cookie" 헤더에 쿠키 삭제 지시가 있어야 함

  Scenario: 로그아웃 후 Refresh Token 사용 불가
    Given 로그아웃한 사용자의 Refresh Token이 있음
    When 해당 Refresh Token으로 갱신 요청을 보냄
    Then 응답 상태 코드는 401이어야 함
    And "token revoked" 메시지가 반환되어야 함
```

### AC-AUTH-007: Token Blacklist 검증

**관련 요구사항:** REQ-AUTH-007

```gherkin
Feature: 토큰 블랙리스트 검증

  Scenario: 블랙리스트에 있는 토큰 거부
    Given jti가 블랙리스트에 등록된 Access Token이 있음
    When 해당 토큰으로 API를 호출함
    Then 응답 상태 코드는 401이어야 함
    And "token revoked" 메시지가 반환되어야 함

  Scenario: 블랙리스트에 없는 토큰 허용
    Given 블랙리스트에 없는 유효한 Access Token이 있음
    When 해당 토큰으로 API를 호출함
    Then 요청이 정상적으로 처리되어야 함

  Scenario: 만료된 블랙리스트 항목 자동 정리
    Given 7일이 지난 블랙리스트 항목이 있음
    When 정리 작업이 실행됨
    Then 해당 항목이 블랙리스트에서 삭제되어야 함
```

### AC-AUTH-008: admin.id 직접 사용 금지

**관련 요구사항:** REQ-AUTH-008

```gherkin
Feature: 레거시 토큰 차단

  Scenario: 마이그레이션 기간 중 레거시 토큰 허용 (경고)
    Given 마이그레이션 기간 내임
    And admin.id 형식의 레거시 토큰이 있음
    When 해당 토큰으로 API를 호출함
    Then 요청은 처리되어야 함
    And deprecation 경고가 로깅되어야 함

  Scenario: 마이그레이션 기간 후 레거시 토큰 차단
    Given 마이그레이션 기간이 종료됨
    And admin.id 형식의 레거시 토큰이 있음
    When 해당 토큰으로 API를 호출함
    Then 응답 상태 코드는 401이어야 함
    And "legacy token not supported" 메시지가 반환되어야 함
```

### AC-AUTH-009: 만료 없는 토큰 금지

**관련 요구사항:** REQ-AUTH-009

```gherkin
Feature: 토큰 만료 필수

  Scenario: exp claim 없는 토큰 거부
    Given "exp" claim이 없는 JWT 토큰이 있음
    When 해당 토큰으로 API를 호출함
    Then 응답 상태 코드는 401이어야 함
    And "token missing expiration" 메시지가 반환되어야 함

  Scenario: 모든 발급 토큰에 exp claim 포함
    Given 시스템이 새 토큰을 발급함
    When Access Token 또는 Refresh Token이 생성됨
    Then 토큰에 "exp" claim이 반드시 포함되어야 함
```

---

## 3. Quality Gate 기준

### 3.1 테스트 커버리지

- JWT 유틸리티 함수: 100% 커버리지
- 인증 미들웨어: 90% 이상 커버리지
- API 엔드포인트: 모든 경로 테스트

### 3.2 성능 기준

- 토큰 검증 응답 시간: P95 < 50ms
- 블랙리스트 조회 (캐시 적중): P95 < 10ms
- 블랙리스트 조회 (캐시 미스): P95 < 30ms

### 3.3 보안 기준

- OWASP 인증 가이드라인 준수
- 민감 정보 로깅 금지 (토큰 전문 등)
- Private Key 환경 변수 외부 노출 금지

---

## 4. Definition of Done

- [ ] 모든 수락 기준 테스트 통과
- [ ] 코드 리뷰 완료
- [ ] 보안 검토 완료
- [ ] API 문서 업데이트
- [ ] 마이그레이션 가이드 작성
- [ ] 프로덕션 배포 및 모니터링 설정

---

## 5. Traceability

| 수락 기준 ID | 요구사항 ID | plan.md Task |
|-------------|------------|--------------|
| AC-AUTH-001 | REQ-AUTH-001 | M1-T1 |
| AC-AUTH-002 | REQ-AUTH-002 | M1-T1 |
| AC-AUTH-003 | REQ-AUTH-003 | M1-T1 |
| AC-AUTH-004 | REQ-AUTH-004 | M1-T2 |
| AC-AUTH-005 | REQ-AUTH-005 | M1-T3 |
| AC-AUTH-006 | REQ-AUTH-006 | M2-T1 |
| AC-AUTH-007 | REQ-AUTH-007 | M2-T2, M2-T3 |
| AC-AUTH-008 | REQ-AUTH-008 | M3-T1 |
| AC-AUTH-009 | REQ-AUTH-009 | M1-T1 |
