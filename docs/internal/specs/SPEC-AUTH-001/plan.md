---
spec_id: SPEC-AUTH-001
version: "1.0.0"
created: "2026-01-29"
updated: "2026-01-29"
---

# SPEC-AUTH-001 구현 계획: JWT 인증 시스템 재설계

## 1. 마일스톤 개요

### Milestone 1: JWT 토큰 인프라 구축 (Priority: High)

JWT 토큰 생성, 서명, 검증을 위한 핵심 인프라를 구축합니다.

### Milestone 2: 세션 관리 및 블랙리스트 (Priority: High)

로그아웃 및 토큰 무효화를 위한 블랙리스트 시스템을 구현합니다.

### Milestone 3: 레거시 마이그레이션 (Priority: Medium)

기존 admin.id 기반 인증에서 JWT로 전환하는 마이그레이션을 수행합니다.

---

## 2. 상세 구현 계획

### Milestone 1: JWT 토큰 인프라 구축

**M1-T1: JWT 유틸리티 모듈 구현**

- 파일: `core/auth/jwt.ts`
- 내용:
  - RS256 키 쌍 로딩 (환경 변수에서)
  - `signAccessToken(payload)`: Access Token 생성 (15분 만료)
  - `signRefreshToken(payload)`: Refresh Token 생성 (7일 만료)
  - `verifyToken(token)`: 토큰 검증 및 payload 추출
- 의존성: `jose` 라이브러리
- 관련 요구사항: REQ-AUTH-001, REQ-AUTH-002, REQ-AUTH-003, REQ-AUTH-009

**M1-T2: 로그인 API 구현**

- 파일: `routes/auth/login.ts`
- 내용:
  - 기존 자격 증명 검증 로직 유지
  - 검증 성공 시 Access Token + Refresh Token 발급
  - Access Token은 응답 본문으로 반환
  - Refresh Token은 HttpOnly 쿠키로 설정
- 관련 요구사항: REQ-AUTH-004

**M1-T3: Token Refresh API 구현**

- 파일: `routes/auth/refresh.ts`
- 내용:
  - 쿠키에서 Refresh Token 추출
  - Refresh Token 유효성 검증
  - 새 Access Token 발급 및 반환
- 관련 요구사항: REQ-AUTH-005

### Milestone 2: 세션 관리 및 블랙리스트

**M2-T1: 로그아웃 API 구현**

- 파일: `routes/auth/logout.ts`
- 내용:
  - Refresh Token의 jti를 블랙리스트에 등록
  - 쿠키 삭제 (Max-Age=0)
  - 성공 응답 반환
- 관련 요구사항: REQ-AUTH-006

**M2-T2: 블랙리스트 검증 미들웨어**

- 파일: `core/auth/blacklist.ts`
- 내용:
  - `isBlacklisted(jti)`: 블랙리스트 조회
  - D1 쿼리 + 인메모리 캐시 (LRU, 1000개)
  - 만료된 블랙리스트 항목 자동 정리 (cron)
- 파일: `middleware/auth.ts` 수정
- 내용:
  - 토큰 검증 시 블랙리스트 확인 추가
- 관련 요구사항: REQ-AUTH-007

**M2-T3: 블랙리스트 테이블 생성**

- 파일: `migrations/0003_token_blacklist.sql`
- 내용:
  - token_blacklist 테이블 DDL
  - expires_at 인덱스
- 관련 요구사항: REQ-AUTH-007

### Milestone 3: 레거시 마이그레이션

**M3-T1: 인증 미들웨어 업그레이드**

- 파일: `middleware/auth.ts`
- 내용:
  - JWT 검증 우선 시도
  - JWT 실패 시 레거시 admin.id 검증 (마이그레이션 기간)
  - 레거시 사용 시 deprecation 경고 로깅
  - 마이그레이션 기간 후 레거시 코드 제거
- 관련 요구사항: REQ-AUTH-008

**M3-T2: 클라이언트 마이그레이션 가이드**

- 문서: `docs/auth-migration-guide.md`
- 내용:
  - 새 인증 플로우 설명
  - 코드 변경 예시
  - 타임라인 및 기한

---

