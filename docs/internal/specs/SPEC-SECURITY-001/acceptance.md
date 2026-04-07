# SPEC-SECURITY-001: 수용 기준

## 추적성 태그
`[SPEC-SECURITY-001]` - EMR 데이터 보안 아키텍처 전환

---

## 1. 기능별 수용 기준 (Given-When-Then)

### AC-01: 환자 접수 - Tunnel UP 상태

```gherkin
Feature: Tunnel 연결 시 환자 접수 데이터 직접 전송

  Background:
    Given Cloudflare Tunnel이 연결되어 있다
    And 내부 EMR 서버가 정상 동작 중이다

  Scenario: 환자가 접수 폼을 제출하면 내부 서버에 직접 저장
    Given 환자가 접수 폼을 작성했다
    When 접수 폼을 제출한다
    Then 시스템은 Tunnel 상태를 확인한다
    And 데이터가 내부 EMR 서버로 직접 전송된다
    And 내부 DB에 환자 정보가 평문으로 저장된다
    And 접수 성공 메시지가 표시된다
    And D1 버퍼에는 데이터가 저장되지 않는다

  Scenario: Tunnel 전송 실패 시 버퍼로 폴백
    Given 환자가 접수 폼을 작성했다
    And Tunnel 상태 확인은 성공했지만 전송 중 오류 발생
    When 접수 폼을 제출한다
    Then 데이터가 암호화되어 D1 버퍼에 저장된다
    And 접수 성공 메시지가 표시된다 (사용자는 내부 처리 모름)
```

### AC-02: 환자 접수 - Tunnel DOWN 상태

```gherkin
Feature: Tunnel 미연결 시 암호화 버퍼 저장

  Background:
    Given Cloudflare Tunnel이 연결되어 있지 않다

  Scenario: 환자가 접수 폼을 제출하면 암호화 버퍼에 저장
    Given 환자가 접수 폼을 작성했다
    When 접수 폼을 제출한다
    Then 시스템은 Tunnel 상태를 확인한다
    And Tunnel이 DOWN 상태임을 감지한다
    And 데이터가 Envelope Encryption으로 암호화된다
    And 암호화된 데이터가 D1 encrypted_buffer 테이블에 저장된다
    And submission_id가 생성되어 저장된다
    And expires_at이 48시간 후로 설정된다
    And 접수 성공 메시지가 표시된다

  Scenario: 암호화 데이터 구조 검증
    Given 환자 접수 데이터가 암호화되어 저장되었다
    When 저장된 데이터를 조회한다
    Then encrypted_data 필드는 Base64 인코딩된 암호문이다
    And encrypted_key 필드는 RSA로 암호화된 대칭키이다
    And iv 필드는 12바이트 IV이다
    And 평문 환자 정보가 포함되어 있지 않다
```

### AC-03: 동기화 에이전트 동작

```gherkin
Feature: Sync Agent 버퍼 데이터 동기화

  Background:
    Given 내부 EMR 서버가 정상 동작 중이다
    And Sync Agent가 실행 중이다
    And 개인키가 내부 서버에 저장되어 있다

  Scenario: 내부 서버 복구 후 버퍼 데이터 동기화
    Given D1 버퍼에 pending 상태의 암호화 데이터 3건이 있다
    When Sync Agent가 폴링을 수행한다
    Then D1 API를 통해 pending 데이터를 조회한다
    And 각 데이터의 encrypted_key를 개인키로 복호화한다
    And 복호화된 대칭키로 encrypted_data를 복호화한다
    And 복호화된 환자 데이터를 내부 DB에 저장한다
    And 버퍼 상태가 'synced'로 업데이트된다
    And 동기화 로그가 기록된다

  Scenario: 동기화 실패 시 재시도
    Given D1 버퍼에 pending 상태의 암호화 데이터가 있다
    And 복호화 중 오류가 발생한다
    When Sync Agent가 처리를 시도한다
    Then sync_attempts가 1 증가한다
    And last_sync_attempt가 현재 시간으로 업데이트된다
    And error_message에 오류 내용이 저장된다
    And 상태는 'pending'으로 유지된다

  Scenario: 5회 이상 실패 시 failed 처리
    Given 버퍼 데이터의 sync_attempts가 4이다
    When Sync Agent가 처리를 시도하고 실패한다
    Then sync_attempts가 5가 된다
    And 다음 정리 작업에서 상태가 'failed'로 변경된다
```

