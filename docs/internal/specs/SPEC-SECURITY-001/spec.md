# SPEC-SECURITY-001: EMR 데이터 보안 아키텍처 전환

## 메타데이터

| 항목 | 값 |
|------|-----|
| **SPEC ID** | SPEC-SECURITY-001 |
| **제목** | EMR 데이터 보안 아키텍처 전환 (EMR Data Security Architecture Transformation) |
| **상태** | Planned |
| **우선순위** | High (Critical Security) |
| **생성일** | 2026-01-27 |
| **작성자** | workflow-spec agent |
| **라이프사이클** | spec-anchored |
| **관련 파일** | `hq/schema.sql`, `hq/src/index.js`, `src/middleware.ts` |

---

## 1. 배경 및 목적

### 1.1 문제 정의

현재 Clinic-OS 시스템은 다음과 같은 심각한 보안 위험을 가지고 있습니다:

| 위험 항목 | 현재 상태 | 위험도 |
|-----------|----------|--------|
| 주민등록번호(RRN) | Cloudflare D1에 평문 저장 | **Critical** |
| 전화번호 | Cloudflare D1에 평문 저장 | **High** |
| 주소 | Cloudflare D1에 평문 저장 | **High** |
| 진료 기록 | Cloudflare D1에 평문 저장 | **Critical** |
| 접근 제어 | IP 제한만 적용 | **Medium** |

### 1.2 핵심 모순

외부 환자 접수 링크가 필요하지만, 환자 데이터는 내부에 저장되어야 하고, 내부 서버는 외부에 노출될 수 없습니다.

```
[모순 다이어그램]
외부 접수 필요 ←→ 데이터 내부 저장 ←→ 내부 서버 비노출
```

### 1.3 해결 방안 (Option A - Hybrid Architecture)

| 구성 요소 | 위치 | 역할 |
|-----------|------|------|
| 공개 웹사이트 | Cloudflare Pages | 환자 접수 폼, 정보 페이지 |
| 환자 접수 데이터 | Tunnel UP → 내부 서버 직접 저장 | 실시간 전송 |
| 환자 접수 데이터 | Tunnel DOWN → D1 암호화 버퍼 | 임시 저장 (최대 48시간) |
| EMR 데이터 | 내부 서버 SQLite/PostgreSQL | 평문 저장 (내부망 한정) |
| 관리자 페이지 | 내부 LAN만 접근 가능 | `/admin/*` 경로 |

### 1.4 범위

**포함**:
- 클라우드 D1에서 평문 환자 데이터 즉시 제거
- 암호화 버퍼 큐 설계 및 구현
- 온프레미스 EMR API/DB 구축
- Sync Agent (내부 풀 방식) 구현
- 선택적 Cloudflare Tunnel 통합

**제외**:
- 기존 공개 웹페이지 (`/`, `/programs/*`, `/posts/*`)
- Cloudflare Pages 호스팅 구조 변경
- 외부 결제 시스템 통합

---

## 2. 요구사항 (EARS Format)

### 2.1 Ubiquitous Requirements (항상 적용)

시스템은 **항상** 모든 환자 개인정보(RRN, 전화번호, 주소, 진료기록)를 클라우드에 평문으로 저장하지 않아야 합니다.

| ID | 요구사항 |
|----|----------|
| REQ-U01 | 시스템은 **항상** 환자 접수 데이터를 암호화하여 저장해야 한다 (클라우드 환경) |
| REQ-U02 | 시스템은 **항상** Envelope Encryption 방식을 사용해야 한다 (대칭키로 데이터 암호화, 공개키로 대칭키 암호화) |
| REQ-U03 | 시스템은 **항상** submission_id를 통해 멱등성을 보장해야 한다 |
| REQ-U04 | 시스템은 **항상** 관리자 접근에 대한 감사 로그를 생성해야 한다 |
| REQ-U05 | 시스템은 **항상** 48시간이 지난 버퍼 데이터를 자동 삭제해야 한다 (TTL 정책) |

### 2.2 Event-Driven Requirements (이벤트 기반)

