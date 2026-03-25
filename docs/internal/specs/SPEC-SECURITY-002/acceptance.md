# Acceptance Criteria: Password Security Enhancement

**SPEC ID**: SPEC-SECURITY-002
**Status**: Planned
**Priority**: CRITICAL

---

## Overview

이 문서는 비밀번호 보안 강화 기능의 수용 기준을 정의합니다. 모든 기능은 Given-When-Then 형식으로 명시되어 있습니다.

---

## Acceptance Criteria

### AC1: PBKDF2 Password Hashing

**Story**: As a security engineer, I want all passwords to be hashed using PBKDF2-SHA256 so that passwords are secure against rainbow table and brute force attacks.

#### Scenario 1.1: Hash new password with PBKDF2

**Given** 새로운 관리자 계정이 생성될 때
**And** 비밀번호가 'Test@1234!'로 설정되면
**When** 계정 생성이 완료되면
**Then** 데이터베이스에 저장된 해시는 'pbkdf2_sha256$100000$' 접두사로 시작해야 한다
**And** 해시는 32바이트 솔트를 포함해야 한다
**And** 솔트는 각 비밀번호마다 고유해야 한다
**And** 동일 비밀번호로 다시 해싱하면 다른 해시가 생성되어야 한다

#### Scenario 1.2: Verify password with PBKDF2

**Given** PBKDF2 형식의 비밀번호 해시가 저장되어 있을 때
**And** 비밀번호가 'Test@1234!'로 설정되어 있으면
**When** 사용자가 올바른 비밀번호로 로그인을 시도하면
**Then** 시스템은 로그인을 허용해야 한다
**And** 검증 시간은 100ms 미만이어야 한다

#### Scenario 1.3: Reject incorrect password

**Given** PBKDF2 형식의 비밀번호 해시가 저장되어 있을 때
**And** 비밀번호가 'Test@1234!'로 설정되어 있으면
**When** 사용자가 'Wrong@1234!'로 로그인을 시도하면
**Then** 시스템은 로그인을 거부해야 한다
**And** HTTP 401 Unauthorized 상태 코드를 반환해야 한다
**And** 'Invalid credentials' 메시지를 표시해야 한다

#### Scenario 1.4: Hash format specification

**Given** PBKDF2 해시가 생성될 때
**When** 해시 형식을 확인하면
**Then** 형식은 'pbkdf2_sha256$iterations$salt$hash'이어야 한다
**And** iterations는 100000이어야 한다
**And** salt는 64자 hex string(32 bytes)이어야 한다
**And** hash는 64자 hex string(32 bytes)이어야 한다

---

### AC2: Legacy Password Migration

**Story**: As a system administrator, I want existing SHA-256 passwords to be automatically migrated to PBKDF2 so that all passwords are secure without requiring users to reset their passwords.

#### Scenario 2.1: Verify legacy SHA-256 password

**Given** legacy SHA-256 형식의 비밀번호 해시가 저장되어 있을 때
**And** `password_hash_format`이 'sha256_legacy'로 설정되어 있으면
**And** 비밀번호가 'OldPass123!'로 설정되어 있으면
**When** 사용자가 올바른 비밀번호로 로그인을 시도하면
**Then** 시스템은 SHA-256 legacy 검증을 허용해야 한다
**And** 로그인이 성공해야 한다

#### Scenario 2.2: Auto-migrate to PBKDF2 on successful login

**Given** legacy SHA-256 형식의 비밀번호 해시가 저장되어 있을 때
**And** 비밀번호가 'OldPass123!'로 설정되어 있으면
**When** 사용자가 올바른 비밀번호로 로그인에 성공하면
**Then** 시스템은 즉시 비밀번호를 PBKDF2로 재해싱해야 한다
**And** 데이터베이스 해시를 PBKDF2 형식으로 업데이트해야 한다
**And** `password_hash_format`을 'pbkdf2_sha256'으로 업데이트해야 한다
**And** 다음 로그인부터는 PBKDF2만 사용해야 한다

