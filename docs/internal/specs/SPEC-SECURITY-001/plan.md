# SPEC-SECURITY-001: 구현 계획

## 추적성 태그
`[SPEC-SECURITY-001]` - EMR 데이터 보안 아키텍처 전환

---

## 1. 마일스톤 개요

### Priority High - 핵심 보안 (Phase 1)

| 마일스톤 | 목표 | 산출물 |
|----------|------|--------|
| M1 | 클라우드 평문 데이터 즉시 제거 | 데이터 마이그레이션 스크립트 |
| M2 | Envelope Encryption 모듈 구현 | `hq/src/lib/crypto.ts` |
| M3 | 암호화 버퍼 테이블 생성 | `hq/migrations/buffer.sql` |

### Priority High - 온프레미스 기반 (Phase 2)

| 마일스톤 | 목표 | 산출물 |
|----------|------|--------|
| M4 | 온프레미스 EMR 서버 구축 | `internal-server/` 프로젝트 |
| M5 | EMR API 엔드포인트 구현 | `internal-server/src/api/` |
| M6 | 환자 데이터베이스 스키마 | `internal-server/schema.sql` |

### Priority High - 동기화 시스템 (Phase 3)

| 마일스톤 | 목표 | 산출물 |
|----------|------|--------|
| M7 | Sync Agent 구현 | `internal-server/src/sync-agent.ts` |
| M8 | TTL 기반 버퍼 정리 | `hq/src/workers/buffer-cleanup.ts` |

### Priority Medium - Tunnel 통합 (Phase 4)

| 마일스톤 | 목표 | 산출물 |
|----------|------|--------|
| M9 | Cloudflare Tunnel 설정 | `cloudflared` 설정 파일 |
| M10 | Tunnel 상태 감지 및 라우팅 | `hq/src/lib/tunnel.ts` |
| M11 | 접수 폼 핸들러 수정 | `hq/src/routes/intake.ts` |

### Priority Medium - 접근 제어 강화 (Phase 5)

| 마일스톤 | 목표 | 산출물 |
|----------|------|--------|
| M12 | 관리자 LAN 접근 제한 | `internal-server/src/middleware/lan-check.ts` |
| M13 | 감사 로그 시스템 | `internal-server/src/lib/audit.ts` |
| M14 | RBAC 구현 | `internal-server/src/lib/rbac.ts` |

### Priority Low - 확장 기능 (Optional)

| 마일스톤 | 목표 | 산출물 |
|----------|------|--------|
| M15 | MFA 통합 | 2FA 모듈 |
| M16 | PostgreSQL 마이그레이션 경로 | 마이그레이션 가이드 |
| M17 | 실시간 보안 알림 | 알림 시스템 |

---

## 2. 상세 구현 계획

### Phase 1: 클라우드 평문 데이터 제거 (최우선)

#### M1: 클라우드 평문 데이터 즉시 제거

**목표**: D1에 저장된 모든 환자 개인정보 평문 데이터 제거

**긴급도**: **CRITICAL** - 즉시 실행 필요

**단계**:

1. **데이터 백업**
   ```bash
   # D1 데이터베이스 전체 백업
   wrangler d1 export clinic-os --output=backup_$(date +%Y%m%d).sql
   ```

2. **내부 서버 준비 확인**
   - 온프레미스 서버 가동 상태 확인
   - SQLite 데이터베이스 준비

3. **데이터 마이그레이션**
   ```typescript
   // 마이그레이션 스크립트 구조
   async function migratePatientData() {
     // 1. D1에서 환자 데이터 조회
     const patients = await d1.prepare('SELECT * FROM patients').all();

     // 2. 내부 서버로 전송 (보안 채널)
     for (const patient of patients.results) {
       await internalServer.post('/api/patients/migrate', patient);
     }

     // 3. D1에서 삭제
     await d1.prepare('DELETE FROM patients').run();
   }
   ```

4. **검증**
   - [ ] 내부 서버에 모든 데이터 존재 확인
   - [ ] D1에 평문 데이터 없음 확인
   - [ ] 접수 폼 정상 동작 확인

**위험 완화**:
- 마이그레이션 전 전체 백업 필수
- 단계별 진행 (테스트 환경 → 프로덕션)
- 롤백 계획 준비

