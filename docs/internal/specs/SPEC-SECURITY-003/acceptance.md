---
spec_id: SPEC-SECURITY-003
version: "1.0.0"
created: "2026-01-29"
updated: "2026-01-29"
---

# SPEC-SECURITY-003 수락 기준: 웹 보안 강화

## 1. 수락 기준 개요

이 문서는 SPEC-SECURITY-003의 모든 요구사항에 대한 수락 기준을 Given-When-Then 형식으로 정의합니다.

---

## 2. 수락 기준 상세

### AC-WEB-001: HTML Sanitization 필수

**관련 요구사항:** REQ-WEB-001

```gherkin
Feature: XSS 방어를 위한 HTML Sanitization

  Scenario: script 태그 제거
    Given Markdown 입력에 "<script>alert('xss')</script>" 가 포함됨
    When sanitizeMarkdown() 함수로 처리함
    Then 결과에 <script> 태그가 포함되지 않아야 함
    And 결과에 JavaScript 코드가 포함되지 않아야 함

  Scenario: 이벤트 핸들러 속성 제거
    Given HTML 입력에 "<img src='x' onerror='alert(1)'>" 가 포함됨
    When sanitizeHtml() 함수로 처리함
    Then 결과에 onerror 속성이 포함되지 않아야 함
    And img 태그 자체는 유지되어야 함 (src만 포함)

  Scenario: 정상적인 Markdown 서식 유지
    Given 정상적인 Markdown "**굵은 글씨** _이탤릭_"이 있음
    When sanitizeMarkdown() 함수로 처리함
    Then <strong>굵은 글씨</strong> <em>이탤릭</em> 형태로 변환되어야 함

  Scenario: iframe 태그 제거
    Given HTML 입력에 "<iframe src='https://evil.com'></iframe>" 가 포함됨
    When sanitizeHtml() 함수로 처리함
    Then 결과에 <iframe> 태그가 포함되지 않아야 함
```

### AC-WEB-002: Content-Security-Policy 헤더

**관련 요구사항:** REQ-WEB-002

```gherkin
Feature: CSP 헤더 적용

  Scenario: CSP 헤더가 모든 응답에 포함됨
    Given 서버가 실행 중임
    When 임의의 API 엔드포인트에 요청을 보냄
    Then 응답 헤더에 "Content-Security-Policy"가 포함되어야 함

  Scenario: CSP 헤더에 default-src 지시어 포함
    Given 서버가 실행 중임
    When API 응답의 CSP 헤더를 확인함
    Then "default-src 'self'" 지시어가 포함되어야 함

  Scenario: CSP 헤더에 frame-ancestors 지시어 포함
    Given 서버가 실행 중임
    When API 응답의 CSP 헤더를 확인함
    Then "frame-ancestors 'none'" 지시어가 포함되어야 함

  Scenario: CSP 위반 시 콘텐츠 차단
    Given CSP 정책이 적용된 페이지가 있음
    When 허용되지 않은 외부 스크립트를 로드하려고 함
    Then 브라우저가 해당 스크립트를 차단해야 함
    And 콘솔에 CSP 위반 오류가 로깅되어야 함
```

### AC-WEB-003: X-Frame-Options 헤더

**관련 요구사항:** REQ-WEB-003

```gherkin
Feature: X-Frame-Options 헤더

  Scenario: X-Frame-Options 헤더가 DENY로 설정됨
    Given 서버가 실행 중임
    When 임의의 API 엔드포인트에 요청을 보냄
    Then 응답 헤더에 "X-Frame-Options: DENY"가 포함되어야 함

  Scenario: iframe에서 페이지 로드 차단
    Given X-Frame-Options: DENY가 설정된 페이지가 있음
    When 외부 사이트에서 해당 페이지를 iframe으로 로드하려고 함
    Then 브라우저가 iframe 내 로드를 차단해야 함
```

### AC-WEB-004: X-Content-Type-Options 헤더

**관련 요구사항:** REQ-WEB-004

