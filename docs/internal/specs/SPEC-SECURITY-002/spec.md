# SPEC-SECURITY-002: Password Security Enhancement

## TAG BLOCK

```yaml
spec_id: SPEC-SECURITY-002
title: Password Security Enhancement
status: Completed
priority: Critical
created: 2026-01-26
completed: 2026-01-29
assigned: workflow-ddd
domain: security
tags: [security, authentication, password, pbkdf2, rate-limiting]
dependencies: []
related: [SPEC-AUTH-001, SPEC-SECURITY-003]
implementation:
  commit: 4322546
  files_modified: 4
  files_created: 5
  trust5_status: WARNING
  security_status: PASS
```

---

## Overview

이 SPEC은 Clinic-OS의 비밀번호 보안 취약점을 해결하기 위한 비밀번호 해싱 알고리즘 개선, 속도 제한(Rate Limiting), 및 계정 잠금 기능을 정의합니다.

### Background

현재 시스템은 다음과 같은 보안 취약점이 있습니다:

1. **Plain SHA-256**: 솔트 없이 단순 SHA-256 해싱 사용
2. **Rainbow Table Attack**: 동일 비밀번호는 동일 해시 생성
3. **No Key Derivation**: Brute Force 공격에 취약
4. **No Rate Limiting**: 무한 로그인 시도 가능
5. **No Account Lockout**: 실패 횟수 제한 없음

### Objectives

- 안전한 비밀번호 해싱 (PBKDF2-SHA256) 도입
- 로그인 속도 제한 (Rate Limiting) 구현
- 계정 잠금 (Account Lockout) 기능 추가
- 기존 비밀번호 마이그레이션 전략 수립

---

## Environment

### Execution Environment

- **Runtime**: Cloudflare Workers (V8 Isolates)
- **Crypto API**: Web Crypto API (`crypto.subtle`)
- **Database**: Cloudflare D1 (SQLite)
- **Constraints**: No external dependencies (built-in crypto only)

### Affected Components

```
src/pages/api/auth/admin-login.ts       # Admin login endpoint
src/pages/api/auth/super-admin.ts       # Super admin endpoint
src/pages/api/auth/super-admin-password.ts  # Password management
src/lib/password-hasher.ts              # NEW: Password hashing service
src/lib/rate-limiter.ts                 # NEW: Rate limiting service
src/lib/account-lockout.ts              # NEW: Account lockout service
```

### Compliance

- **OWASP Password Storage Guidelines**: PBKDF2 with 100,000+ iterations
- **Healthcare Data Protection**: 민감 의료 데이터 보호 (HIPAA/GDPR 준수)

---

## Assumptions

### Technical Assumptions

1. **Web Crypto API Availability**: Cloudflare Workers는 `crypto.subtle` 전체 기능 지원
2. **Performance Target**: PBKDF2 100,000 iterations 기준 100ms 미만 검증
3. **Migration Safety**: 기존 SHA-256 해시와의 호환성 유지

### Business Assumptions

1. **User Impact**: 기존 사용자는 비밀번호 재설정 불필요 (lazy migration)
2. **Security Priority**: Healthcare 데이터로 인해 보안 최우선
3. **Downtime**: 마이그레이션 중 서비스 중단 없음

### Migration Assumptions

1. **Lazy Migration**: 첫 로그인 시 PBKDF2로 자동 재해싱
2. **Dual Verification**: 기존 SHA-256과 신규 PBKDF2 모두 지원
3. **Password Reset**: 일부 사용자는 비밀번호 재설정 필요 가능

---

## Requirements (EARS Format)

### Ubiquitous Requirements (항상 활성)

**REQ-SEC-001**: 시스템은 모든 비밀번호를 솔트가 포함된 PBKDF2-SHA256 알고리즘으로 해싱하여 저장해야 한다.

**REQ-SEC-002**: 시스템은 모든 로그인 시도(성공/실패)를 IP, 타임스탬프, 계정 ID와 함께 기록해야 한다.

**REQ-SEC-003**: 시스템은 모든 보안 관련 이벤트(계정 잠금, 속도 제한)를 감사 로그에 기록해야 한다.

### Event-Driven Requirements (WHEN-THEN)

**REQ-SEC-101**: WHEN 관리자가 로그인을 시도할 때, THEN 시스템은 PBKDF2-SHA256(100,000 iterations, 32-byte salt)로 해시를 검증해야 한다.

**REQ-SEC-102**: WHEN 관리자가 비밀번호를 변경/재설정할 때, THEN 시스템은 즉시 PBKDF2-SHA256으로 새로운 해시를 생성해야 한다.

**REQ-SEC-103**: WHEN 단일 IP 주소에서 1분 내 10회의 로그인 시도가 발생할 때, THEN 시스템은 해당 IP를 60초간 차단하고 429 상태 코드를 반환해야 한다.