---

#### M2: Envelope Encryption 모듈 구현

**목표**: 클라우드에서 사용할 암호화 모듈 구현

**파일**: `hq/src/lib/crypto.ts`

```typescript
// Envelope Encryption 구현
import { webcrypto } from 'crypto';

export interface EncryptionResult {
  encryptedData: string;   // Base64
  encryptedKey: string;    // Base64
  iv: string;              // Base64
  algorithm: 'AES-256-GCM';
}

export class EnvelopeEncryption {
  private publicKey: CryptoKey;

  constructor(publicKeyPem: string) {
    // PEM 형식 공개키 파싱
  }

  async encrypt(data: string): Promise<EncryptionResult> {
    // 1. 랜덤 AES-256 대칭키 생성
    const symmetricKey = await webcrypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // 2. IV 생성
    const iv = webcrypto.getRandomValues(new Uint8Array(12));

    // 3. 데이터 암호화 (AES-256-GCM)
    const encryptedData = await webcrypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      symmetricKey,
      new TextEncoder().encode(data)
    );

    // 4. 대칭키 암호화 (RSA-OAEP)
    const rawKey = await webcrypto.subtle.exportKey('raw', symmetricKey);
    const encryptedKey = await webcrypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      this.publicKey,
      rawKey
    );

    return {
      encryptedData: this.toBase64(encryptedData),
      encryptedKey: this.toBase64(encryptedKey),
      iv: this.toBase64(iv),
      algorithm: 'AES-256-GCM'
    };
  }

  private toBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }
}
```

**검증 기준**:
- [ ] AES-256-GCM 암호화 정상 동작
- [ ] RSA-OAEP 키 암호화 정상 동작
- [ ] Cloudflare Workers 환경 호환성
- [ ] 단위 테스트 커버리지 95%+

---

#### M3: 암호화 버퍼 테이블 생성

**목표**: D1에 암호화된 접수 데이터 임시 저장 테이블 생성

**파일**: `hq/migrations/0009_encrypted_buffer.sql`

```sql
-- 암호화 버퍼 테이블
CREATE TABLE IF NOT EXISTS encrypted_buffer (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(8))),
    submission_id TEXT UNIQUE NOT NULL,
    encrypted_data TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    iv TEXT NOT NULL,
    algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'expired', 'failed')),
    sync_attempts INTEGER DEFAULT 0,
    last_sync_attempt INTEGER,
    error_message TEXT
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_encrypted_buffer_status
    ON encrypted_buffer(status);
CREATE INDEX IF NOT EXISTS idx_encrypted_buffer_expires
    ON encrypted_buffer(expires_at);
CREATE INDEX IF NOT EXISTS idx_encrypted_buffer_submission
    ON encrypted_buffer(submission_id);

-- 기존 환자 데이터 테이블 삭제 (평문 데이터 제거)
-- 주의: 마이그레이션 완료 후 실행
-- DROP TABLE IF EXISTS patients;
-- DROP TABLE IF EXISTS intake_submissions;
```

**검증 기준**:
- [ ] 테이블 생성 성공
- [ ] 인덱스 생성 성공
- [ ] CRUD 테스트 통과

---

### Phase 2: 온프레미스 EMR 서버 구축

#### M4: 온프레미스 EMR 서버 구축

**목표**: 내부 네트워크에서 실행될 EMR 서버 프로젝트 생성

**디렉토리 구조**:
```
internal-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # 서버 엔트리포인트
│   ├── config.ts          # 환경 설정
│   ├── api/
│   │   ├── patients.ts    # 환자 API
│   │   ├── intake.ts      # 접수 API
│   │   └── audit.ts       # 감사 로그 API
│   ├── lib/
│   │   ├── db.ts          # SQLite 연결
│   │   ├── crypto.ts      # 복호화 모듈
│   │   ├── audit.ts       # 감사 로그
│   │   └── rbac.ts        # 접근 제어
│   ├── middleware/
│   │   ├── lan-check.ts   # LAN 접근 검증
│   │   └── auth.ts        # 인증
│   └── sync-agent.ts      # 동기화 에이전트
├── schema.sql
├── keys/
│   └── .gitignore         # 키 파일 제외
└── tests/
```

