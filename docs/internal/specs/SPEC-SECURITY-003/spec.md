---
id: SPEC-SECURITY-003
version: "1.0.0"
status: draft
created: "2026-01-29"
updated: "2026-01-29"
author: "Claude"
priority: P0
tags: [security, xss, cors, headers, web-security]
---

## HISTORY

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0.0 | 2026-01-29 | Claude | 초기 버전 생성 |

---

# SPEC-SECURITY-003: 웹 보안 강화 (XSS, Headers, CORS)

## 1. 개요

### 1.1 배경

현재 시스템에는 여러 웹 보안 취약점이 존재합니다:

1. **XSS 취약점**: `marked.parse()` 사용 시 sanitizer 없이 HTML 렌더링
2. **보안 헤더 누락**: CSP, X-Frame-Options, HSTS 등 필수 헤더 미설정
3. **CORS 와일드카드**: `Access-Control-Allow-Origin: *` 사용
4. **쿠키 파싱 취약점**: 불안전한 쿠키 파서 사용으로 injection 가능성
5. **Origin 검증 취약점**: `endsWith()` 패턴으로 subdomain takeover 가능

### 1.2 목표

- 모든 사용자 입력 HTML에 대한 sanitization 적용
- OWASP 권장 보안 헤더 설정
- 정확한 Origin 화이트리스트 기반 CORS 설정
- 안전한 쿠키 파싱 메커니즘 구현

### 1.3 비목표

- WAF(Web Application Firewall) 구축 (별도 SPEC 필요)
- DDoS 방어 (Cloudflare 기본 기능 활용)
- Rate Limiting (별도 SPEC으로 분리)

---

## 2. 요구사항 (EARS Format)

### 2.1 XSS 방어 요구사항

**REQ-WEB-001: HTML Sanitization 필수**

> **WHEN** `marked.parse()` 결과를 DOM에 렌더링할 때 **THEN** 시스템은 반드시 DOMPurify로 sanitize해야 한다.

- 적용 대상: 모든 Markdown → HTML 변환
- Sanitizer: DOMPurify (isomorphic-dompurify for SSR)
- 허용 태그: 기본 텍스트 서식, 링크, 이미지, 코드 블록
- 금지 태그: `<script>`, `<iframe>`, `<object>`, `<embed>`, event handlers

### 2.2 보안 헤더 요구사항

**REQ-WEB-002: Content-Security-Policy (CSP) 헤더 필수**

> 시스템은 **항상** 모든 응답에 CSP 헤더를 포함해야 한다.

기본 CSP 정책:
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://api.clinic-os.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

**REQ-WEB-003: X-Frame-Options 헤더**

> 시스템은 **항상** `X-Frame-Options: DENY` 헤더를 포함해야 한다.

- Clickjacking 공격 방지
- iframe 내 페이지 로드 차단

**REQ-WEB-004: X-Content-Type-Options 헤더**

> 시스템은 **항상** `X-Content-Type-Options: nosniff` 헤더를 포함해야 한다.

- MIME 타입 스니핑 방지
- Content-Type 헤더 준수 강제

**REQ-WEB-005: Strict-Transport-Security (HSTS) 헤더**

> 시스템은 **항상** HSTS 헤더를 포함해야 한다.

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- HTTPS 강제
- 중간자 공격 방지
- 1년(31536000초) 유효 기간

### 2.3 CORS 요구사항

**REQ-WEB-006: CORS 정확한 도메인 매칭**

> 시스템은 **항상** 정확한 도메인 매칭으로 CORS를 검증해야 한다.

허용 Origin 화이트리스트:
- `https://clinic-os.com`
- `https://www.clinic-os.com`
- `https://app.clinic-os.com`
- `https://admin.clinic-os.com`
- `http://localhost:3000` (개발 환경만)
- `http://localhost:4321` (개발 환경만)

**REQ-WEB-007: 안전한 쿠키 파서 사용**

> 시스템은 **항상** RFC 6265 준수 쿠키 파서를 사용해야 한다.

- 표준 준수 파서 사용 (예: `cookie` npm 패키지)
- 수동 문자열 파싱 금지
- 쿠키 값 인코딩/디코딩 안전하게 처리

**REQ-WEB-008: Origin 화이트리스트 검증**