### AC-04: TTL 기반 버퍼 정리

```gherkin
Feature: 48시간 TTL 정책

  Background:
    Given 버퍼 정리 Worker가 설정되어 있다
    And 매 시간 정각에 실행된다

  Scenario: 만료된 데이터 자동 삭제
    Given D1 버퍼에 expires_at이 현재 시간 이전인 데이터가 있다
    When 버퍼 정리 Worker가 실행된다
    Then 해당 데이터가 삭제된다
    And 삭제된 건수가 로그에 기록된다

  Scenario: 동기화 완료 데이터 삭제
    Given D1 버퍼에 status가 'synced'인 데이터가 있다
    When 버퍼 정리 Worker가 실행된다
    Then 해당 데이터가 삭제된다

  Scenario: pending 데이터 유지
    Given D1 버퍼에 expires_at이 미래이고 status가 'pending'인 데이터가 있다
    When 버퍼 정리 Worker가 실행된다
    Then 해당 데이터는 삭제되지 않는다
```

### AC-05: 관리자 접근 제어

```gherkin
Feature: 관리자 페이지 LAN 접근 제한

  Scenario: 내부 LAN에서 관리자 페이지 접근
    Given 사용자가 192.168.1.100 IP에서 접속 중이다
    And 유효한 관리자 세션이 있다
    When "/admin/dashboard"에 접근한다
    Then 정상적으로 관리자 대시보드가 표시된다

  Scenario: 외부 네트워크에서 관리자 페이지 접근 차단
    Given 사용자가 203.0.113.50 (외부 IP)에서 접속 중이다
    And 유효한 관리자 세션이 있다
    When "/admin/dashboard"에 접근한다
    Then 403 Forbidden이 반환된다
    And "Access denied. Internal network only." 메시지가 표시된다

  Scenario: 허용된 사설 네트워크 범위
    Given 다음 IP 범위가 허용된다:
      | CIDR           | 설명     |
      | 192.168.0.0/16 | 사설망 A |
      | 10.0.0.0/8     | 사설망 B |
      | 172.16.0.0/12  | 사설망 C |
      | 127.0.0.1/8    | 로컬    |
    When 해당 범위 내 IP에서 접근한다
    Then 접근이 허용된다
```

### AC-06: 감사 로그

```gherkin
Feature: 환자 데이터 접근 감사 로그

  Background:
    Given 관리자가 로그인되어 있다
    And 감사 로그 시스템이 활성화되어 있다

  Scenario: 환자 정보 조회 시 로그 기록
    Given 관리자가 환자 목록 페이지에 있다
    When 특정 환자 상세 정보를 조회한다
    Then 감사 로그가 생성된다
    And 로그에 다음 정보가 포함된다:
      | 필드          | 값            |
      | user_id       | 관리자 ID     |
      | action        | view          |
      | resource_type | patient       |
      | resource_id   | 환자 ID       |
      | ip_address    | 접속 IP       |
      | user_agent    | 브라우저 정보  |
      | created_at    | 현재 시간     |

  Scenario: 환자 정보 수정 시 로그 기록
    Given 관리자가 환자 상세 페이지에 있다
    When 환자 전화번호를 수정하고 저장한다
    Then 감사 로그가 생성된다
    And action이 'update'이다
    And details에 변경 내용이 JSON으로 기록된다

  Scenario: 감사 로그 조회
    Given 감사 로그가 100건 이상 기록되어 있다
    When super_admin이 감사 로그 페이지에 접근한다
    Then 최근 50건의 로그가 표시된다
    And 필터링 옵션이 제공된다 (사용자, 기간, 액션 유형)
    And CSV 내보내기 버튼이 있다
```

### AC-07: 멱등성 보장

