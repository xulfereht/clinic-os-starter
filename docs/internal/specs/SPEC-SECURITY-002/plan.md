# Implementation Plan: Password Security Enhancement

**SPEC ID**: SPEC-SECURITY-002
**Status**: Planned
**Priority**: CRITICAL

---

## Overview

이 문서는 비밀번호 보안 강화 구현을 위한 기술적 접근 방식, 마일스톤, 및 아키텍처 설계를 정의합니다.

---

## Implementation Milestones

### Priority 1: Core Password Hashing (필수)

**목표**: 안전한 비밀번호 해싱 시스템 구현

**작업**:
1. PasswordHasher 서비스 구현
   - PBKDF2-SHA256 해싱 함수
   - 솔트 생성 (32 bytes)
   - 해시 검증 함수
   - Legacy SHA-256 호환 계층

2. 데이터베이스 마이그레이션
   - `password_hash_format` 컬럼 추가
   - `password_salt` 컬럼 추가
   - 기존 데이터 마이그레이션 스크립트

3. 인증 API 업데이트
   - admin-login.ts 업데이트
   - super-admin.ts 업데이트
   - super-admin-password.ts 업데이트

**성공 기준**:
- 모든 신규 비밀번호가 PBKDF2로 해싱됨
- 기존 비밀번호와 호환됨
- 검증 시간이 100ms 미만임

### Priority 2: Rate Limiting (필수)

**목표**: 로그인 속도 제한 구현

**작업**:
1. RateLimiter 서비스 구현
   - IP 기반 속도 제한 (10회/1분)
   - D1 Database 이벤트 기록
   - Sliding Window 알고리즘

2. rate_limit_events 테이블 생성
   - 스키마 정의
   - 인덱스 생성 (ip_address, timestamp)

3. 미들웨어 통합
   - auth 미들웨어에 속도 제한 적용
   - 429 응답 처리

**성공 기준**:
- 1분 10회 초과 시 429 반환
- 60초 후 자동 차단 해제
- 속도 제한 확인이 10ms 미만임

### Priority 3: Account Lockout (필수)

**목표**: 계정 잠금 기능 구현

**작업**:
1. AccountLockout 서비스 구현
   - 실패 횟수 추적
   - 5회 연속 실패 시 15분 잠금
   - 잠금 상태 확인

2. members 테이블 컬럼 추가
   - `failed_login_attempts` 컬럼
   - `locked_until` 컬럼
   - `last_login_at` 컬럼

3. 관리자 기능
   - 수동 잠금 해제 API
   - 잠금 사용자 목록 조회

**성공 기준**:
- 5회 실패 후 15분 잠금
- 잠금 중 로그인 거부
- 관리자가 수동 해제 가능

### Priority 4: Testing & Documentation (필수)

**목표**: 테스트 및 문서화

**작업**:
1. 단위 테스트 작성
   - PasswordHasher 테스트
   - RateLimiter 테스트
   - AccountLockout 테스트

2. 통합 테스트 작성
   - 로그인 플로우 테스트
   - 마이그레이션 테스트
   - 보안 테스트

3. 문서 작성
   - API 문서 업데이트
   - 보안 가이드 작성
   - 운영 가이드 작성

**성공 기준**:
- 테스트 커버리지 85% 이상
- 모든 acceptance criteria 통과
- OWASP 기준 준수 확인

### Priority 5: Monitoring & Alerting (선택)

**목표**: 모니터링 및 알림 시스템

**작업**:
1. 메트릭 수집
   - 로그인 성공/실패율
   - 속도 제한 발생 횟수
   - 계정 잠금 발생 횟수

2. 알림 시스템
   - 의심스러운 활동 알림
   - 다중 계정 잠금 경고

3. 대시보드
   - 보안 이벤트 대시보드
   - 잠금 사용자 목록

---

## Technical Approach

### 1. Password Hashing Architecture

**Service: PasswordHasher** (`src/lib/password-hasher.ts`)