**기술 스택**:
- Runtime: Node.js 20 LTS
- Framework: Hono (경량 프레임워크)
- Database: SQLite (better-sqlite3)
- 향후: PostgreSQL 마이그레이션 경로 제공

---

#### M5: EMR API 엔드포인트 구현

**목표**: 환자 데이터 CRUD API 구현

**엔드포인트**:

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| POST | `/api/patients` | 환자 등록 | Required |
| GET | `/api/patients/:id` | 환자 조회 | Required + Audit |
| PUT | `/api/patients/:id` | 환자 수정 | Required + Audit |
| DELETE | `/api/patients/:id` | 환자 삭제 | Admin + Audit |
| POST | `/api/intake` | 접수 데이터 저장 | Internal |
| POST | `/api/intake/sync` | 버퍼 데이터 동기화 | Sync Agent |

**구현 예시**:
```typescript
// src/api/patients.ts
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { auditLog } from '../lib/audit';

const patients = new Hono();

patients.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  // 감사 로그 기록
  await auditLog({
    userId: user.id,
    action: 'view',
    resourceType: 'patient',
    resourceId: id,
    ipAddress: c.req.header('x-forwarded-for'),
    userAgent: c.req.header('user-agent')
  });

  const patient = await db.getPatient(id);
  return c.json({ success: true, data: patient });
});

export default patients;
```

---

#### M6: 환자 데이터베이스 스키마

**목표**: 온프레미스 SQLite 스키마 정의

**파일**: `internal-server/schema.sql`

```sql
-- 환자 기본 정보
CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(8))),
    name TEXT NOT NULL,
    rrn TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    birth_date TEXT,
    gender TEXT CHECK (gender IN ('M', 'F', 'O')),
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 접수 기록
CREATE TABLE IF NOT EXISTS intake_submissions (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(8))),
    submission_id TEXT UNIQUE NOT NULL,
    patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
    intake_data TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('tunnel', 'buffer_sync')),
    synced_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 진료 기록
CREATE TABLE IF NOT EXISTS medical_records (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(8))),
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_date TEXT NOT NULL,
    chief_complaint TEXT,
    diagnosis TEXT,
    treatment TEXT,
    prescription TEXT,
    notes TEXT,
    doctor_id TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 감사 로그
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(8))),
    user_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('view', 'create', 'update', 'delete', 'export', 'login', 'logout')),
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    details TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 사용자 (관리자, 의료진)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(8))),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'doctor', 'staff')),
    is_active INTEGER DEFAULT 1,
    last_login INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_patients_rrn ON patients(rrn);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_intake_patient ON intake_submissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_patient ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
```

---

### Phase 3: 동기화 시스템

#### M7: Sync Agent 구현

**목표**: 암호화 버퍼에서 데이터를 풀링하여 복호화 후 로컬 DB에 저장

**파일**: `internal-server/src/sync-agent.ts`