```gherkin
Feature: submission_id 기반 멱등성

  Scenario: 동일 submission_id 중복 제출 방지
    Given 환자가 접수 폼을 제출했다
    And submission_id가 "abc123"이다
    When 네트워크 지연으로 동일 submission_id로 재제출된다
    Then 첫 번째 제출만 처리된다
    And 두 번째 제출은 무시된다 (UNIQUE 제약)
    And 사용자에게 오류가 표시되지 않는다

  Scenario: Sync Agent 중복 처리 방지
    Given 버퍼에 submission_id "abc123"이 있다
    And 동기화가 진행 중이다
    When 동시에 두 개의 Sync Agent 인스턴스가 같은 데이터를 처리하려 한다
    Then 하나만 성공하고 나머지는 무시된다
    And 데이터 무결성이 유지된다
```

### AC-08: Envelope Encryption 검증

```gherkin
Feature: Envelope Encryption 정확성

  Scenario: 암호화 → 복호화 왕복 테스트
    Given 원본 환자 데이터가 있다:
      | 필드  | 값           |
      | name  | 홍길동       |
      | rrn   | 900101-1234567 |
      | phone | 010-1234-5678 |
    When 공개키로 암호화한다
    And 개인키로 복호화한다
    Then 복호화된 데이터가 원본과 일치한다

  Scenario: 잘못된 개인키로 복호화 시도
    Given 암호화된 데이터가 있다
    When 다른 키 쌍의 개인키로 복호화를 시도한다
    Then 복호화가 실패한다
    And 오류 메시지가 기록된다

  Scenario: 암호화 데이터 무결성 검증
    Given 암호화된 데이터가 있다
    When encrypted_data의 일부 바이트를 변경한다
    And 복호화를 시도한다
    Then GCM 인증 태그 검증에 실패한다
    And 데이터 변조가 감지된다
```

---

## 2. 비기능 수용 기준

### NFR-01: 성능

| 메트릭 | 기준 | 측정 방법 |
|--------|------|----------|
| 접수 폼 제출 (Tunnel UP) | < 300ms P95 | 클라이언트 타이밍 |
| 접수 폼 제출 (Buffer) | < 500ms P95 | 클라이언트 타이밍 |
| 암호화 처리 시간 | < 50ms | 서버 로그 |
| 복호화 처리 시간 | < 100ms | Sync Agent 로그 |
| Sync Agent 처리량 | > 100건/분 | 동기화 통계 |
| Tunnel 상태 확인 | < 3초 (타임아웃) | 헬스체크 응답 |

### NFR-02: 보안

| 항목 | 기준 | 검증 방법 |
|------|------|----------|
| 암호화 알고리즘 | AES-256-GCM | 코드 리뷰 |
| 키 암호화 | RSA-OAEP (2048-bit+) | 키 생성 검증 |
| 클라우드 평문 데이터 | 0건 | DB 스캔 |
| 개인키 위치 | 내부 서버 파일시스템만 | 배포 검증 |
| 감사 로그 커버리지 | 100% (모든 데이터 접근) | 로그 분석 |
| LAN 접근 제한 | 사설망만 허용 | 네트워크 테스트 |

### NFR-03: 가용성

| 시나리오 | 기대 동작 | RTO |
|----------|----------|-----|
| Tunnel 장애 | 버퍼로 자동 전환 | 0초 (즉시) |
| 내부 서버 장애 | 버퍼 저장 지속 | 48시간 내 복구 |
| Sync Agent 장애 | 버퍼 데이터 유지 | 재시작 즉시 처리 |
| D1 장애 | 오류 반환 + 재시도 안내 | N/A |

### NFR-04: 데이터 무결성

| 검증 항목 | 기준 | 방법 |
|----------|------|------|
| 암호화 왕복 무결성 | 100% | 자동화 테스트 |
| 동기화 정확성 | 100% | 비교 검증 |
| 중복 방지 | submission_id UNIQUE | DB 제약 |

---

## 3. 테스트 시나리오 매트릭스

| 테스트 케이스 | 유형 | 우선순위 | 자동화 |
|--------------|------|----------|--------|
| Tunnel UP 직접 저장 | 통합 | High | Yes |
| Tunnel DOWN 버퍼 저장 | 통합 | High | Yes |
| Envelope Encryption | 단위 | High | Yes |
| Sync Agent 동기화 | 통합 | High | Yes |
| TTL 데이터 정리 | 통합 | High | Yes |
| LAN 접근 제한 | 통합 | High | Yes |
| 감사 로그 생성 | 통합 | High | Yes |
| 멱등성 검증 | 단위/통합 | High | Yes |
| 평문 데이터 부재 검증 | 보안 | Critical | Yes |
| 키 위치 검증 | 보안 | Critical | Yes |
| 성능 벤치마크 | 성능 | Medium | Yes |
| E2E 접수 흐름 | E2E | High | Yes |