## 3. 기술적 접근 방식

### 3.1 아키텍처 설계

```
[Client]
    │
    ├─ POST /auth/login ──────────────────┐
    │   (credentials)                     │
    │                                     ▼
    │                            ┌─────────────────┐
    │                            │   Auth Service  │
    │                            │  ┌───────────┐  │
    │                            │  │ JWT Utils │  │
    │                            │  └───────────┘  │
    │                            │  ┌───────────┐  │
    │                            │  │ Blacklist │  │
    │                            │  └───────────┘  │
    │                            └────────┬────────┘
    │                                     │
    │   Response: { accessToken }         │
    │   Cookie: refreshToken ◄────────────┘
    │
    ├─ GET /api/* ────────────────────────┐
    │   Authorization: Bearer <access>    │
    │                                     ▼
    │                            ┌─────────────────┐
    │                            │  Auth Middleware│
    │                            │  1. Verify JWT  │
    │                            │  2. Check Black │
    │                            │  3. Set Context │
    │                            └─────────────────┘
    │
    └─ POST /auth/refresh ────────────────┐
        Cookie: refreshToken              │
                                          ▼
                                 ┌─────────────────┐
                                 │ Refresh Handler │
                                 │ → New Access    │
                                 └─────────────────┘
```

### 3.2 키 관리 전략

1. **개발 환경**: `.dev.vars`에 테스트용 키 저장
2. **프로덕션**: Cloudflare Workers Secrets 사용
3. **키 로테이션**: 분기별 키 교체, 이전 키 30일간 검증 지원

### 3.3 보안 고려사항

| 위협 | 대응 방안 |
|------|----------|
| 토큰 탈취 | 짧은 Access Token 만료 (15분) |
| XSS 공격 | Refresh Token을 HttpOnly 쿠키로 |
| CSRF 공격 | SameSite=Strict 쿠키 속성 |
| 세션 하이재킹 | 블랙리스트 + IP 변경 감지 (선택) |

---

## 4. 리스크 및 대응 계획

### 4.1 기술적 리스크

**리스크 1: Cloudflare Workers Crypto API 제약**

- 설명: Workers 환경에서 RSA 키 처리 제한 가능
- 대응: `jose` 라이브러리 사용 (Workers 호환 검증 완료)
- 대안: ES256 알고리즘으로 변경 (더 작은 키 크기)

**리스크 2: 블랙리스트 조회 성능**

- 설명: 모든 요청에서 블랙리스트 조회 시 latency 증가
- 대응: LRU 캐시 적용, 캐시 적중률 모니터링
- 대안: KV Storage 활용 (더 빠른 읽기)

### 4.2 비즈니스 리스크

**리스크 3: 클라이언트 마이그레이션 지연**

- 설명: 기존 클라이언트가 마이그레이션 기한 내 업데이트 실패
- 대응: 마이그레이션 기간 연장 옵션, 강제 로그아웃 알림

---

## 5. 검증 계획

### 5.1 단위 테스트

- JWT 생성/검증 함수
- 블랙리스트 CRUD
- 토큰 만료 로직

### 5.2 통합 테스트

- 로그인 → 토큰 발급 → API 호출 플로우
- 토큰 갱신 플로우
- 로그아웃 → 토큰 무효화 플로우

### 5.3 보안 테스트

- 만료된 토큰 거부 확인
- 블랙리스트 토큰 거부 확인
- 서명 위조 토큰 거부 확인

---

## 6. Traceability Matrix

| Task ID | 관련 요구사항 | 검증 항목 |
|---------|--------------|----------|
| M1-T1 | REQ-AUTH-001, 002, 003, 009 | AC-AUTH-001, 002, 003, 009 |
| M1-T2 | REQ-AUTH-004 | AC-AUTH-004 |
| M1-T3 | REQ-AUTH-005 | AC-AUTH-005 |
| M2-T1 | REQ-AUTH-006 | AC-AUTH-006 |
| M2-T2 | REQ-AUTH-007 | AC-AUTH-007 |
| M2-T3 | REQ-AUTH-007 | AC-AUTH-007 |
| M3-T1 | REQ-AUTH-008 | AC-AUTH-008 |