**REQ-SEC-104**: WHEN 단일 계정으로 5회 연속 로그인이 실패할 때, THEN 시스템은 해당 계정을 15분간 잠금하고 'Account locked' 메시지를 표시해야 한다.

**REQ-SEC-105**: WHEN 잠긴 계정의 소유자가 올바른 비밀번호로 로그인을 시도할 때, THEN 시스템은 잠금 기간이 만료될 때까지 로그인을 거부해야 한다.

**REQ-SEC-106**: WHEN 기존 SHA-256 형식의 비밀번호로 로그인이 성공할 때, THEN 시스템은 즉시 PBKDF2-SHA256으로 재해싱하여 저장해야 한다.

### State-Driven Requirements (IF-THEN)

**REQ-SEC-201**: IF 비밀번호 해시가 'pbkdf2_sha256$' 접두사로 시작하면, THEN 시스템은 PBKDF2 검증만 수행해야 한다.

**REQ-SEC-202**: IF 비밀번호 해시가 64자 hex string 형식(SHA-256 legacy)이면, THEN 시스템은 legacy SHA-256 검증을 시도하고 성공 시 PBKDF2로 재해싱해야 한다.

**REQ-SEC-203**: IF 계정이 잠겨있는 상태(locked_until > 현재 시간)이면, THEN 시스템은 모든 로그인 시도를 즉시 거부해야 한다.

**REQ-SEC-204**: IF IP가 속도 제한에 걸려있으면, THEN 시스템은 해당 IP의 모든 요청을 429로 거부해야 한다.

### Unwanted Requirements (금지 사항)

**REQ-SEC-301**: 시스템은 평문 비밀번호를 데이터베이스에 저장해서는 안 된다.

**REQ-SEC-302**: 시스템은 솔트 없는 단방향 해시를 사용해서는 안 된다.

**REQ-SEC-303**: 시스템은 로그인 실패 횟수 제한 없이 무한 시도를 허용해서는 안 된다.

**REQ-SEC-304**: 시스템은 실패한 로그인 시도의 구체적인 이유(사용자 존재 여부 등)를 공격자에게 노출해서는 안 된다.

### Optional Requirements (선택 사항)

**REQ-SEC-401**: 가능하면 2FA/MFA(TOTP, SMS) 지원을 제공해야 한다.

**REQ-SEC-402**: 가능하면 관리자가 계정 잠금을 수동으로 해제할 수 있는 기능을 제공해야 한다.

**REQ-SEC-403**: 가능하면 속도 제한 및 계정 잠금 이력을 대시보드에서 확인할 수 있어야 한다.

---

## Technical Specifications

### Password Hashing Format

**PBKDF2-SHA256 Hash Format**:
```
pbkdf2_sha256$iterations$salt$hash
```

**Example**:
```
pbkdf2_sha256$100000$a1b2c3d4e5f6...$9z8y7x6w5v4u...
```

**Components**:
- **Algorithm**: `pbkdf2_sha256` (고정 접두사)
- **Iterations**: `100000` (PBKDF2 반복 횟수)
- **Salt**: 32 bytes (64 hex characters, `crypto.getRandomValues`)
- **Hash**: 32 bytes (64 hex characters, PBKDF2 output)

**Web Crypto API Parameters**:
```typescript
const algorithm = {
  name: 'PBKDF2',
  hash: 'SHA-256',
  iterations: 100000
};

const salt = crypto.getRandomValues(new Uint8Array(32));
const derivedBits = 256; // 256 bits output
```

### Legacy SHA-256 Format (Backward Compatibility)

**Legacy Format**:
```
<64-char hex string>
```

**Migration Strategy**: Lazy Migration
1. 첫 로그인 시 SHA-256 검증
2. 성공 시 PBKDF2로 재해싱
3. DB 업데이트
4. 다음 로그인부터 PBKDF2만 사용

### Rate Limiting Rules

**IP-Based Rate Limiting**:
- **Threshold**: 10 attempts per 1 minute
- **Duration**: 60 seconds block
- **Scope**: Per IP address
- **Response**: HTTP 429 Too Many Requests

**Account-Based Rate Limiting**:
- **Threshold**: 5 consecutive failed attempts
- **Duration**: 15 minutes lock
- **Scope**: Per account (user_id)
- **Response**: HTTP 403 Forbidden with 'Account locked' message

### Database Schema Changes

**members 테이블 추가 컬럼**:
```sql
ALTER TABLE members ADD COLUMN password_hash_format TEXT DEFAULT 'sha256_legacy';
ALTER TABLE members ADD COLUMN password_salt TEXT;  -- For PBKDF2
ALTER TABLE members ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE members ADD COLUMN locked_until TEXT;  -- ISO 8601 timestamp
ALTER TABLE members ADD COLUMN last_login_at TEXT;  -- ISO 8601 timestamp
```