> **WHEN** CORS preflight 또는 actual 요청이 도착하면 **THEN** 시스템은 Origin 헤더를 화이트리스트와 정확히 비교해야 한다.

- 대소문자 구분 비교
- 정확한 문자열 일치만 허용
- 환경별 화이트리스트 분리 (dev/staging/prod)

### 2.4 Unwanted Requirements (금지 사항)

**REQ-WEB-009: endsWith() 패턴 금지**

> 시스템은 Origin 검증에 `endsWith()` 패턴을 사용**하지 않아야 한다**.

금지 코드 예시:
```typescript
// 금지: subdomain takeover 취약
if (origin.endsWith('.clinic-os.com')) { ... }
```

**REQ-WEB-010: Unsanitized HTML 렌더링 금지**

> 시스템은 sanitize하지 않은 HTML을 DOM에 직접 삽입**하지 않아야 한다**.

금지 패턴:
```typescript
// 금지: XSS 취약
element.innerHTML = marked.parse(userInput);
dangerouslySetInnerHTML={{ __html: marked.parse(userInput) }}
```

---

## 3. 기술 명세

### 3.1 보안 헤더 미들웨어

```typescript
// core/middleware/security-headers.ts
export function securityHeaders(): Middleware {
  return async (c, next) => {
    await next();

    // CSP
    c.header('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.clinic-os.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; '));

    // Other security headers
    c.header('X-Frame-Options', 'DENY');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  };
}
```

### 3.2 CORS 설정

```typescript
// core/middleware/cors.ts
const ALLOWED_ORIGINS: Record<string, string[]> = {
  production: [
    'https://clinic-os.com',
    'https://www.clinic-os.com',
    'https://app.clinic-os.com',
    'https://admin.clinic-os.com'
  ],
  development: [
    'http://localhost:3000',
    'http://localhost:4321'
  ]
};

export function corsMiddleware(env: 'production' | 'development'): Middleware {
  const allowedOrigins = new Set([
    ...ALLOWED_ORIGINS.production,
    ...(env === 'development' ? ALLOWED_ORIGINS.development : [])
  ]);

  return async (c, next) => {
    const origin = c.req.header('Origin');

    if (origin && allowedOrigins.has(origin)) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Credentials', 'true');
      c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    if (c.req.method === 'OPTIONS') {
      return c.text('', 204);
    }

    await next();
  };
}
```

### 3.3 HTML Sanitization

```typescript
// core/utils/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'strong', 'em', 'code', 'pre',
  'blockquote',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td'
];

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class'];

export function sanitizeMarkdown(markdown: string): string {
  const html = marked.parse(markdown);
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false
  });
}
```

### 3.4 기술적 의존성

| 패키지 | 버전 | 용도 |
|--------|------|------|
| isomorphic-dompurify | ^2.x | HTML Sanitization (SSR 호환) |
| cookie | ^0.6.x | 안전한 쿠키 파싱 |

---

## 4. 제약 조건

### 4.1 호환성 제약

- CSP `'unsafe-inline'`은 인라인 스크립트/스타일 사용으로 인해 필요
- 향후 nonce 기반 CSP로 마이그레이션 권장

### 4.2 성능 제약

- DOMPurify 처리 시간: 100KB HTML 기준 < 50ms
- 보안 헤더 추가로 인한 응답 크기 증가: ~500 bytes

### 4.3 운영 제약

- Origin 화이트리스트 변경 시 코드 배포 필요
- CSP 위반 로깅을 위한 report-uri 설정 권장

---

## 5. Traceability

| 요구사항 ID | plan.md 참조 | acceptance.md 참조 |
|------------|--------------|-------------------|
| REQ-WEB-001 | M1-T1 | AC-WEB-001 |
| REQ-WEB-002 | M2-T1 | AC-WEB-002 |
| REQ-WEB-003 | M2-T1 | AC-WEB-003 |
| REQ-WEB-004 | M2-T1 | AC-WEB-004 |
| REQ-WEB-005 | M2-T1 | AC-WEB-005 |
| REQ-WEB-006 | M3-T1 | AC-WEB-006 |
| REQ-WEB-007 | M3-T2 | AC-WEB-007 |
| REQ-WEB-008 | M3-T1 | AC-WEB-008 |
| REQ-WEB-009 | M3-T1 | AC-WEB-009 |
| REQ-WEB-010 | M1-T1 | AC-WEB-010 |