```typescript
import { CronJob } from 'cron';
import { EnvelopeDecryption } from './lib/crypto';
import { db } from './lib/db';

interface BufferEntry {
  id: string;
  submission_id: string;
  encrypted_data: string;
  encrypted_key: string;
  iv: string;
  algorithm: string;
}

class SyncAgent {
  private decryptor: EnvelopeDecryption;
  private cloudflareApiToken: string;
  private databaseId: string;
  private pollInterval: number = 30000; // 30초

  constructor(privateKeyPath: string) {
    this.decryptor = new EnvelopeDecryption(privateKeyPath);
    this.cloudflareApiToken = process.env.CF_API_TOKEN!;
    this.databaseId = process.env.D1_DATABASE_ID!;
  }

  async start() {
    console.log('[SyncAgent] Starting...');

    // 즉시 1회 실행
    await this.syncPendingSubmissions();

    // 주기적 실행
    setInterval(async () => {
      await this.syncPendingSubmissions();
    }, this.pollInterval);
  }

  async syncPendingSubmissions() {
    try {
      // 1. D1에서 pending 상태 조회 (Cloudflare API)
      const pending = await this.fetchPendingFromBuffer();

      if (pending.length === 0) {
        return;
      }

      console.log(`[SyncAgent] Found ${pending.length} pending submissions`);

      for (const entry of pending) {
        await this.processEntry(entry);
      }
    } catch (error) {
      console.error('[SyncAgent] Sync error:', error);
    }
  }

  private async processEntry(entry: BufferEntry) {
    try {
      // 2. 복호화
      const data = await this.decryptor.decrypt({
        encryptedData: entry.encrypted_data,
        encryptedKey: entry.encrypted_key,
        iv: entry.iv
      });

      const intakeData = JSON.parse(data);

      // 3. 환자 찾기 또는 생성
      const patient = await this.findOrCreatePatient(intakeData);

      // 4. 접수 데이터 저장
      await db.run(`
        INSERT INTO intake_submissions (submission_id, patient_id, intake_data, source, synced_at)
        VALUES (?, ?, ?, 'buffer_sync', strftime('%s', 'now'))
      `, [entry.submission_id, patient.id, JSON.stringify(intakeData)]);

      // 5. 버퍼 상태 업데이트
      await this.markAsSynced(entry.id);

      console.log(`[SyncAgent] Synced submission: ${entry.submission_id}`);
    } catch (error) {
      console.error(`[SyncAgent] Failed to process ${entry.submission_id}:`, error);
      await this.incrementSyncAttempts(entry.id, error.message);
    }
  }

  private async fetchPendingFromBuffer(): Promise<BufferEntry[]> {
    // Cloudflare D1 REST API 호출
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${this.databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.cloudflareApiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sql: `SELECT * FROM encrypted_buffer WHERE status = 'pending' AND sync_attempts < 5 ORDER BY created_at LIMIT 50`
        })
      }
    );

    const result = await response.json();
    return result.result[0].results || [];
  }

  private async markAsSynced(id: string) {
    // D1 API로 상태 업데이트
    await this.executeD1Query(
      `UPDATE encrypted_buffer SET status = 'synced' WHERE id = ?`,
      [id]
    );
  }

  private async incrementSyncAttempts(id: string, errorMessage: string) {
    await this.executeD1Query(
      `UPDATE encrypted_buffer
       SET sync_attempts = sync_attempts + 1,
           last_sync_attempt = strftime('%s', 'now'),
           error_message = ?
       WHERE id = ?`,
      [errorMessage, id]
    );
  }
}

// 시작
const agent = new SyncAgent('./keys/private.pem');
agent.start();
```

---

#### M8: TTL 기반 버퍼 정리

**목표**: 48시간 경과 데이터 자동 삭제

**파일**: `hq/src/workers/buffer-cleanup.ts`

```typescript
// Cloudflare Workers Cron Trigger
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // 매 시간 실행
    const now = Math.floor(Date.now() / 1000);

    // 만료된 데이터 삭제
    const result = await env.DB.prepare(`
      DELETE FROM encrypted_buffer
      WHERE expires_at < ? OR status = 'synced'
    `).bind(now).run();

    console.log(`[BufferCleanup] Deleted ${result.meta.changes} expired entries`);

    // 실패한 항목 처리 (5회 이상 실패)
    await env.DB.prepare(`
      UPDATE encrypted_buffer
      SET status = 'failed'
      WHERE sync_attempts >= 5 AND status = 'pending'
    `).run();
  }
};
```

**wrangler.toml 설정**:
```toml
[triggers]
crons = ["0 * * * *"]  # 매 시간 정각
```

---

### Phase 4: Tunnel 통합

#### M9: Cloudflare Tunnel 설정

**목표**: 내부 서버와 Cloudflare 간 보안 터널 구성

**설정 단계**:

1. **Cloudflared 설치**
   ```bash
   # macOS
   brew install cloudflare/cloudflare/cloudflared

   # 인증
   cloudflared tunnel login
   ```

2. **터널 생성**
   ```bash
   cloudflared tunnel create clinic-os-internal
   ```

3. **설정 파일**
   ```yaml
   # ~/.cloudflared/config.yml
   tunnel: clinic-os-internal
   credentials-file: ~/.cloudflared/clinic-os-internal.json

   ingress:
     - hostname: internal-api.clinic-os.com
       service: http://localhost:3000
       originRequest:
         noTLSVerify: true
     - service: http_status:404
   ```