```typescript
/**
 * Password Hashing Service using PBKDF2-SHA256
 *
 * Format: pbkdf2_sha256$iterations$salt$hash
 *
 * @example
 * const hash = await PasswordHasher.hash('password123');
 * const valid = await PasswordHasher.verify('password123', hash);
 */
export class PasswordHasher {
  private static readonly ALGORITHM = 'PBKDF2';
  private static readonly HASH = 'SHA-256';
  private static readonly ITERATIONS = 100000;
  private static readonly SALT_LENGTH = 32; // bytes
  private static readonly DERIVED_BITS = 256; // bits

  /**
   * Hash a password using PBKDF2-SHA256
   */
  static async hash(password: string): Promise<string> {
    // Implementation using crypto.subtle
  }

  /**
   * Verify a password against a hash
   * Supports both PBKDF2 and legacy SHA-256 formats
   */
  static async verify(password: string, hash: string): Promise<boolean> {
    // Dual verification: PBKDF2 first, then legacy SHA-256
  }

  /**
   * Check if hash is in PBKDF2 format
   */
  static isPBKDF2Hash(hash: string): boolean {
    return hash.startsWith('pbkdf2_sha256$');
  }

  /**
   * Migrate legacy SHA-256 hash to PBKDF2
   */
  static async migrate(password: string, legacyHash: string): Promise<string> {
    // Rehash using PBKDF2
  }
}
```

**Web Crypto API Usage**:

```typescript
async function pbkdf2Hash(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt,
      iterations: 100000
    },
    keyMaterial,
    256
  );

  return new Uint8Array(derivedBits);
}
```

### 2. Rate Limiting Architecture

**Service: RateLimiter** (`src/lib/rate-limiter.ts`)

```typescript
/**
 * Rate Limiting Service using Sliding Window
 *
 * IP-based: 10 attempts per 1 minute
 * Account-based: 5 consecutive failures trigger lockout
 */
export class RateLimiter {
  private static readonly IP_THRESHOLD = 10;
  private static readonly IP_WINDOW_MS = 60 * 1000; // 1 minute
  private static readonly IP_BLOCK_DURATION_MS = 60 * 1000; // 1 minute

  /**
   * Check if IP is rate limited
   */
  static async checkIP(ip: string): Promise<{
    allowed: boolean;
    retryAfter?: number;
  }> {
    // Query rate_limit_events for last minute
    // Count attempts for this IP
    // Return allowed/retryAfter
  }

  /**
   * Record login attempt
   */
  static async recordAttempt(data: {
    ip: string;
    userId?: number;
    success: boolean;
  }): Promise<void> {
    // Insert into rate_limit_events
  }

  /**
   * Clean up old events (older than 1 hour)
   */
  static async cleanup(): Promise<void> {
    // DELETE FROM rate_limit_events WHERE timestamp < datetime('now', '-1 hour')
  }
}
```

**Sliding Window Algorithm**:

```sql
-- Check IP rate limit
SELECT COUNT(*) as attempts
FROM rate_limit_events
WHERE ip_address = ?
  AND event_type = 'login_attempt'
  AND timestamp > datetime('now', '-1 minute');

-- If attempts >= 10, block IP
```

### 3. Account Lockout Architecture

**Service: AccountLockout** (`src/lib/account-lockout.ts`)

```typescript
/**
 * Account Lockout Service
 *
 * Locks account after 5 consecutive failed login attempts
 * Lock duration: 15 minutes
 */
export class AccountLockout {
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Record failed login attempt
   */
  static async recordFailure(userId: number): Promise<{
    locked: boolean;
    remainingAttempts: number;
  }> {
    // Increment failed_login_attempts
    // If >= MAX_ATTEMPTS, set locked_until
  }

  /**
   * Record successful login
   */
  static async recordSuccess(userId: number): Promise<void> {
    // Reset failed_login_attempts to 0
    // Clear locked_until
    // Update last_login_at
  }

  /**
   * Check if account is locked
   */
  static async isLocked(userId: number): Promise<boolean> {
    // Check if locked_until > now
  }

  /**
   * Manually unlock account (admin only)
   */
  static async unlock(userId: number): Promise<void> {
    // Clear locked_until and failed_login_attempts
  }

  /**
   * Get all locked accounts
   */
  static async getLockedAccounts(): Promise<Array<{
    userId: number;
    lockedUntil: string;
  }>> {
    // SELECT users with locked_until > now
  }
}
```