```gherkin
Feature: X-Content-Type-Options 헤더

  Scenario: X-Content-Type-Options 헤더가 nosniff로 설정됨
    Given 서버가 실행 중임
    When 임의의 API 엔드포인트에 요청을 보냄
    Then 응답 헤더에 "X-Content-Type-Options: nosniff"가 포함되어야 함

  Scenario: MIME 타입 스니핑 방지
    Given Content-Type: text/plain으로 응답이 설정됨
    And 응답 본문에 HTML 콘텐츠가 포함됨
    When 브라우저가 해당 응답을 처리함
    Then 브라우저가 HTML로 해석하지 않고 텍스트로 처리해야 함
```

### AC-WEB-005: Strict-Transport-Security 헤더

**관련 요구사항:** REQ-WEB-005

```gherkin
Feature: HSTS 헤더

  Scenario: HSTS 헤더가 적절한 값으로 설정됨
    Given 서버가 실행 중임
    When HTTPS로 API 엔드포인트에 요청을 보냄
    Then 응답 헤더에 "Strict-Transport-Security"가 포함되어야 함
    And max-age가 31536000 이상이어야 함
    And includeSubDomains 지시어가 포함되어야 함

  Scenario: HTTP 요청이 HTTPS로 리다이렉트됨
    Given HSTS가 적용된 도메인에 방문한 적이 있음
    When HTTP로 해당 도메인에 요청을 보냄
    Then 브라우저가 자동으로 HTTPS로 전환해야 함
```

### AC-WEB-006: CORS 정확한 도메인 매칭

**관련 요구사항:** REQ-WEB-006

```gherkin
Feature: CORS 도메인 매칭

  Scenario: 허용된 Origin에서 요청 성공
    Given "https://app.clinic-os.com"이 허용 Origin 목록에 있음
    When 해당 Origin에서 API 요청을 보냄
    Then 응답 헤더에 "Access-Control-Allow-Origin: https://app.clinic-os.com"이 포함되어야 함
    And 요청이 성공적으로 처리되어야 함

  Scenario: 허용되지 않은 Origin에서 요청 차단
    Given "https://evil.com"이 허용 Origin 목록에 없음
    When 해당 Origin에서 API 요청을 보냄
    Then 응답 헤더에 "Access-Control-Allow-Origin"이 포함되지 않아야 함

  Scenario: 와일드카드 Origin 사용 금지
    Given 서버가 실행 중임
    When 임의의 Origin에서 API 요청을 보냄
    Then 응답 헤더에 "Access-Control-Allow-Origin: *"가 포함되지 않아야 함
```

### AC-WEB-007: 안전한 쿠키 파서 사용

**관련 요구사항:** REQ-WEB-007

```gherkin
Feature: 안전한 쿠키 파싱

  Scenario: RFC 6265 준수 쿠키 파싱
    Given Cookie 헤더에 "name=value; token=abc123"이 있음
    When 쿠키 파서가 헤더를 처리함
    Then name은 "value"로 파싱되어야 함
    And token은 "abc123"으로 파싱되어야 함

  Scenario: 특수문자 포함 쿠키 값 안전 처리
    Given Cookie 헤더에 URL 인코딩된 값 "data=%7B%22key%22%3A%22value%22%7D"가 있음
    When 쿠키 파서가 헤더를 처리함
    Then data는 안전하게 디코딩되어야 함
    And injection 공격이 발생하지 않아야 함

  Scenario: 수동 문자열 파싱 금지 확인
    Given 코드베이스를 검사함
    When 쿠키 파싱 관련 코드를 검색함
    Then split(';')과 같은 수동 파싱 패턴이 없어야 함
    And RFC 6265 준수 라이브러리를 사용해야 함
```

### AC-WEB-008: Origin 화이트리스트 검증

**관련 요구사항:** REQ-WEB-008

```gherkin
Feature: Origin 화이트리스트 검증

  Scenario: 정확한 문자열 매칭
    Given 화이트리스트에 "https://app.clinic-os.com"이 있음
    When Origin "https://app.clinic-os.com"으로 요청을 보냄
    Then CORS 검증을 통과해야 함

  Scenario: 대소문자 구분 검증
    Given 화이트리스트에 "https://app.clinic-os.com"이 있음
    When Origin "https://APP.CLINIC-OS.COM"으로 요청을 보냄
    Then CORS 검증에 실패해야 함

  Scenario: 프로토콜 구분 검증
    Given 화이트리스트에 "https://app.clinic-os.com"이 있음
    When Origin "http://app.clinic-os.com"으로 요청을 보냄
    Then CORS 검증에 실패해야 함
```