#### Scenario 2.3: Reject incorrect legacy password

**Given** legacy SHA-256 형식의 비밀번호 해시가 저장되어 있을 때
**And** 비밀번호가 'OldPass123!'로 설정되어 있으면
**When** 사용자가 'WrongPass123!'로 로그인을 시도하면
**Then** 시스템은 로그인을 거부해야 한다
**And** HTTP 401 Unauthorized 상태 코드를 반환해야 한다
**And** 비밀번호 재해싱은 발생하지 않아야 한다

#### Scenario 2.4: Migration progress tracking

**Given** 시스템에 legacy SHA-256 비밀번호가 100개 존재할 때
**When** 50명의 사용자가 로그인하면
**Then** 50개의 비밀번호가 PBKDF2로 마이그레이션되어야 한다
**And** 50개의 비밀번호가 여전히 legacy 형식이어야 한다
**And** 마이그레이션 진행률을 조회할 수 있어야 한다

---

### AC3: Rate Limiting

**Story**: As a security engineer, I want rate limiting on login attempts so that brute force attacks are mitigated.

#### Scenario 3.1: Allow requests under threshold

**Given** IP 주소가 1분 내 9회 로그인을 시도했을 때
**When** 10번째 로그인 시도가 발생하면
**Then** 시스템은 요청을 허용해야 한다
**And** 정상적인 로그인 절차를 진행해야 한다

#### Scenario 3.2: Block requests over threshold

**Given** IP 주소가 1분 내 10회 로그인을 시도했을 때
**When** 11번째 로그인 시도가 발생하면
**Then** 시스템은 요청을 차단해야 한다
**And** HTTP 429 Too Many Requests 상태 코드를 반환해야 한다
**And** 'Too many attempts. Please try again later.' 메시지를 표시해야 한다
**And** Retry-After 헤더에 60(초)를 포함해야 한다

#### Scenario 3.3: Reset rate limit after window expires

**Given** IP 주소가 1분 내 10회 로그인을 시도하여 차단되었을 때
**And** 60초가 경과했으면
**When** 새로운 로그인 시도가 발생하면
**Then** 시스템은 요청을 허용해야 한다
**And** 카운터가 리셋되어야 한다
**And** 다시 10회 시도 가능해야 한다

#### Scenario 3.4: Rate limit check performance

**Given** 속도 제한 확인이 실행될 때
**When** 데이터베이스 쿼리가 수행되면
**Then** 확인 시간은 10ms 미만이어야 한다
**And** 인덱스가 적절하게 사용되어야 한다 (idx_rate_limit_events_ip_time)

#### Scenario 3.5: Record all login attempts

**Given** 로그인 시도가 발생할 때
**When** 시도가 완료되면
**Then** `rate_limit_events` 테이블에 기록되어야 한다
**And** IP 주소, 타임스탬프, 사용자 ID, 성공 여부가 포함되어야 한다
**And** 기록은 비동기적으로 처리되어 로그인 성능에 영향을 주지 않아야 한다

---

### AC4: Account Lockout

**Story**: As a security engineer, I want accounts to be locked after consecutive failed login attempts so that credential stuffing attacks are mitigated.

#### Scenario 4.1: Track failed login attempts

**Given** 사용자 계정이 존재할 때
**When** 로그인이 1회 실패하면
**Then** `failed_login_attempts` 카운터가 1로 설정되어야 한다
**And** 2회째 실패하면 카운터가 2로 증가해야 한다
**And** 3회째 실패하면 카운터가 3으로 증가해야 한다

#### Scenario 4.2: Lock account after 5 failures