---

## 4. Definition of Done (완료 정의)

### 기능 완료 조건

- [ ] 모든 Given-When-Then 시나리오 통과
- [ ] 단위 테스트 커버리지 90% 이상
- [ ] 통합 테스트 통과
- [ ] E2E 테스트 통과
- [ ] 보안 코드 리뷰 완료

### 보안 완료 조건

- [ ] D1에 평문 환자 데이터 0건 확인
- [ ] 개인키 클라우드 미존재 확인
- [ ] 감사 로그 100% 커버리지 확인
- [ ] LAN 접근 제한 동작 확인
- [ ] OWASP Top 10 취약점 스캔 통과

### 문서 완료 조건

- [ ] 키 관리 가이드 작성
- [ ] 운영 매뉴얼 작성
- [ ] 마이그레이션 가이드 작성
- [ ] API 문서 업데이트
- [ ] CHANGELOG 업데이트

### 배포 완료 조건

- [ ] 데이터 마이그레이션 완료
- [ ] 프로덕션 배포 완료
- [ ] 모니터링 대시보드 설정
- [ ] 알림 시스템 설정
- [ ] 롤백 계획 준비

---

## 5. 품질 게이트

### TRUST 5 체크리스트

| 원칙 | 검증 항목 | 상태 |
|------|----------|------|
| **T**ested | 단위/통합/E2E/보안 테스트 완료 | 대기 |
| **R**eadable | 코드 리뷰 완료, 주석 충분 | 대기 |
| **U**nified | 기존 아키텍처 패턴 준수 | 대기 |
| **S**ecured | 보안 검토 완료, 취약점 스캔 통과 | 대기 |
| **T**rackable | 감사 로그 및 모니터링 설정 | 대기 |

### 보안 체크리스트

- [ ] 암호화 알고리즘 검증 (AES-256-GCM, RSA-OAEP)
- [ ] 키 관리 정책 수립
- [ ] 키 순환 계획 수립
- [ ] 접근 제어 테스트
- [ ] 침투 테스트 (선택)
- [ ] 감사 로그 검증
- [ ] 데이터 마이그레이션 무결성 검증

---

## 6. 추적성 태그

```
[SPEC-SECURITY-001] → spec.md (요구사항)
[SPEC-SECURITY-001] → plan.md (구현 계획)
[SPEC-SECURITY-001] → tests/crypto.test.ts (암호화 단위 테스트)
[SPEC-SECURITY-001] → tests/sync-agent.test.ts (동기화 테스트)
[SPEC-SECURITY-001] → tests/access-control.test.ts (접근 제어 테스트)
[SPEC-SECURITY-001] → tests/e2e/intake-flow.spec.ts (E2E 테스트)
[SPEC-SECURITY-001] → tests/security/plaintext-scan.ts (평문 스캔)
```

---

## 7. 마이그레이션 수용 기준

### 데이터 마이그레이션 검증

```gherkin
Feature: 기존 데이터 마이그레이션

  Scenario: D1 환자 데이터 내부 서버 이전
    Given D1에 환자 데이터 N건이 있다
    When 마이그레이션 스크립트를 실행한다
    Then 내부 서버 DB에 N건이 저장된다
    And 데이터 무결성이 100% 유지된다
    And D1에서 평문 데이터가 삭제된다

  Scenario: 마이그레이션 롤백
    Given 마이그레이션 중 오류가 발생한다
    When 롤백을 수행한다
    Then D1 데이터가 복원된다
    And 내부 서버의 부분 데이터가 정리된다
```

### 마이그레이션 체크리스트

- [ ] 전체 백업 완료
- [ ] 테스트 환경 마이그레이션 성공
- [ ] 데이터 무결성 검증
- [ ] 프로덕션 마이그레이션 계획 수립
- [ ] 롤백 계획 테스트
- [ ] 서비스 중단 시간 계획 (필요시)