4. **터널 실행**
   ```bash
   cloudflared tunnel run clinic-os-internal
   ```

---

#### M10: Tunnel 상태 감지 및 라우팅

**목표**: Tunnel 연결 상태에 따른 동적 라우팅

**파일**: `hq/src/lib/tunnel.ts`

```typescript
export async function checkTunnelStatus(env: Env): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(env.INTERNAL_API_URL + '/health', {
      signal: controller.signal,
      headers: {
        'X-Tunnel-Check': 'true'
      }
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

export async function routeIntakeSubmission(
  data: IntakeData,
  env: Env
): Promise<{ success: boolean; route: 'tunnel' | 'buffer' }> {
  const tunnelUp = await checkTunnelStatus(env);

  if (tunnelUp) {
    // 직접 전송
    const response = await fetch(env.INTERNAL_API_URL + '/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      return { success: true, route: 'tunnel' };
    }
  }

  // 버퍼로 저장
  const encrypted = await encryptAndStore(data, env);
  return { success: encrypted, route: 'buffer' };
}
```

---

### Phase 5: 접근 제어 강화

#### M12: 관리자 LAN 접근 제한

**목표**: 관리자 페이지 내부 LAN 접근만 허용

**파일**: `internal-server/src/middleware/lan-check.ts`

```typescript
import { Context, Next } from 'hono';

const ALLOWED_NETWORKS = [
  '192.168.0.0/16',   // 사설망
  '10.0.0.0/8',       // 사설망
  '172.16.0.0/12',    // 사설망
  '127.0.0.1/8',      // 로컬호스트
];

export async function lanCheckMiddleware(c: Context, next: Next) {
  const clientIP = c.req.header('x-forwarded-for')?.split(',')[0] ||
                   c.req.header('x-real-ip') ||
                   '0.0.0.0';

  const isAllowed = ALLOWED_NETWORKS.some(network =>
    isIPInCIDR(clientIP, network)
  );

  if (!isAllowed) {
    return c.json(
      { error: 'Access denied. Internal network only.' },
      403
    );
  }

  await next();
}

function isIPInCIDR(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);

  const ipNum = ipToNumber(ip);
  const networkNum = ipToNumber(network);
  const mask = ~(2 ** (32 - prefix) - 1);

  return (ipNum & mask) === (networkNum & mask);
}

function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}
```

---

#### M13: 감사 로그 시스템

**목표**: 모든 환자 데이터 접근 기록

**파일**: `internal-server/src/lib/audit.ts`

```typescript
import { db } from './db';

interface AuditLogEntry {
  userId: string;
  action: 'view' | 'create' | 'update' | 'delete' | 'export' | 'login' | 'logout';
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

export async function auditLog(entry: AuditLogEntry): Promise<void> {
  await db.run(`
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    entry.userId,
    entry.action,
    entry.resourceType,
    entry.resourceId || null,
    entry.ipAddress || null,
    entry.userAgent || null,
    entry.details ? JSON.stringify(entry.details) : null
  ]);
}