**Given** 사용자 계정으로 4회 연속 로그인이 실패했을 때
**And** `failed_login_attempts`가 4일 때
**When** 5번째 로그인 시도가 실패하면
**Then** 계정이 잠겨야 한다
**And** `locked_until`이 현재 시간 + 15분으로 설정되어야 한다
**And** HTTP 403 Forbidden 상태 코드를 반환해야 한다
**And** 'Account locked. Please try again later or contact support.' 메시지를 표시해야 한다

#### Scenario 4.3: Reject login while locked

**Given** 계정이 잠겨 있을 때
**And** `locked_until`이 미래 시간으로 설정되어 있으면
**When** 사용자가 올바른 비밀번호로 로그인을 시도해도
**Then** 시스템은 로그인을 거부해야 한다
**And** HTTP 403 Forbidden 상태 코드를 반환해야 한다
**And** 'Account locked until {datetime}' 메시지를 표시해야 한다
**And** `failed_login_attempts`는 증가하지 않아야 한다

#### Scenario 4.4: Reset failed attempts on success

**Given** 사용자 계정으로 3회 로그인이 실패했을 때
**And** `failed_login_attempts`가 3일 때
**When** 4번째 시도에 올바른 비밀번호로 로그인이 성공하면
**Then** `failed_login_attempts`가 0으로 리셋되어야 한다
**And** `locked_until`이 null로 설정되어야 한다
**And** `last_login_at`이 현재 시간으로 업데이트되어야 한다

#### Scenario 4.5: Auto-unlock after lock period expires

**Given** 계정이 15분간 잠겨 있을 때
**And** `locked_until`이 15분 전으로 설정되어 있으면
**When** 사용자가 올바른 비밀번호로 로그인을 시도하면
**Then** 시스템은 로그인을 허용해야 한다
**And** 계정 잠금이 자동 해제되어야 한다
**And** `locked_until`이 null로 설정되어야 한다

#### Scenario 4.6: Manual unlock by admin

**Given** 관리자 권한을 가진 사용자가 있을 때
**And** 특정 계정이 잠겨 있을 때
**When** 관리자가 해당 계정의 잠금 해제 API를 호출하면
**Then** 계정 잠금이 즉시 해제되어야 한다
**And** `failed_login_attempts`가 0으로 리셋되어야 한다
**And** `locked_until`이 null로 설정되어야 한다
**And** 해당 계정으로 즉시 로그인이 가능해야 한다

#### Scenario 4.7: List all locked accounts

**Given** 시스템에 10개의 계정이 잠겨 있을 때
**When** 관리자가 잠긴 계정 목록을 조회하면
**Then** 모든 잠긴 계정의 목록을 반환해야 한다
**And** 각 계정의 ID, 이메일, 잠금 시간, 남은 잠금 시간을 포함해야 한다
**And** 결과는 잠금 시간 기준 내림차순으로 정렬되어야 한다

---

### AC5: Performance Benchmarks

**Story**: As a system administrator, I want password verification to complete within 100ms so that user experience is not degraded.

#### Scenario 5.1: PBKDF2 verification performance

**Given** PBKDF2-SHA256(100,000 iterations) 해시가 설정되어 있을 때
**When** 비밀번호 검증이 수행되면
**Then** 검증 시간은 100ms 미만이어야 한다
**And** P50 평균은 50ms 미만이어야 한다
**And** P95 백분위수는 90ms 미만이어야 한다
**And** P99 백분위수는 100ms 미만이어야 한다

#### Scenario 5.2: Rate limit check performance

**Given** 속도 제한 확인이 수행될 때
**When** IP 기반 속도 제한을 확인하면
**Then** 확인 시간은 10ms 미만이어야 한다
**And** 데이터베이스 인덱스가 사용되어야 한다
**And** 전체 테이블 스캔이 발생하지 않아야 한다

#### Scenario 5.3: Account lockout check performance

**Given** 계정 잠금 확인이 수행될 때
**When** 계정 잠금 상태를 확인하면
**Then** 확인 시간은 10ms 미만이어야 한다
**And** 단일 쿼리로 완료되어야 한다