### AC-WEB-009: endsWith() 패턴 금지

**관련 요구사항:** REQ-WEB-009

```gherkin
Feature: Subdomain Takeover 방지

  Scenario: endsWith() 패턴 미사용 확인
    Given 코드베이스를 검사함
    When Origin 검증 관련 코드를 검색함
    Then endsWith('.clinic-os.com') 패턴이 없어야 함
    And includes('.clinic-os.com') 패턴이 없어야 함

  Scenario: Subdomain takeover 시도 차단
    Given 공격자가 "evil-clinic-os.com" 도메인을 소유함
    When Origin "https://evil-clinic-os.com"으로 요청을 보냄
    Then CORS 검증에 실패해야 함

  Scenario: 악의적 서브도메인 시도 차단
    Given 화이트리스트에 "https://clinic-os.com"이 있음
    When Origin "https://malicious.clinic-os.com"으로 요청을 보냄
    Then CORS 검증에 실패해야 함 (화이트리스트에 없으므로)
```

### AC-WEB-010: Unsanitized HTML 렌더링 금지

**관련 요구사항:** REQ-WEB-010

```gherkin
Feature: Unsanitized HTML 차단

  Scenario: innerHTML 직접 할당 금지 확인
    Given 코드베이스를 검사함
    When innerHTML 사용 부분을 검색함
    Then marked.parse() 결과를 직접 innerHTML에 할당하는 코드가 없어야 함
    Or sanitize 함수를 통해 처리된 결과만 할당되어야 함

  Scenario: dangerouslySetInnerHTML 금지 확인
    Given React/JSX 코드베이스를 검사함
    When dangerouslySetInnerHTML 사용 부분을 검색함
    Then sanitize 함수를 거치지 않은 값은 사용되지 않아야 함

  Scenario: 사용자 입력 HTML 직접 렌더링 차단
    Given 사용자가 "<script>alert('xss')</script>" 입력을 제출함
    When 해당 입력이 화면에 렌더링됨
    Then script 태그가 실행되지 않아야 함
    And 텍스트로만 표시되거나 완전히 제거되어야 함
```

---

## 3. Quality Gate 기준

### 3.1 테스트 커버리지

- Sanitization 함수: 100% 커버리지
- CORS 미들웨어: 90% 이상 커버리지
- 보안 헤더 미들웨어: 100% 커버리지

### 3.2 보안 스캔 기준

| 도구 | 최소 점수/기준 |
|------|---------------|
| securityheaders.com | A 등급 이상 |
| Mozilla Observatory | B+ 등급 이상 |
| OWASP ZAP | High 취약점 0개 |

### 3.3 성능 기준

- Sanitization 처리 시간: 100KB 입력 기준 < 50ms
- 보안 헤더 추가 오버헤드: < 1ms

---

## 4. Definition of Done

- [ ] 모든 수락 기준 테스트 통과
- [ ] 기존 기능 회귀 테스트 통과
- [ ] securityheaders.com A 등급 달성
- [ ] 코드 리뷰 완료 (보안 관점)
- [ ] CSP Report-Only 모드 테스트 완료
- [ ] 프로덕션 배포 및 모니터링 설정

---

## 5. Traceability

| 수락 기준 ID | 요구사항 ID | plan.md Task |
|-------------|------------|--------------|
| AC-WEB-001 | REQ-WEB-001 | M1-T1, M1-T2 |
| AC-WEB-002 | REQ-WEB-002 | M2-T1, M2-T2 |
| AC-WEB-003 | REQ-WEB-003 | M2-T1, M2-T2 |
| AC-WEB-004 | REQ-WEB-004 | M2-T1, M2-T2 |
| AC-WEB-005 | REQ-WEB-005 | M2-T1, M2-T2 |
| AC-WEB-006 | REQ-WEB-006 | M3-T1 |
| AC-WEB-007 | REQ-WEB-007 | M3-T2 |
| AC-WEB-008 | REQ-WEB-008 | M3-T1 |
| AC-WEB-009 | REQ-WEB-009 | M3-T1 |
| AC-WEB-010 | REQ-WEB-010 | M1-T1, M1-T2 |