| ID | 요구사항 |
|----|----------|
| REQ-E01 | **WHEN** 환자가 접수 폼을 제출할 때, **THEN** 시스템은 Tunnel 상태를 확인해야 한다 |
| REQ-E02 | **WHEN** Tunnel이 UP 상태일 때, **THEN** 시스템은 데이터를 내부 서버로 직접 전송해야 한다 |
| REQ-E03 | **WHEN** Tunnel이 DOWN 상태일 때, **THEN** 시스템은 데이터를 암호화하여 D1 버퍼에 저장해야 한다 |
| REQ-E04 | **WHEN** 내부 서버가 복구될 때, **THEN** Sync Agent가 버퍼된 데이터를 풀하고 복호화해야 한다 |
| REQ-E05 | **WHEN** 관리자가 환자 데이터에 접근할 때, **THEN** 접근 로그가 생성되어야 한다 |
| REQ-E06 | **WHEN** 버퍼 데이터가 48시간 경과할 때, **THEN** 시스템은 해당 데이터를 자동 삭제해야 한다 |

### 2.3 State-Driven Requirements (상태 기반)

| ID | 요구사항 |
|----|----------|
| REQ-S01 | **IF** Cloudflare Tunnel이 연결된 상태이면, **THEN** 환자 접수 데이터는 내부 서버에 직접 저장되어야 한다 |
| REQ-S02 | **IF** Cloudflare Tunnel이 연결되지 않은 상태이면, **THEN** 환자 접수 데이터는 암호화 버퍼에 저장되어야 한다 |
| REQ-S03 | **IF** 사용자가 내부 LAN에 있는 상태이면, **THEN** 관리자 페이지 접근이 허용되어야 한다 |
| REQ-S04 | **IF** 사용자가 외부 네트워크에 있는 상태이면, **THEN** 관리자 페이지 접근이 차단되어야 한다 |
| REQ-S05 | **IF** 버퍼에 미처리 데이터가 있는 상태이면, **THEN** Sync Agent가 주기적으로 풀을 시도해야 한다 |

### 2.4 Optional Requirements (선택적)

| ID | 요구사항 |
|----|----------|
| REQ-O01 | **가능하면** PostgreSQL로 마이그레이션 경로를 제공한다 (초기 SQLite 사용) |
| REQ-O02 | **가능하면** MFA(다중 인증)를 관리자 로그인에 추가한다 |
| REQ-O03 | **가능하면** SSO(Single Sign-On) 통합을 지원한다 |
| REQ-O04 | **가능하면** RBAC(역할 기반 접근 제어)을 세분화한다 |
| REQ-O05 | **가능하면** 실시간 알림 시스템을 통해 보안 이벤트를 통지한다 |

### 2.5 Unwanted Behavior Requirements (금지 사항)

| ID | 요구사항 |
|----|----------|
| REQ-N01 | 시스템은 환자 개인정보를 클라우드에 평문으로 저장**하지 않아야 한다** |
| REQ-N02 | 시스템은 개인키를 클라우드 환경에 저장**하지 않아야 한다** |
| REQ-N03 | 시스템은 외부 네트워크에서 관리자 페이지 접근을 허용**하지 않아야 한다** |
| REQ-N04 | 시스템은 암호화 키를 로그에 기록**하지 않아야 한다** |
| REQ-N05 | 시스템은 48시간 이상 버퍼 데이터를 보관**하지 않아야 한다** |
| REQ-N06 | 시스템은 감사 로그 없이 환자 데이터에 접근**하지 않아야 한다** |

---

## 3. 기술 사양

### 3.1 Envelope Encryption 구조

```
[Envelope Encryption 흐름]

1. 환자 접수 데이터 → 랜덤 AES-256 대칭키 생성
2. 데이터 암호화: AES-256-GCM(data, symmetric_key) → encrypted_data
3. 키 암호화: RSA-OAEP(symmetric_key, public_key) → encrypted_key
4. 저장: { encrypted_data, encrypted_key, iv, submission_id }
```

```typescript
// 암호화 데이터 구조
interface EncryptedSubmission {
  id: string;                    // 자동 생성 ID
  submission_id: string;         // 클라이언트 생성 (멱등성용)
  encrypted_data: string;        // Base64 인코딩된 암호화 데이터
  encrypted_key: string;         // Base64 인코딩된 암호화 대칭키
  iv: string;                    // Base64 인코딩된 IV
  algorithm: 'AES-256-GCM';      // 암호화 알고리즘
  created_at: number;            // Unix timestamp
  expires_at: number;            // TTL (created_at + 48시간)
  status: 'pending' | 'synced' | 'expired';
}
```

### 3.2 데이터베이스 스키마

#### 3.2.1 D1 암호화 버퍼 테이블 (클라우드)