#### Scenario 5.4: Memory usage

**Given** PBKDF2 해싱이 수행될 때
**When** 해싱 프로세스가 실행되면
**Then** 메모리 사용량은 10MB 미만이어야 한다
**And** 메모리 누수가 발생하지 않아야 한다

---

### AC6: Security Requirements

**Story**: As a security engineer, I want the password system to comply with OWASP guidelines so that industry security standards are met.

#### Scenario 6.1: No plaintext password storage

**Given** 비밀번호가 생성되거나 변경될 때
**When** 데이터베이스에 저장되면
**Then** 평문 비밀번호가 저장되어서는 안 된다
**And** 해시된 값만 저장되어야 한다
**And** 로그 파일에 비밀번호가 노출되어서는 안 된다

#### Scenario 6.2: Unique salt per password

**Given** 두 개의 계정이 동일 비밀번호 'Test@1234!'를 사용할 때
**When** 두 비밀번호가 해싱되면
**Then** 서로 다른 솔트가 생성되어야 한다
**And** 서로 다른 해시 값이 생성되어야 한다
**And** 솔트는 32바이트(256 bits) 엔트로피를 가져야 한다

#### Scenario 6.3: Timing attack resistance

**Given** 올바른 비밀번호와 잘못된 비밀번호가 있을 때
**When** 각각 검증 시간을 측정하면
**Then** 시간 차이는 10ms 미만이어야 한다
**And** constant-time 비교가 사용되어야 한다
**And** 공격자가 타이밍 정보로 비밀번호를 추측할 수 없어야 한다

#### Scenario 6.4: Information leakage prevention

**Given** 로그인이 실패할 때
**When** 에러 응답이 생성되면
**Then** 구체적인 에러 메시지를 노출하지 않아야 한다
**And** 'User does not exist'와 'Invalid password'를 구분하지 않아야 한다
**And** 모든 실패에 'Invalid credentials'를 반환해야 한다

#### Scenario 6.5: OWASP compliance

**Given** OWASP Password Storage Cheat Sheet를 검토할 때
**When** 구현을 확인하면
**Then** PBKDF2가 사용되어야 한다
**And** 반복 횟수는 100,000 이상이어야 한다
**And** 솔트가 사용되어야 한다
**And** 솔트는 암호학적으로 안전한 난수 생성기로 생성되어야 한다

---

### AC7: Audit Logging

**Story**: As a security auditor, I want all security-related events to be logged so that security incidents can be investigated.

#### Scenario 7.1: Log successful login

**Given** 사용자가 성공적으로 로그인할 때
**When** 로그인이 완료되면
**Then** 이벤트가 감사 로그에 기록되어야 한다
**And** 로그에는 사용자 ID, IP 주소, 타임스탬프가 포함되어야 한다
**And** 이벤트 유형은 'login_success'이어야 한다

#### Scenario 7.2: Log failed login

**Given** 사용자 로그인이 실패할 때
**When** 실패가 발생하면
**Then** 이벤트가 감사 로그에 기록되어야 한다
**And** 로그에는 IP 주소, 타임스탬프, 실패 사유가 포함되어야 한다
**And** 이벤트 유형은 'login_failure'이어야 한다
**And** 사용자 ID는 보안상 포함하지 않아야 한다

#### Scenario 7.3: Log account lockout

**Given** 계정이 잠길 때
**When** 잠금이 발생하면
**Then** 이벤트가 감사 로그에 기록되어야 한다
**And** 로그에는 사용자 ID, IP 주소, 타임스탬프가 포함되어야 한다
**And** 이벤트 유형은 'account_locked'이어야 한다
**And** 실패 횟수가 포함되어야 한다

#### Scenario 7.4: Log rate limit exceeded