**rate_limit_events 테이블 (NEW)**:
```sql
CREATE TABLE rate_limit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL,
  user_id INTEGER,
  event_type TEXT NOT NULL,  -- 'login_attempt', 'account_locked', 'rate_limit_exceeded'
  timestamp TEXT NOT NULL,
  success BOOLEAN,
  metadata TEXT  -- JSON
);

CREATE INDEX idx_rate_limit_events_ip_time ON rate_limit_events(ip_address, timestamp);
CREATE INDEX idx_rate_limit_events_user_time ON rate_limit_events(user_id, timestamp);
```

---

## Traceability

### Requirements to Implementation Mapping

| REQ ID | Requirement | Implementation File |
|--------|-------------|---------------------|
| REQ-SEC-001 | PBKDF2 해싱 | `src/lib/password-hasher.ts` |
| REQ-SEC-002 | 로그인 기록 | `src/lib/rate-limiter.ts` |
| REQ-SEC-003 | 감사 로그 | `src/lib/audit-logger.ts` |
| REQ-SEC-101 | PBKDF2 검증 | `src/pages/api/auth/admin-login.ts` |
| REQ-SEC-103 | IP 속도 제한 | `src/lib/rate-limiter.ts` |
| REQ-SEC-104 | 계정 잠금 | `src/lib/account-lockout.ts` |
| REQ-SEC-106 | Lazy 마이그레이션 | `src/lib/password-hasher.ts` |

### Test Coverage

- Unit Tests: `src/lib/__tests__/password-hasher.test.ts`
- Integration Tests: `src/pages/api/__tests__/auth.test.ts`
- Security Tests: `src/__tests__/security/password-security.test.ts`

---

## Non-Functional Requirements

### Performance

- PBKDF2 검증 시간: < 100ms (100,000 iterations)
- 속도 제한 확인: < 10ms
- 계정 잠금 확인: < 10ms

### Security

- OWASP Password Storage Cheat Sheet 준수
- NIST SP 800-63B 준수 (Digital Identity Guidelines)
- Timing Attack 방지 (constant-time comparison)

### Reliability

- 마이그레이션 실패 시 롤백 메커니즘
- 데이터베이스 트랜잭션 무결성
- 에러 로그 및 모니터링

### Maintainability

- 코드 복잡도 제한 (cyclomatic complexity < 10)
- 포괄적인 테스트 커버리지 (85%+)
- 명확한 API 문서화

---

## Risks and Mitigations

### Risk 1: Performance Degradation

**Risk**: PBKDF2 100,000 iterations 기존 SHA-256보다 100배 느림

**Mitigation**:
- Cloudflare Workers의 빠른 V8 엔진 활용
- Iterations 튜닝 (보안/성능 밸런스)
- 모니터링 및 경고 시스템

### Risk 2: Migration Failures

**Risk**: 일부 사용자 비밀번호 마이그레이션 실패

**Mitigation**:
- 이중 검증 (PBKDF2 + SHA-256 legacy)
- 광범위한 테스트
- 롤백 계획

### Risk 3: Denial of Service

**Risk**: 공격자가 속도 제한 우회하여 DoS 공격

**Mitigation**:
- IP 기반 속도 제한
- 계정 기반 잠금
- CAPTCHA 도입 고려 (future)

### Risk 4: Locked Out Admins

**Risk**: 모든 관리자 계정이 잠겨서 시스템 관리 불가

**Mitigation**:
- Super Admin 계정 예외 처리
- 수동 잠금 해제 기능
- 비상 복구 절차

---

## Dependencies

### External Dependencies

- **None**: Web Crypto API only (built-in)

### Internal Dependencies

- `src/lib/crypto.ts`: 기존 암호화 유틸리티
- `src/lib/permissions.ts`: 권한 관리
- Database: D1 Database migrations

### Blocking Dependencies

- None (Critical security issue, immediate action required)

---

## Success Criteria

### Functional Requirements

- 모든 신규 비밀번호가 PBKDF2-SHA256으로 해싱됨
- 기존 SHA-256 비밀번호가 lazy migration으로 자동 변환됨
- IP 속도 제한이 정상 작동함
- 계정 잠금이 정상 작동함

### Non-Functional Requirements

- PBKDF2 검증이 100ms 미만으로 완료됨
- 속도 제한 확인이 10ms 미만으로 완료됨
- 테스트 커버리지가 85% 이상임
- OWASP 보안 기준 준수

### Quality Gates

- Zero critical security vulnerabilities
- All acceptance criteria passed
- Performance benchmarks met
- Code review completed

---

**Version**: 1.0.0
**Last Updated**: 2026-01-26
**Status**: Ready for Implementation