```sql
-- encrypted_buffer: 암호화된 환자 접수 데이터 임시 저장
CREATE TABLE IF NOT EXISTS encrypted_buffer (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(8))),
    submission_id TEXT UNIQUE NOT NULL,
    encrypted_data TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    iv TEXT NOT NULL,
    algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    sync_attempts INTEGER DEFAULT 0,
    last_sync_attempt INTEGER
);

CREATE INDEX idx_encrypted_buffer_status ON encrypted_buffer(status);
CREATE INDEX idx_encrypted_buffer_expires ON encrypted_buffer(expires_at);
CREATE INDEX idx_encrypted_buffer_submission ON encrypted_buffer(submission_id);
```

#### 3.2.2 내부 서버 EMR 테이블 (온프레미스)

```sql
-- patients: 환자 기본 정보 (평문, 내부망 한정)
CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(8))),
    name TEXT NOT NULL,
    rrn TEXT NOT NULL,           -- 주민등록번호
    phone TEXT NOT NULL,
    address TEXT,
    birth_date TEXT,
    gender TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- intake_submissions: 환자 접수 기록
CREATE TABLE IF NOT EXISTS intake_submissions (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(8))),
    submission_id TEXT UNIQUE NOT NULL,
    patient_id TEXT REFERENCES patients(id),
    intake_data TEXT NOT NULL,   -- JSON 형식 접수 데이터
    source TEXT NOT NULL,        -- 'tunnel' | 'buffer_sync'
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- audit_logs: 감사 로그
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(8))),
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,        -- 'view' | 'create' | 'update' | 'delete'
    resource_type TEXT NOT NULL, -- 'patient' | 'intake' | 'settings'
    resource_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    details TEXT,                -- JSON 형식 추가 정보
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

### 3.3 키 관리 전략

```
[키 관리 위치]

┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Pages (클라우드)                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  공개키 (Public Key)                                  │   │
│  │  - 환경 변수로 저장                                    │   │
│  │  - 암호화 전용 (복호화 불가)                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    내부 서버 (온프레미스)                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  개인키 (Private Key)                                 │   │
│  │  - 로컬 파일 시스템 저장                               │   │
│  │  - 복호화 전용                                        │   │
│  │  - 절대 외부 노출 금지                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 아키텍처 다이어그램

```
┌──────────────────────────────────────────────────────────────────────┐
│                         External Network                              │
│                                                                       │
│   ┌─────────────┐     ┌─────────────────────────────────────────┐   │
│   │   Patient   │────▶│         Cloudflare Pages                 │   │
│   │   Browser   │     │  ┌─────────────────────────────────┐    │   │
│   └─────────────┘     │  │     Intake Form Handler          │    │   │
│                       │  │  1. Generate submission_id       │    │   │
│                       │  │  2. Check Tunnel Status          │    │   │
│                       │  │  3. Route: Tunnel or Buffer      │    │   │
│                       │  └────────────┬────────────────────┘    │   │
│                       └───────────────┼─────────────────────────┘   │
│                                       │                              │
│            ┌──────────────────────────┴──────────────────────────┐  │
│            │                                                      │  │
│    ┌───────▼───────┐                               ┌─────────────▼─┐│
│    │ Tunnel (UP)   │                               │ Buffer (DOWN) ││
│    └───────┬───────┘                               └───────┬───────┘│
│            │                                               │        │
└────────────┼───────────────────────────────────────────────┼────────┘
             │                                               │
             │ Direct                              Encrypted │
             │ Storage                              Storage  │
             │                                               │
┌────────────▼───────────────────────────────────────────────▼────────┐
│                         Internal Network (LAN)                       │
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    On-Premise Server                         │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │   │
│   │  │  EMR API    │  │  Sync Agent │  │  Admin Dashboard    │ │   │
│   │  │  (Direct)   │  │  (Pull)     │  │  (LAN Only)         │ │   │
│   │  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │   │
│   │         │                │                     │            │   │
│   │         └────────────────┼─────────────────────┘            │   │
│   │                          │                                   │   │
│   │                    ┌─────▼─────┐                            │   │
│   │                    │  SQLite   │                            │   │
│   │                    │  (EMR DB) │                            │   │
│   │                    └───────────┘                            │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 3.5 Sync Agent 동작 흐름

```typescript
// Sync Agent 의사코드
class SyncAgent {
  private pollInterval = 30000; // 30초

  async start() {
    while (true) {
      await this.syncPendingSubmissions();
      await this.sleep(this.pollInterval);
    }
  }