export async function getAuditLogs(options: {
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}) {
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: unknown[] = [];

  if (options.userId) {
    query += ' AND user_id = ?';
    params.push(options.userId);
  }

  if (options.resourceType) {
    query += ' AND resource_type = ?';
    params.push(options.resourceType);
  }

  if (options.startDate) {
    query += ' AND created_at >= ?';
    params.push(options.startDate);
  }

  if (options.endDate) {
    query += ' AND created_at <= ?';
    params.push(options.endDate);
  }

  query += ' ORDER BY created_at DESC';
  query += ` LIMIT ? OFFSET ?`;
  params.push(options.limit || 50, options.offset || 0);

  return db.all(query, params);
}
```

---

## 3. 기술적 접근 방식

### 3.1 아키텍처 결정

| 결정 | 선택 | 근거 |
|------|------|------|
| 암호화 알고리즘 | AES-256-GCM + RSA-OAEP | 업계 표준, Cloudflare Workers 지원 |
| 온프레미스 DB | SQLite (초기) → PostgreSQL (확장) | 단순성, 마이그레이션 용이 |
| API 프레임워크 | Hono | 경량, TypeScript 지원, 빠른 성능 |
| 동기화 방식 | Pull (내부 → 클라우드) | 보안 (내부 서버 비노출) |
| TTL 정책 | 48시간 | 영업일 2일 커버, 데이터 최소화 |

### 3.2 의존성

| 의존성 | 버전 | 용도 | 위치 |
|--------|------|------|------|
| hono | ^4.0.0 | API 프레임워크 | 내부 서버 |
| better-sqlite3 | ^9.0.0 | SQLite 드라이버 | 내부 서버 |
| node-cron | ^3.0.0 | 스케줄러 | 내부 서버 |
| @cloudflare/workers-types | ^4.0.0 | 타입 정의 | 클라우드 |

### 3.3 테스트 전략

| 테스트 유형 | 범위 | 도구 |
|------------|------|------|
| 단위 테스트 | 암호화 모듈, 감사 로그 | Vitest |
| 통합 테스트 | API 엔드포인트, DB 연동 | Vitest + Supertest |
| E2E 테스트 | 전체 흐름 (접수 → 동기화) | Playwright |
| 보안 테스트 | 취약점 스캔 | OWASP ZAP |

---

## 4. 위험 요소 및 완화 방안

| 위험 | 영향 | 확률 | 완화 방안 |
|------|------|------|----------|
| 데이터 마이그레이션 실패 | Critical | Low | 전체 백업, 단계적 진행 |
| 개인키 분실 | Critical | Low | 키 백업, 복구 절차 문서화 |
| Tunnel 장기 장애 | High | Medium | 버퍼 TTL 연장, 수동 동기화 도구 |
| 동기화 중복 | Medium | Low | submission_id 멱등성 |
| 내부 서버 장애 | High | Low | 모니터링, 알림 시스템 |

---

## 5. 파일 구조

```
clinic-os/
├── hq/                           # Cloudflare 프로젝트
│   ├── src/
│   │   ├── lib/
│   │   │   ├── crypto.ts         # [신규] Envelope Encryption
│   │   │   └── tunnel.ts         # [신규] Tunnel 상태 체크
│   │   ├── routes/
│   │   │   └── intake.ts         # [수정] 접수 핸들러
│   │   └── workers/
│   │       └── buffer-cleanup.ts # [신규] TTL 정리
│   └── migrations/
│       └── 0009_encrypted_buffer.sql  # [신규]
│
├── internal-server/              # [신규] 온프레미스 서버
│   ├── package.json
│   ├── tsconfig.json
│   ├── schema.sql
│   ├── src/
│   │   ├── index.ts
│   │   ├── config.ts
│   │   ├── api/
│   │   │   ├── patients.ts
│   │   │   ├── intake.ts
│   │   │   └── audit.ts
│   │   ├── lib/
│   │   │   ├── db.ts
│   │   │   ├── crypto.ts         # 복호화 모듈
│   │   │   ├── audit.ts
│   │   │   └── rbac.ts
│   │   ├── middleware/
│   │   │   ├── lan-check.ts
│   │   │   └── auth.ts
│   │   └── sync-agent.ts
│   ├── keys/
│   │   ├── .gitignore
│   │   └── README.md             # 키 생성 가이드
│   └── tests/
│
└── docs/
    └── security/
        ├── key-management.md     # 키 관리 가이드
        └── migration-guide.md    # 마이그레이션 가이드
```

---

## 6. 검토 및 승인

| 역할 | 담당 | 상태 |
|------|------|------|
| 보안 설계 | expert-security | 대기 |
| 백엔드 아키텍처 | expert-backend | 대기 |
| DevOps | expert-devops | 대기 |
| 최종 승인 | super_admin | 대기 |

---

## 7. 추적성 태그

```
[SPEC-SECURITY-001] → spec.md (요구사항)
[SPEC-SECURITY-001] → acceptance.md (수용 기준)
[SPEC-SECURITY-001] → hq/src/lib/crypto.ts (M2)
[SPEC-SECURITY-001] → hq/migrations/0009_encrypted_buffer.sql (M3)
[SPEC-SECURITY-001] → internal-server/ (M4-M6)
[SPEC-SECURITY-001] → internal-server/src/sync-agent.ts (M7)
[SPEC-SECURITY-001] → hq/src/workers/buffer-cleanup.ts (M8)
```