### 4. Integration with Auth API

**Updated Login Flow** (`src/pages/api/auth/admin-login.ts`):

```typescript
export async function POST({ request }: APIContext) {
  const { email, password } = await request.json();
  const ip = getClientIP(request);

  // Step 1: Rate limiting check (IP-based)
  const rateLimitCheck = await RateLimiter.checkIP(ip);
  if (!rateLimitCheck.allowed) {
    return new Response('Too many attempts', { status: 429 });
  }

  // Step 2: Find user
  const user = await getUserByEmail(email);
  if (!user) {
    await RateLimiter.recordAttempt({ ip, success: false });
    return new Response('Invalid credentials', { status: 401 });
  }

  // Step 3: Check account lockout
  if (await AccountLockout.isLocked(user.id)) {
    return new Response('Account locked', { status: 403 });
  }

  // Step 4: Verify password (PBKDF2 or legacy SHA-256)
  const passwordValid = await PasswordHasher.verify(password, user.password_hash);

  if (!passwordValid) {
    // Record failure and check lockout
    const { locked } = await AccountLockout.recordFailure(user.id);
    await RateLimiter.recordAttempt({ ip, userId: user.id, success: false });

    if (locked) {
      return new Response('Account locked', { status: 403 });
    }
    return new Response('Invalid credentials', { status: 401 });
  }

  // Step 5: Check if legacy hash, migrate to PBKDF2
  if (!PasswordHasher.isPBKDF2Hash(user.password_hash)) {
    const newHash = await PasswordHasher.hash(password);
    await updateUserPasswordHash(user.id, newHash);
  }

  // Step 6: Record success
  await AccountLockout.recordSuccess(user.id);
  await RateLimiter.recordAttempt({ ip, userId: user.id, success: true });

  // Step 7: Create session
  // ... existing session creation logic
}
```

---

## Database Migration Strategy

### Phase 1: Schema Changes

**Migration File**: `migrations/0520_password_security.sql`

```sql
-- Add password hash format tracking
ALTER TABLE members ADD COLUMN password_hash_format TEXT DEFAULT 'sha256_legacy';
ALTER TABLE members ADD COLUMN password_salt TEXT;

-- Add failed login tracking
ALTER TABLE members ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE members ADD COLUMN locked_until TEXT;
ALTER TABLE members ADD COLUMN last_login_at TEXT;

-- Create rate limit events table
CREATE TABLE rate_limit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL,
  user_id INTEGER,
  event_type TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  success BOOLEAN,
  metadata TEXT
);

-- Indexes for performance
CREATE INDEX idx_rate_limit_events_ip_time ON rate_limit_events(ip_address, timestamp);
CREATE INDEX idx_rate_limit_events_user_time ON rate_limit_events(user_id, timestamp);
CREATE INDEX idx_members_locked_until ON members(locked_until) WHERE locked_until IS NOT NULL;
```

### Phase 2: Data Migration (Lazy Migration)

**Strategy**: No immediate data migration required

**Rationale**:
- 기존 SHA-256 해시는 그대로 유지
- `password_hash_format = 'sha256_legacy'`로 표시
- 첫 로그인 시 자동 PBKDF2 재해싱
- 점진적 마이그레이션 (Zero Downtime)

**Migration Flow**:

```
1. User logs in with old SHA-256 hash
2. PasswordHasher.verify() detects legacy format
3. Verifies using SHA-256 (one last time)
4. If valid, rehashes using PBKDF2
5. Updates DB with new hash and format='pbkdf2_sha256'
6. Next login uses PBKDF2 only
```

### Phase 3: Cleanup (Future)

**After 90%+ Migration**:

