---
spec_id: SPEC-SECURITY-003
version: "1.0.0"
created: "2026-01-29"
updated: "2026-01-29"
---

# SPEC-SECURITY-003 구현 계획: 웹 보안 강화

## 1. 마일스톤 개요

### Milestone 1: XSS 방어 구현 (Priority: High)

HTML sanitization을 통한 XSS 공격 방어를 구현합니다.

### Milestone 2: 보안 헤더 미들웨어 (Priority: High)

OWASP 권장 보안 헤더를 모든 응답에 적용합니다.

### Milestone 3: CORS 및 쿠키 보안 (Priority: High)

안전한 CORS 설정과 쿠키 파싱을 구현합니다.

---

## 2. 상세 구현 계획

### Milestone 1: XSS 방어 구현

**M1-T1: HTML Sanitization 유틸리티 구현**

- 파일: `core/utils/sanitize.ts`
- 내용:
  - `sanitizeMarkdown(markdown: string)`: Markdown → 안전한 HTML
  - `sanitizeHtml(html: string)`: 임의 HTML → 안전한 HTML
  - DOMPurify 설정 (허용 태그, 속성 정의)
- 의존성: `isomorphic-dompurify` 설치
- 관련 요구사항: REQ-WEB-001, REQ-WEB-010

**M1-T2: 기존 marked.parse() 사용 코드 마이그레이션**

- 검색 대상: 프로젝트 내 모든 `marked.parse()` 호출
- 변경 내용:
  - `marked.parse(input)` → `sanitizeMarkdown(input)`
  - `dangerouslySetInnerHTML` 사용 부분 검토
- 관련 요구사항: REQ-WEB-001, REQ-WEB-010

**M1-T3: XSS 테스트 케이스 작성**

- 파일: `tests/security/xss.test.ts`
- 테스트 케이스:
  - `<script>alert(1)</script>` 제거 확인
  - `<img onerror="alert(1)">` 이벤트 핸들러 제거 확인
  - 정상적인 Markdown 서식 유지 확인
- 관련 요구사항: REQ-WEB-001

### Milestone 2: 보안 헤더 미들웨어

**M2-T1: 보안 헤더 미들웨어 구현**

- 파일: `core/middleware/security-headers.ts`
- 내용:
  - CSP 헤더 설정 (REQ-WEB-002)
  - X-Frame-Options 설정 (REQ-WEB-003)
  - X-Content-Type-Options 설정 (REQ-WEB-004)
  - HSTS 설정 (REQ-WEB-005)
  - X-XSS-Protection 설정
  - Referrer-Policy 설정
  - Permissions-Policy 설정
- 관련 요구사항: REQ-WEB-002, REQ-WEB-003, REQ-WEB-004, REQ-WEB-005

**M2-T2: 미들웨어 적용**

- 파일: `index.ts` (메인 앱 진입점)
- 내용:
  - 보안 헤더 미들웨어를 최상위에 적용
  - 모든 라우트에 적용되도록 설정
- 관련 요구사항: REQ-WEB-002, REQ-WEB-003, REQ-WEB-004, REQ-WEB-005

**M2-T3: CSP 위반 리포팅 설정 (선택적)**

- 파일: `routes/csp-report.ts`
- 내용:
  - CSP 위반 리포트 수신 엔드포인트
  - 위반 내역 로깅
- 관련 요구사항: REQ-WEB-002

### Milestone 3: CORS 및 쿠키 보안

**M3-T1: CORS 미들웨어 리팩토링**

- 파일: `core/middleware/cors.ts`
- 내용:
  - Origin 화이트리스트 정의 (환경별)
  - 정확한 문자열 매칭으로 Origin 검증
  - `endsWith()` 패턴 사용 코드 제거
  - Preflight 요청 처리
- 관련 요구사항: REQ-WEB-006, REQ-WEB-008, REQ-WEB-009

**M3-T2: 쿠키 파서 교체**

- 파일: 쿠키 파싱 관련 모든 파일
- 내용:
  - 수동 쿠키 파싱 코드 제거
  - `cookie` 패키지 사용으로 교체
  - RFC 6265 준수 확인
- 의존성: `cookie` 패키지 설치
- 관련 요구사항: REQ-WEB-007

**M3-T3: CORS 테스트 케이스 작성**

- 파일: `tests/security/cors.test.ts`
- 테스트 케이스:
  - 허용 Origin에서의 요청 성공
  - 비허용 Origin에서의 요청 차단
  - subdomain takeover 시도 차단
  - Preflight 요청 처리
