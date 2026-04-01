---
id: SPEC-AUTH-001
version: "1.0.0"
status: draft
created: "2026-01-29"
updated: "2026-01-29"
author: "Claude"
priority: P0
tags: [authentication, jwt, security, token]
---

## HISTORY

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0.0 | 2026-01-29 | Claude | 초기 버전 생성 |

---

# SPEC-AUTH-001: JWT 인증 시스템 재설계

## 1. 개요

### 1.1 배경

현재 시스템은 `admin.id`를 Bearer 토큰으로 직접 사용하고 있습니다. 이 방식에는 다음과 같은 심각한 보안 문제가 있습니다:

- **만료 없음**: 토큰이 영구적으로 유효하여 탈취 시 무제한 악용 가능
- **세션 무효화 불가**: 로그아웃 또는 비밀번호 변경 시에도 기존 토큰 계속 유효
- **서명 없음**: 토큰 위변조 검증 불가
- **ID 노출**: 내부 식별자가 외부에 직접 노출

### 1.2 목표

- RS256 알고리즘을 사용한 JWT 기반 인증 시스템 구축
- Access Token / Refresh Token 이중 토큰 체계 도입
- 세션 무효화 및 토큰 블랙리스트 메커니즘 구현

### 1.3 비목표

- OAuth2 소셜 로그인 연동 (향후 SPEC으로 분리)
- 다중 기기 동시 로그인 관리 (현재 범위 외)
- 2FA/MFA 구현 (별도 SPEC 필요)

---

## 2. 요구사항 (EARS Format)

### 2.1 Ubiquitous Requirements (항상 적용)

**REQ-AUTH-001: RS256 JWT 토큰 사용**

> 시스템은 **항상** RS256 알고리즘으로 서명된 JWT 토큰을 인증에 사용해야 한다.

- JWT Header: `{ "alg": "RS256", "typ": "JWT" }`
- Private Key: 토큰 서명용 (서버만 보유)
- Public Key: 토큰 검증용 (배포 가능)

**REQ-AUTH-002: Access Token 15분 만료**

> 시스템은 **항상** Access Token의 만료 시간을 15분으로 설정해야 한다.

- `exp` claim: 발급 시점 + 15분
- 만료된 토큰으로 요청 시 401 Unauthorized 반환

**REQ-AUTH-003: Refresh Token 7일 만료**

> 시스템은 **항상** Refresh Token의 만료 시간을 7일로 설정해야 한다.

- `exp` claim: 발급 시점 + 7일
- Refresh Token은 HttpOnly 쿠키로 저장

### 2.2 Event-Driven Requirements (이벤트 기반)

**REQ-AUTH-004: 로그인 시 양쪽 토큰 발급**

> **WHEN** 사용자가 유효한 자격 증명으로 로그인하면 **THEN** 시스템은 Access Token과 Refresh Token을 모두 발급해야 한다.