```sql
-- Identify remaining legacy accounts
SELECT email, password_hash_format
FROM members
WHERE password_hash_format = 'sha256_legacy';

-- Force password reset for remaining legacy accounts
UPDATE members
SET password_change_required = 1
WHERE password_hash_format = 'sha256_legacy'
AND created_at < datetime('now', '-6 months');
```

---

## Testing Strategy

### Unit Tests

**PasswordHasher Tests** (`src/lib/__tests__/password-hasher.test.ts`):

```typescript
describe('PasswordHasher', () => {
  it('should hash password using PBKDF2', async () => {
    const hash = await PasswordHasher.hash('password123');
    expect(hash).toMatch(/^pbkdf2_sha256\$100000\$/);
  });

  it('should verify correct password', async () => {
    const hash = await PasswordHasher.hash('password123');
    const valid = await PasswordHasher.verify('password123', hash);
    expect(valid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const hash = await PasswordHasher.hash('password123');
    const valid = await PasswordHasher.verify('wrongpassword', hash);
    expect(valid).toBe(false);
  });

  it('should verify legacy SHA-256 hash', async () => {
    const legacyHash = sha256('password123'); // 64 hex chars
    const valid = await PasswordHasher.verify('password123', legacyHash);
    expect(valid).toBe(true);
  });

  it('should migrate legacy hash to PBKDF2', async () => {
    const legacyHash = sha256('password123');
    const newHash = await PasswordHasher.migrate('password123', legacyHash);
    expect(newHash).toMatch(/^pbkdf2_sha256\$100000\$/);
  });

  it('should complete verification within 100ms', async () => {
    const hash = await PasswordHasher.hash('password123');
    const start = Date.now();
    await PasswordHasher.verify('password123', hash);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });
});
```

**RateLimiter Tests** (`src/lib/__tests__/rate-limiter.test.ts`):

```typescript
describe('RateLimiter', () => {
  it('should allow requests under threshold', async () => {
    for (let i = 0; i < 9; i++) {
      const result = await RateLimiter.checkIP('127.0.0.1');
      expect(result.allowed).toBe(true);
    }
  });

  it('should block requests over threshold', async () => {
    // Make 10 requests
    for (let i = 0; i < 10; i++) {
      await RateLimiter.recordAttempt({ ip: '127.0.0.1', success: false });
    }
    const result = await RateLimiter.checkIP('127.0.0.1');
    expect(result.allowed).toBe(false);
  });

  it('should reset after window expires', async () => {
    // Make 10 requests
    for (let i = 0; i < 10; i++) {
      await RateLimiter.recordAttempt({
        ip: '127.0.0.1',
        success: false,
        timestamp: Date.now() - 61 * 1000 // 61 seconds ago
      });
    }
    const result = await RateLimiter.checkIP('127.0.0.1');
    expect(result.allowed).toBe(true);
  });
});
```

**AccountLockout Tests** (`src/lib/__tests__/account-lockout.test.ts`):

```typescript
describe('AccountLockout', () => {
  it('should lock account after 5 failures', async () => {
    for (let i = 0; i < 5; i++) {
      await AccountLockout.recordFailure(1);
    }
    const locked = await AccountLockout.isLocked(1);
    expect(locked).toBe(true);
  });

  it('should not lock account under 5 failures', async () => {
    for (let i = 0; i < 4; i++) {
      await AccountLockout.recordFailure(1);
    }
    const locked = await AccountLockout.isLocked(1);
    expect(locked).toBe(false);
  });

  it('should reset failures on success', async () => {
    await AccountLockout.recordFailure(1);
    await AccountLockout.recordSuccess(1);
    const { remainingAttempts } = await AccountLockout.recordFailure(1);
    expect(remainingAttempts).toBe(4); // Reset to 1/5
  });
});
```

### Integration Tests

**Login Flow Test** (`src/pages/api/__tests__/auth.test.ts`):