- 관련 요구사항: REQ-WEB-006, REQ-WEB-008, REQ-WEB-009

---

## 3. 기술적 접근 방식

### 3.1 아키텍처 설계

```
[Client Request]
       │
       ▼
┌─────────────────────────────────────────┐
│           Security Middleware Stack      │
│  ┌───────────────────────────────────┐  │
│  │   1. Security Headers Middleware  │  │
│  │   - CSP, HSTS, X-Frame-Options    │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │   2. CORS Middleware              │  │
│  │   - Origin Whitelist Check        │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │   3. Auth Middleware              │  │
│  │   - Cookie Parsing (RFC 6265)     │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
       │
       ▼
[Route Handlers]
       │
       ▼
┌─────────────────────────────────────────┐
│        Content Processing               │
│  ┌───────────────────────────────────┐  │
│  │   HTML Sanitization               │  │
│  │   marked.parse() + DOMPurify      │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
       │
       ▼
[Response with Security Headers]
```

### 3.2 DOMPurify 설정 전략

| 컨텍스트 | 허용 태그 | 금지 | 비고 |
|---------|----------|------|------|
| 일반 콘텐츠 | 기본 서식 | script, iframe | 대부분의 경우 |
| 관리자 콘텐츠 | + embed | script | 신뢰된 소스 |
| 코멘트 | 텍스트만 | 모든 HTML | 최소 권한 |

### 3.3 CORS 설정 전략

**환경별 Origin 화이트리스트:**

```
Production:
├── https://clinic-os.com
├── https://www.clinic-os.com
├── https://app.clinic-os.com
└── https://admin.clinic-os.com

Development:
├── (Production Origins)
├── http://localhost:3000
└── http://localhost:4321

Staging:
├── (Production Origins)
└── https://staging.clinic-os.com
```

---

## 4. 리스크 및 대응 계획

### 4.1 기술적 리스크

**리스크 1: CSP로 인한 기존 기능 장애**

- 설명: 인라인 스크립트/스타일이 CSP에 의해 차단될 수 있음
- 대응: Report-Only 모드로 먼저 배포하여 위반 사항 수집
- 대안: nonce 기반 CSP로 인라인 허용 (복잡도 증가)

**리스크 2: DOMPurify로 인한 의도한 HTML 제거**

- 설명: 정당한 HTML 콘텐츠가 sanitization 과정에서 제거될 수 있음
- 대응: 허용 태그 목록을 점진적으로 확장
- 테스트: 기존 콘텐츠로 회귀 테스트

### 4.2 비즈니스 리스크

**리스크 3: CORS 설정 오류로 인한 서비스 장애**

- 설명: 허용 Origin 누락 시 정상 클라이언트 요청 차단
- 대응: 환경 변수로 Origin 목록 관리, 배포 전 테스트 필수

---

## 5. 검증 계획

### 5.1 자동화 테스트

- XSS payload 테스트 (OWASP 치트시트 기반)
- 보안 헤더 존재 확인 테스트
- CORS 정책 검증 테스트

### 5.2 수동 테스트

- 브라우저 개발자 도구에서 헤더 확인
- CSP 위반 콘솔 로그 확인
- CORS 프리플라이트 요청 검증

### 5.3 보안 스캔

- OWASP ZAP 스캔
- securityheaders.com 점수 확인
- Mozilla Observatory 스캔

---

## 6. Traceability Matrix

| Task ID | 관련 요구사항 | 검증 항목 |
|---------|--------------|----------|
| M1-T1 | REQ-WEB-001, REQ-WEB-010 | AC-WEB-001, AC-WEB-010 |
| M1-T2 | REQ-WEB-001, REQ-WEB-010 | AC-WEB-001, AC-WEB-010 |
| M1-T3 | REQ-WEB-001 | AC-WEB-001 |
| M2-T1 | REQ-WEB-002, 003, 004, 005 | AC-WEB-002, 003, 004, 005 |
| M2-T2 | REQ-WEB-002, 003, 004, 005 | AC-WEB-002, 003, 004, 005 |
| M3-T1 | REQ-WEB-006, 008, 009 | AC-WEB-006, 008, 009 |
| M3-T2 | REQ-WEB-007 | AC-WEB-007 |
| M3-T3 | REQ-WEB-006, 008, 009 | AC-WEB-006, 008, 009 |