**Given** IP 속도 제한을 초과할 때
**When** 초과가 발생하면
**Then** 이벤트가 감사 로그에 기록되어야 한다
**And** 로그에는 IP 주소, 타임스탬프, 시도 횟수가 포함되어야 한다
**And** 이벤트 유형은 'rate_limit_exceeded'이어야 한다

#### Scenario 7.5: Log password migration

**Given** legacy 비밀번호가 PBKDF2로 마이그레이션될 때
**When** 마이그레이션이 완료되면
**Then** 이벤트가 감사 로그에 기록되어야 한다
**And** 로그에는 사용자 ID, 타임스탬프, 마이그레이션 전 형식이 포함되어야 한다
**And** 이벤트 유형은 'password_migrated'이어야 한다

---

## Quality Gates

### Functional Testing

- [ ] 모든 Given-When-Then 시나리오 통과
- [ ] PBKDF2 해싱이 정상 작동
- [ ] Legacy SHA-256 마이그레이션이 정상 작동
- [ ] 속도 제한이 정상 작동
- [ ] 계정 잠금이 정상 작동

### Performance Testing

- [ ] PBKDF2 검증 < 100ms (P99)
- [ ] 속도 제한 확인 < 10ms
- [ ] 계정 잠금 확인 < 10ms
- [ ] 메모리 사용량 < 10MB

### Security Testing

- [ ] OWASP Password Storage 기준 준수
- [ ] 평문 비밀번호 미저장 확인
- [ ] 솔트 고유성 확인
- [ ] Timing Attack 저항성 확인
- [ ] Information Leakage 방지 확인

### Code Quality

- [ ] 테스트 커버리지 85% 이상
- [ ] ESLint warnings 0
- [ ] TypeScript errors 0
- [ ] Cyclomatic complexity < 10

### Integration Testing

- [ ] 로그인 플로우 테스트 통과
- [ ] 마이그레이션 테스트 통과
- [ ] 동시 로그인 테스트 통과
- [ ] 에러 복구 테스트 통과

---

## Definition of Done

모든 기능은 다음 기준을 충족해야 완료로 간주됩니다:

1. **구현 완료**: 모든 Acceptance Criteria가 충족됨
2. **테스트 통과**: 단위 테스트, 통합 테스트, 보안 테스트 통과
3. **성능 기준**: 모든 Performance Benchmarks 충족
4. **보안 기준**: OWASP 기준 준수 확인
5. **코드 품질**: 테스트 커버리지 85%+, Lint warnings 0
6. **문서화**: API 문서, 보안 가이드 작성 완료
7. **코드 리뷰**: Security 팀 리뷰 승인

---

## Verification Methods

### Automated Testing

```bash
# Unit Tests
bun test src/lib/__tests__/password-hasher.test.ts
bun test src/lib/__tests__/rate-limiter.test.ts
bun test src/lib/__tests__/account-lockout.test.ts

# Integration Tests
bun test src/pages/api/__tests__/auth.test.ts

# Security Tests
bun test src/__tests__/security/password-security.test.ts
bun test src/__tests__/security/timing-attack.test.ts
```

### Performance Testing

```bash
# Benchmark PBKDF2 verification
bun run benchmark:password-hasher

# Benchmark rate limiting
bun run benchmark:rate-limiter

# Benchmark account lockout
bun run benchmark:account-lockout
```

### Security Scanning

```bash
# OWASP ZAP (if available)
zap-cli quick-scan --self-contained http://localhost:4321

# Custom security audit
bun run audit:password-security
```

### Manual Testing

1. 새 계정 생성 및 PBKDF2 해시 확인
2. Legacy 계정 로그인 및 자동 마이그레이션 확인
3. 10회 로그인 실패 후 속도 제한 확인
4. 5회 실패 후 계정 잠금 확인
5. 관리자 계정 잠금 해제 확인

---

**Version**: 1.0.0
**Last Updated**: 2026-01-26
**Status**: Ready for Implementation