  async syncPendingSubmissions() {
    // 1. D1 버퍼에서 pending 상태 조회
    const pending = await this.fetchPendingFromBuffer();

    for (const submission of pending) {
      try {
        // 2. 개인키로 대칭키 복호화
        const symmetricKey = await this.decryptKey(
          submission.encrypted_key,
          this.privateKey
        );

        // 3. 대칭키로 데이터 복호화
        const data = await this.decryptData(
          submission.encrypted_data,
          symmetricKey,
          submission.iv
        );

        // 4. 내부 DB에 저장
        await this.saveToLocalDB(data, submission.submission_id);

        // 5. 버퍼에서 상태 업데이트 (synced)
        await this.markAsSynced(submission.id);

      } catch (error) {
        // 6. 실패 시 재시도 카운트 증가
        await this.incrementSyncAttempts(submission.id);
      }
    }
  }
}
```

---

## 4. 제약 조건

### 4.1 기술적 제약

| 제약 | 설명 | 영향 |
|------|------|------|
| Cloudflare Workers 환경 | 제한된 런타임, 10ms CPU 시간 제한 | 암호화 라이브러리 선택 제한 |
| D1 용량 | 500MB 제한 | 버퍼 크기 모니터링 필요 |
| Tunnel 가용성 | 네트워크 의존성 | 버퍼 시스템 필수 |
| 내부 서버 가동 시간 | 영업 시간 외 중단 가능 | 48시간 TTL 정책 |

### 4.2 보안 제약

| 제약 | 설명 | 완화 방안 |
|------|------|----------|
| 개인키 보관 | 내부 서버에만 저장 필수 | 파일 시스템 권한 관리 |
| 키 순환 | 정기적 키 교체 필요 | 분기별 키 순환 정책 |
| 네트워크 분리 | 관리자 페이지 내부망 한정 | LAN IP 체크 미들웨어 |

### 4.3 규정 준수

| 규정 | 요구사항 | 구현 방안 |
|------|----------|----------|
| 개인정보보호법 | 암호화 저장 | AES-256-GCM |
| 의료법 | 진료기록 보관 | 온프레미스 저장 |
| OWASP | 보안 취약점 방지 | 보안 코드 리뷰 |

---

## 5. 비기능적 요구사항

### 5.1 성능

| 메트릭 | 목표 | 측정 방법 |
|--------|------|----------|
| 접수 폼 제출 응답 시간 | < 500ms (P95) | 클라이언트 타이밍 |
| 암호화 처리 시간 | < 100ms | 서버 로그 |
| Sync Agent 처리량 | > 100건/분 | 동기화 로그 |
| 버퍼 TTL 정리 | 매 시간 실행 | 스케줄러 로그 |

### 5.2 보안

| 항목 | 기준 | 검증 방법 |
|------|------|----------|
| 암호화 알고리즘 | AES-256-GCM, RSA-OAEP | 코드 리뷰 |
| 키 길이 | RSA 2048-bit 이상 | 키 생성 검증 |
| 감사 로그 | 모든 데이터 접근 기록 | 로그 검증 |
| 접근 제어 | 내부 LAN 한정 (관리자) | 네트워크 테스트 |

### 5.3 가용성

| 시나리오 | 기대 동작 | 복구 시간 |
|----------|----------|----------|
| Tunnel 장애 | 버퍼로 자동 전환 | 즉시 |
| 내부 서버 장애 | 버퍼 저장 지속 | 48시간 내 복구 필요 |
| D1 장애 | 오류 반환, 재시도 안내 | N/A |

---

## 6. 추적성 태그

```
[SPEC-SECURITY-001] → plan.md
[SPEC-SECURITY-001] → acceptance.md
[SPEC-SECURITY-001] → hq/schema.sql (스키마 수정)
[SPEC-SECURITY-001] → hq/src/crypto.ts (신규)
[SPEC-SECURITY-001] → hq/src/buffer.ts (신규)
[SPEC-SECURITY-001] → internal-server/ (신규 프로젝트)
[SPEC-SECURITY-001] → internal-server/sync-agent.ts (신규)
```

---

## 7. 다음 단계

1. `/moai:2-run SPEC-SECURITY-001` 실행하여 구현 시작
2. `expert-security` 에이전트 협의: 암호화 전략 검토
3. `expert-backend` 에이전트 협의: 온프레미스 API 설계
4. `expert-devops` 에이전트 협의: Cloudflare Tunnel 설정
5. 기존 평문 데이터 마이그레이션 계획 수립