```typescript
describe('POST /api/auth/admin-login', () => {
  it('should login with correct credentials', async () => {
    const response = await fetch('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@test.com', password: 'Test@1234!' })
    });
    expect(response.status).toBe(200);
  });

  it('should reject incorrect password', async () => {
    const response = await fetch('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@test.com', password: 'wrong' })
    });
    expect(response.status).toBe(401);
  });

  it('should lock account after 5 failures', async () => {
    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await fetch('/api/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@test.com', password: 'wrong' })
      });
    }
    // 6th attempt should return 403
    const response = await fetch('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@test.com', password: 'Test@1234!' })
    });
    expect(response.status).toBe(403);
  });

  it('should return 429 after 10 IP-based attempts', async () => {
    // Make 10 attempts from same IP
    for (let i = 0; i < 10; i++) {
      await fetch('/api/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ email: 'user@test.com', password: 'wrong' })
      });
    }
    // 11th attempt should return 429
    const response = await fetch('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@test.com', password: 'Test@1234!' })
    });
    expect(response.status).toBe(429);
  });
});
```

### Security Tests

**Security Test Suite** (`src/__tests__/security/password-security.test.ts`):

```typescript
describe('Password Security', () => {
  it('should use unique salt for each password', async () => {
    const hash1 = await PasswordHasher.hash('password');
    const hash2 = await PasswordHasher.hash('password');
    const salt1 = extractSalt(hash1);
    const salt2 = extractSalt(hash2);
    expect(salt1).not.toEqual(salt2);
  });

  it('should produce different hashes for same password', async () => {
    const hash1 = await PasswordHasher.hash('password');
    const hash2 = await PasswordHasher.hash('password');
    expect(hash1).not.toEqual(hash2);
  });

  it('should not store plaintext password', async () => {
    const password = 'plaintext123';
    const hash = await PasswordHasher.hash(password);
    expect(hash).not.toContain(password);
  });

  it('should be resistant to timing attacks', async () => {
    const hash = await PasswordHasher.hash('password');
    const start1 = Date.now();
    await PasswordHasher.verify('password', hash);
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    await PasswordHasher.verify('wrong', hash);
    const time2 = Date.now() - start2;

    // Time difference should be < 10ms
    expect(Math.abs(time1 - time2)).toBeLessThan(10);
  });
});
```

---

## Risk Mitigation

### Risk 1: Performance Degradation

**Probability**: Medium
**Impact**: Medium

**Mitigation**:
1. Benchmark PBKDF2 on Cloudflare Workers
2. Tune iterations based on performance
3. Monitor in production with alerts
4. Fallback to lower iterations if needed

### Risk 2: Migration Failures

**Probability**: Low
**Impact**: High

**Mitigation**:
1. Dual verification (PBKDF2 + legacy SHA-256)
2. Comprehensive testing before deployment
3. Gradual rollout (canary deployment)
4. Rollback plan ready

### Risk 3: All Admins Locked Out

**Probability**: Low
**Impact**: Critical

**Mitigation**:
1. Super Admin account exempt from lockout
2. Manual unlock API for emergencies
3. Emergency unlock script available
4. Documented recovery procedure

### Risk 4: Denial of Service

**Probability**: Medium
**Impact**: Medium

**Mitigation**:
1. IP-based rate limiting
2. Account-based lockout
3. CAPTCHA for suspicious activity (future)
4. Monitoring and alerting

---

## Rollback Plan

### If Critical Issues Arise

1. **Immediate Rollback**:
   ```sql
   -- Revert to legacy SHA-256 verification
   UPDATE members SET password_hash_format = 'sha256_legacy';
   ```

2. **Disable New Features**:
   - Comment out rate limiting checks
   - Comment out account lockout logic
   - Revert to simple SHA-256 verification

3. **Restore Database**:
   - Use D1 database backup if needed
   - Restore from snapshot before migration

4. **Communicate**:
   - Notify team of rollback
   - Document issues
   - Plan fix and retry

---

## Definition of Done

- All Priority 1-4 milestones completed
- Unit tests passing (85%+ coverage)
- Integration tests passing
- Security tests passing
- Performance benchmarks met (< 100ms for PBKDF2)
- Code review completed
- Documentation updated
- Zero critical security vulnerabilities
- OWASP guidelines compliance verified

---

**Version**: 1.0.0
**Last Updated**: 2026-01-26
**Status**: Ready for Implementation