응답 형식:
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```
- Refresh Token은 `Set-Cookie` 헤더로 전달

**REQ-AUTH-005: Access Token 갱신 메커니즘**

> **WHEN** 유효한 Refresh Token으로 갱신 요청이 오면 **THEN** 시스템은 새로운 Access Token을 발급해야 한다.

- Endpoint: `POST /api/auth/refresh`
- Refresh Token은 쿠키에서 자동 추출
- 새 Access Token만 응답 본문으로 반환

**REQ-AUTH-006: 세션 무효화 (로그아웃)**

> **WHEN** 사용자가 로그아웃 요청을 하면 **THEN** 시스템은 해당 Refresh Token을 블랙리스트에 등록하고 쿠키를 삭제해야 한다.

- Endpoint: `POST /api/auth/logout`
- Refresh Token의 `jti` claim을 블랙리스트 테이블에 저장
- 쿠키 삭제: `Set-Cookie: refreshToken=; Max-Age=0`

### 2.3 State-Driven Requirements (조건 기반)

**REQ-AUTH-007: Token Blacklist 검증**

> **IF** 요청에 포함된 토큰의 `jti`가 블랙리스트에 존재하면 **THEN** 시스템은 해당 요청을 거부해야 한다.

- Access Token: `jti` 검증
- Refresh Token: `jti` 검증
- 블랙리스트 조회는 캐시 우선

### 2.4 Unwanted Requirements (금지 사항)

**REQ-AUTH-008: admin.id 직접 사용 금지**

> 시스템은 `admin.id`를 Bearer 토큰으로 직접 사용**하지 않아야 한다**.

- 모든 인증은 서명된 JWT를 통해서만 수행
- 기존 코드에서 `admin.id` 토큰 사용 부분 마이그레이션 필요

**REQ-AUTH-009: 만료 없는 토큰 금지**

> 시스템은 만료 시간이 없는 토큰을 발급**하지 않아야 한다**.

- 모든 JWT는 반드시 `exp` claim 포함
- `exp` claim이 없는 토큰은 검증 단계에서 거부

---

## 3. 기술 명세

### 3.1 JWT Payload 구조

**Access Token Payload:**
```json
{
  "sub": "admin_id_uuid",
  "jti": "unique_token_id",
  "iat": 1706500000,
  "exp": 1706500900,
  "type": "access",
  "clinicId": "clinic_uuid",
  "role": "admin"
}
```

**Refresh Token Payload:**
```json
{
  "sub": "admin_id_uuid",
  "jti": "unique_token_id",
  "iat": 1706500000,
  "exp": 1707104800,
  "type": "refresh"
}
```

### 3.2 데이터베이스 스키마

**token_blacklist 테이블:**
```sql
CREATE TABLE token_blacklist (
  jti TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  token_type TEXT NOT NULL CHECK (token_type IN ('access', 'refresh')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_blacklist_expires ON token_blacklist(expires_at);
```

### 3.3 기술적 의존성

- **Cloudflare Workers Crypto API**: RSA 키 생성 및 서명/검증
- **D1 Database**: token_blacklist 테이블 저장
- **jose 라이브러리**: JWT 생성/검증 (Workers 호환)

### 3.4 API Endpoints

| Method | Path | 설명 |
|--------|------|------|
| POST | /api/auth/login | 로그인, 토큰 발급 |
| POST | /api/auth/refresh | Access Token 갱신 |
| POST | /api/auth/logout | 로그아웃, 토큰 무효화 |

---

## 4. 제약 조건

### 4.1 성능 요구사항

- 토큰 검증 응답 시간: P95 < 50ms
- 블랙리스트 조회: P95 < 10ms (캐시 적중 시)

### 4.2 보안 요구사항

- Private Key는 환경 변수로만 관리
- Refresh Token은 HttpOnly, Secure, SameSite=Strict 쿠키로 전달
- 토큰 탈취 대응을 위한 IP/User-Agent 변경 감지 (선택적)

### 4.3 호환성 요구사항

- 기존 클라이언트 마이그레이션 기간 동안 레거시 토큰 지원 (2주)
- 마이그레이션 기간 후 레거시 토큰 완전 차단

---

## 5. Traceability

| 요구사항 ID | plan.md 참조 | acceptance.md 참조 |
|------------|--------------|-------------------|
| REQ-AUTH-001 | M1-T1 | AC-AUTH-001 |
| REQ-AUTH-002 | M1-T1 | AC-AUTH-002 |
| REQ-AUTH-003 | M1-T1 | AC-AUTH-003 |
| REQ-AUTH-004 | M1-T2 | AC-AUTH-004 |
| REQ-AUTH-005 | M1-T3 | AC-AUTH-005 |
| REQ-AUTH-006 | M2-T1 | AC-AUTH-006 |
| REQ-AUTH-007 | M2-T2 | AC-AUTH-007 |
| REQ-AUTH-008 | M3-T1 | AC-AUTH-008 |
| REQ-AUTH-009 | M1-T1 | AC-AUTH-009 |
