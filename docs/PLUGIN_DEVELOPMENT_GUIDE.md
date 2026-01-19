# 플러그인 개발 가이드

Clinic-OS 플러그인 시스템을 사용하여 기능을 확장하는 방법을 설명합니다.

## 플러그인 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        Clinic-OS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  src/plugins/                                            │   │
│  │  ├── installed.json         # 설치된 플러그인 목록        │   │
│  │  ├── vip-management/        # 플러그인 코드              │   │
│  │  │   ├── manifest.json      # 플러그인 설정              │   │
│  │  │   ├── migration.sql      # DB 스키마                  │   │
│  │  │   ├── pages/             # 관리자 페이지              │   │
│  │  │   ├── api/               # API 엔드포인트             │   │
│  │  │   ├── components/        # UI 컴포넌트                │   │
│  │  │   └── lib/               # 비즈니스 로직              │   │
│  │  └── another-plugin/                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  동적 라우팅                                              │   │
│  │  ├── /admin/hub/{plugin-id}/*      페이지 라우트         │   │
│  │  └── /api/hub/{plugin-id}/*        API 라우트            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 핵심 원칙

### 1. 코어 코드 침범 금지

플러그인은 **자체 영역에서만** 동작합니다:
- 자체 페이지: `/admin/hub/{plugin-id}/*`
- 자체 API: `/api/hub/{plugin-id}/*`
- 자체 DB 테이블: `custom_` 접두사 사용

### 2. Plugin SDK를 통한 코어 데이터 접근

코어 데이터(환자, 예약, 결제 등)는 **Plugin SDK API**를 통해서만 접근합니다:

```typescript
// 플러그인 내 API 예시
import { createPluginSDK } from '@clinic-os/plugin-sdk';

export async function GET({ locals }) {
  const sdk = createPluginSDK(db, context);

  // 코어 데이터 읽기
  const patients = await sdk.patients.list({ status: 'active' });
  const payments = await sdk.payments.getByPatient(patientId);

  return new Response(JSON.stringify(patients));
}
```

---

## 플러그인 구조

### 디렉토리 구조

```
src/plugins/{plugin-id}/
├── manifest.json       # 필수: 플러그인 메타데이터
├── migration.sql       # 선택: DB 스키마
├── pages/              # 관리자 페이지
│   ├── index.astro     # 메인 대시보드
│   └── settings.astro  # 설정 페이지
├── api/                # API 엔드포인트
│   └── data.ts
├── components/         # UI 컴포넌트
│   └── Widget.astro
└── lib/                # 비즈니스 로직
    └── utils.ts
```

### manifest.json

```json
{
  "id": "vip-management",
  "name": "VIP 관리",
  "description": "VIP 회원 등급 및 포인트 관리 시스템",
  "version": "1.0.0",
  "author": "Clinic-OS",

  "pages": [
    { "path": "index", "title": "대시보드", "description": "VIP 현황" },
    { "path": "members", "title": "회원 관리" },
    { "path": "settings", "title": "설정" }
  ],

  "apis": [
    { "path": "members", "methods": ["GET", "POST"] },
    { "path": "members/:id", "methods": ["GET", "PUT", "DELETE"] },
    { "path": "points", "methods": ["POST"] }
  ],

  "tables": [
    "custom_vip_members",
    "custom_vip_point_history"
  ],

  "hooks": [
    { "event": "onPaymentCompleted", "handler": "handlePayment" }
  ],

  "permissions": [
    "read:patients",
    "read:payments",
    "database:read",
    "database:write"
  ]
}
```

---

## 데이터베이스

### 규칙: custom_ 접두사 필수

플러그인 테이블은 **반드시** `custom_` 접두사를 사용합니다:

```sql
-- ✅ Good
CREATE TABLE custom_vip_members (...);
CREATE TABLE custom_loyalty_points (...);

-- ❌ Bad - 코어 테이블과 충돌 가능
CREATE TABLE vip_members (...);
```

### migration.sql 예시

```sql
-- src/plugins/vip-management/migration.sql

CREATE TABLE IF NOT EXISTS custom_vip_members (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  tier TEXT DEFAULT 'silver',
  points INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(patient_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_vip_patient
  ON custom_vip_members(patient_id);

CREATE TABLE IF NOT EXISTS custom_vip_point_history (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'earn', 'spend', 'expire'
  amount INTEGER NOT NULL,
  description TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
```

### 코어 테이블 참조

커스텀 테이블에서 코어 테이블을 FK로 참조할 수 있습니다:

```sql
CREATE TABLE custom_vip_members (
  patient_id TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);
```

---

## Plugin SDK API

플러그인에서 코어 데이터에 접근할 때 사용합니다.

### 환자 API

```typescript
// 목록 조회
const patients = await sdk.patients.list({ status: 'active', limit: 50 });

// 단일 조회
const patient = await sdk.patients.get(patientId);

// 검색
const results = await sdk.patients.search('홍길동');
```

### 결제 API

```typescript
// 환자별 결제 내역
const payments = await sdk.payments.getByPatient(patientId);

// 총 결제액
const total = await sdk.payments.getTotalAmount(patientId);
```

### 예약 API

```typescript
// 오늘 예약
const today = await sdk.reservations.getToday();

// 환자별 예약
const reservations = await sdk.reservations.getByPatient(patientId);
```

### 데이터베이스 직접 접근

커스텀 테이블 조작 시:

```typescript
// 조회
const members = await sdk.database.query(
  'SELECT * FROM custom_vip_members WHERE tier = ?',
  ['gold']
);

// 실행
await sdk.database.execute(
  'INSERT INTO custom_vip_members (id, patient_id, tier) VALUES (?, ?, ?)',
  [id, patientId, 'silver']
);
```

### 권한

SDK 사용 시 manifest.json의 `permissions`에 선언된 권한만 사용 가능합니다:

| 권한 | 설명 |
|------|------|
| `read:patients` | 환자 정보 읽기 |
| `write:patients` | 환자 정보 수정 |
| `read:payments` | 결제 정보 읽기 |
| `read:reservations` | 예약 정보 읽기 |
| `database:read` | 커스텀 테이블 조회 |
| `database:write` | 커스텀 테이블 수정 |

---

## 훅 (Hooks)

코어 이벤트에 반응하여 플러그인 로직을 실행합니다.

### 사용 가능한 이벤트

| 이벤트 | 설명 | 페이로드 |
|--------|------|----------|
| `onPatientCreated` | 환자 생성 | `{ patient }` |
| `onPaymentCompleted` | 결제 완료 | `{ payment, patient }` |
| `onReservationCreated` | 예약 생성 | `{ reservation }` |
| `onVisitCheckin` | 내원 체크인 | `{ visit, patient }` |

### 훅 핸들러 구현

```typescript
// src/plugins/vip-management/lib/hooks.ts

export async function handlePayment(event: PaymentEvent, sdk: PluginSDK) {
  const { payment, patient } = event;

  // VIP 포인트 적립
  const points = Math.floor(payment.amount * 0.01);

  await sdk.database.execute(
    `UPDATE custom_vip_members
     SET points = points + ?, total_spent = total_spent + ?
     WHERE patient_id = ?`,
    [points, payment.amount, patient.id]
  );
}
```

---

## 로컬 개발

### 1. 플러그인 디렉토리 생성

```bash
mkdir -p src/plugins/my-plugin/{pages,api,components,lib}
```

### 2. manifest.json 작성

```bash
cat > src/plugins/my-plugin/manifest.json << 'EOF'
{
  "id": "my-plugin",
  "name": "내 플러그인",
  "description": "설명",
  "version": "1.0.0",
  "author": "개발자",
  "pages": [
    { "path": "index", "title": "대시보드" }
  ],
  "permissions": ["read:patients"]
}
EOF
```

### 3. installed.json에 등록

```bash
cat > src/plugins/installed.json << 'EOF'
[
  {
    "id": "my-plugin",
    "version": "1.0.0",
    "installedAt": 1705500000,
    "source": "local"
  }
]
EOF
```

### 4. 마이그레이션 실행 (테이블 있으면)

```bash
npx wrangler d1 execute clinic-os-dev --local \
  --file=src/plugins/my-plugin/migration.sql
```

### 5. 개발 서버에서 확인

```bash
npm run dev
# http://localhost:4321/admin/hub/my-plugin
```

---

## HQ 배포

### 1. 플러그인 패키징

```bash
npx cos-cli plugin package --id my-plugin
# → my-plugin-1.0.0.zip 생성
```

### 2. HQ에 제출

```bash
npx cos-cli plugin submit --file my-plugin-1.0.0.zip
```

### 3. 다른 클리닉에서 설치

```bash
npx cos-cli plugin install --id my-plugin
```

---

## 플러그인 설치-배포 워크플로우

플러그인 설치부터 프로덕션 배포까지의 전체 흐름입니다.

### 아키텍처 이해

Clinic-OS는 **Astro + Cloudflare Pages** 기반입니다:
- Astro는 **빌드 타임**에 라우트 생성
- Cloudflare Workers는 **번들된 코드만** 실행 가능
- 따라서 플러그인 설치 후 **재빌드 & 재배포** 필요

### 전체 플로우

```
┌─────────────────────────────────────────────────────────────┐
│  1. HQ (플러그인 스토어)                                     │
│     └── 플러그인 코드 (.zip) 저장                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ npx cos-cli plugin install --id xxx
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  2. 로컬 개발 환경                                           │
│     └── src/plugins/{plugin-id}/ 에 코드 다운로드            │
│                                                             │
│     • npm run dev → 로컬에서 플러그인 테스트                  │
│     • DB 마이그레이션 실행 (있으면)                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ npm run build
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  3. 빌드 (Astro)                                            │
│     └── 플러그인 페이지/API가 dist/에 컴파일됨                │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ git push / wrangler pages deploy
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Cloudflare Pages (프로덕션)                              │
│     └── 플러그인 포함된 새 버전 배포 완료                     │
└─────────────────────────────────────────────────────────────┘
```

### 설치 명령어 순서

```bash
# 1. 플러그인 다운로드 (HQ → 로컬)
npx cos-cli plugin install --id vip-management

# 2. 로컬 DB 마이그레이션 (테이블 생성)
npx wrangler d1 execute clinic-os-dev --local \
  --file=src/plugins/vip-management/migration.sql

# 3. 로컬 테스트
npm run dev
# → http://localhost:4321/admin/hub/vip-management 확인

# 4. 빌드
npm run build

# 5. 프로덕션 배포 (방법 A: Git)
git add src/plugins/vip-management
git commit -m "feat: add vip-management plugin"
git push origin main
# → Cloudflare Pages 자동 빌드 & 배포

# 5. 프로덕션 배포 (방법 B: 직접)
npx wrangler pages deploy dist

# 6. 프로덕션 DB 마이그레이션
npx wrangler d1 execute clinic-os-db \
  --file=src/plugins/vip-management/migration.sql
```

### 장점

| 항목 | 설명 |
|------|------|
| **보안** | 런타임 동적 코드 실행 없음 |
| **안정성** | 프로덕션 배포 전 로컬 테스트 가능 |
| **버전 관리** | 플러그인 코드가 git에 포함됨 |
| **롤백** | git revert로 플러그인 제거 가능 |

### 주의사항

- 플러그인 설치 ≠ 즉시 활성화 (재배포 필요)
- 각 클리닉이 자체 배포를 관리
- 프로덕션 DB 마이그레이션은 별도 실행 필요

---

## 예시: VIP 관리 플러그인

### 구조

```
src/plugins/vip-management/
├── manifest.json
├── migration.sql
├── pages/
│   ├── index.astro      # VIP 대시보드
│   ├── members.astro    # 회원 목록
│   └── settings.astro   # 등급 설정
├── api/
│   ├── members.ts       # 회원 CRUD
│   └── points.ts        # 포인트 적립/차감
└── lib/
    ├── hooks.ts         # 결제 시 포인트 자동 적립
    └── tiers.ts         # 등급 계산 로직
```

### 동작 흐름

1. 환자가 결제 완료
2. `onPaymentCompleted` 훅 트리거
3. `hooks.ts`의 `handlePayment()` 실행
4. VIP 포인트 자동 적립
5. `/admin/hub/vip-management`에서 확인

---

## FAQ

### Q: 기존 환자 상세 페이지에 정보를 추가하고 싶어요

플러그인은 코어 페이지를 수정할 수 없습니다. 대신:
1. 플러그인 자체 페이지에서 환자 정보 + 추가 정보 표시
2. 사이드바에 플러그인 링크 추가 (향후 지원 예정)

### Q: 코어 테이블에 필드를 추가하고 싶어요

불가능합니다. 대신 별도 테이블을 만들어 FK로 연결하세요:

```sql
CREATE TABLE custom_patient_extra (
  patient_id TEXT PRIMARY KEY,
  custom_field TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);
```

### Q: 플러그인 삭제하면 데이터는?

`custom_` 테이블은 수동 삭제가 필요합니다. CLI에서 옵션 제공 예정:

```bash
npx cos-cli plugin uninstall --id my-plugin --drop-tables
```

### Q: 다른 플러그인의 데이터에 접근하고 싶어요

현재는 지원하지 않습니다. 플러그인 간 의존성은 향후 검토 예정.
