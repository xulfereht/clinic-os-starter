# Plugin API Reference

플러그인 개발에 필요한 훅 이벤트와 SDK API 레퍼런스입니다.

---

## 훅 이벤트 (Hooks)

플러그인은 코어 시스템 이벤트에 반응하여 로직을 실행할 수 있습니다.

### 훅 등록 방법

```json
// manifest.json
{
  "hooks": [
    { "event": "onPaymentCompleted", "handler": "handlePayment" },
    { "event": "onPatientCreated", "handler": "handleNewPatient" }
  ]
}
```

```typescript
// lib/hooks.ts
export async function handlePayment(context: HookContext) {
  const { patientId, amount } = context.data;
  // 플러그인 로직
}
```

---

### 환자 (Patient) 이벤트

#### onPatientCreated

환자가 새로 생성될 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `patientId` | string | 환자 ID |
| `name` | string | 환자 이름 |
| `phone` | string | 연락처 |
| `birthDate` | string | 생년월일 (YYYY-MM-DD) |
| `gender` | string | 성별 (M/F) |
| `source` | string | 생성 경로 (intake_form, lead_conversion) |

**트리거 위치:**
- `POST /api/intake/submit` - 문진표 접수 시
- `POST /api/admin/leads/[id]/convert` - 리드 → 환자 전환 시

---

#### onPatientUpdated

환자 정보가 수정될 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `patientId` | string | 환자 ID |
| `changes` | string[] | 변경된 항목 목록 |
| `updatedFields` | object | 변경된 필드들 |

**트리거 위치:**
- `PUT /api/admin/patients/[id]` - 환자 정보 수정 시

---

#### onPatientDeleted

환자가 삭제(소프트 삭제)될 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `patientId` | string | 환자 ID |

**트리거 위치:**
- `DELETE /api/admin/patients/[id]/delete` - 환자 삭제 시

---

### 리드 (Lead) 이벤트

#### onLeadCreated

새 리드(문의)가 생성될 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `leadId` | string | 리드 ID |
| `name` | string | 이름 |
| `contact` | string | 연락처 |
| `channel` | string | 유입 경로 (phone, walk_in, etc.) |
| `patientId` | string\|null | 연결된 환자 ID |
| `patientType` | string | 환자 유형 (new_lead, existing_customer) |
| `consultType` | string | 상담 유형 (visit, remote) |

**트리거 위치:**
- `POST /api/admin/leads/create` - 리드 수동 생성 시

---

#### onLeadStatusChanged

리드 상태가 변경될 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `leadId` | string | 리드 ID |
| `newStatus` | string | 새 상태 |
| `consultType` | string\|null | 상담 유형 |
| `patientType` | string\|null | 환자 유형 |
| `holdReason` | string\|null | 보류 사유 |

**상태 값:**
- `new` - 신규
- `pending` - 대기
- `consulting` - 상담중
- `first_visit_reservation` - 초진 예약
- `remote_reservation` - 비대면 예약
- `closed` - 종료
- `hold` - 보류
- `cancelled` - 취소

**트리거 위치:**
- `POST /api/admin/leads/update-status` - 상태 변경 시

---

#### onLeadConverted

리드가 환자로 전환될 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `leadId` | string | 리드 ID |
| `patientId` | string | 생성/연결된 환자 ID |
| `action` | string | 'created' 또는 'linked' |

**트리거 위치:**
- `POST /api/admin/leads/[id]/convert` - 리드 전환 시

---

### 예약 (Reservation) 이벤트

#### onReservationCreated

예약이 생성될 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `reservationId` | string | 예약 ID |
| `patientId` | string | 환자 ID |
| `doctorId` | string\|null | 담당의 ID |
| `reservedAt` | number | 예약 시간 (Unix timestamp) |
| `status` | string | 상태 (scheduled, completed) |
| `isWalkIn` | boolean | 워크인 여부 |

**트리거 위치:**
- `POST /api/reservations` - 예약 생성 시
- `POST /api/admin/leads/[id]/convert` - 리드 전환 시 예약 생성

---

#### onReservationUpdated

예약 정보가 변경될 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `reservationId` | string | 예약 ID |
| `patientId` | string | 환자 ID |
| `oldStatus` | string | 이전 상태 |
| `newStatus` | string | 새 상태 |
| `changes` | string[] | 변경 사항 목록 |

**트리거 위치:**
- `PATCH /api/reservations/[id]` - 예약 수정 시

---

#### onReservationCancelled

예약이 취소될 때 발동 (onReservationUpdated의 특수 케이스)

`onReservationUpdated` 이벤트에서 `newStatus === 'cancelled'`로 감지 가능

---

### 내원 (Visit) 이벤트

#### onVisitCheckin

환자가 내원 체크인할 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `eventId` | string | 이벤트 ID |
| `reservationId` | string\|undefined | 예약 ID (워크인은 없음) |
| `patientId` | string | 환자 ID |
| `doctorId` | string\|null | 담당의 ID |
| `visitType` | string | 'first' (초진) 또는 'return' (재진) |
| `visitTitle` | string | '초진 내원' 또는 '재진 내원' |
| `isWalkIn` | boolean | 워크인 여부 |

**트리거 위치:**
- `PATCH /api/reservations/[id]` - 예약 완료 처리 시
- `POST /api/admin/patients/[id]/walk-in` - 워크인 처리 시

---

### 결제 (Payment) 이벤트

#### onPaymentCompleted

결제가 완료될 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `paymentId` | string | 결제 ID |
| `patientId` | string | 환자 ID |
| `productId` | string\|null | 상품 ID |
| `amount` | number | 결제 금액 |
| `method` | string | 결제 방법 (card, cash, etc.) |
| `quantity` | number | 수량 |
| `paidAt` | number | 결제 시간 (Unix timestamp) |

**트리거 위치:**
- `POST /api/payments/create` - 결제 생성 시

---

#### onPaymentRefunded

환불이 처리될 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `refundPaymentId` | string | 환불 결제 ID |
| `originalPaymentId` | string | 원 결제 ID |
| `patientId` | string | 환자 ID |
| `productId` | string\|null | 상품 ID |
| `refundAmount` | number | 환불 금액 |
| `refundQuantity` | number | 환불 수량 |
| `newStatus` | string | 원 결제 새 상태 |

**트리거 위치:**
- `POST /api/admin/payments/refund` - 환불 처리 시

---

### 배송 (Shipping) 이벤트

#### onShippingCreated

배송 주문이 생성될 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `shippingOrderId` | string | 배송 주문 ID |
| `patientId` | string | 환자 ID |
| `productName` | string | 상품명 |
| `totalQuantity` | number | 총 수량 |
| `status` | string | 상태 (active, completed) |
| `paymentId` | string | 연관 결제 ID |

**트리거 위치:**
- `POST /api/admin/patients/[id]/payments` - 결제 생성 시 배송 주문 자동 생성

---

#### onShippingStatusChanged

배송 상태가 변경될 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `shippingOrderId` | string | 배송 주문 ID |
| `patientId` | string | 환자 ID |
| `newStatus` | string | 새 상태 (active, completed) |
| `remainingQuantity` | number | 남은 수량 |
| `trackingNumber` | string\|null | 운송장 번호 |
| `shippedAt` | number | 발송 시간 |

**트리거 위치:**
- `POST /api/admin/shipping/[id]/ship` - 발송 처리 시

---

### 캠페인 (Campaign) 이벤트

#### onCampaignSent

캠페인이 발송될 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `campaignId` | string | 캠페인 ID |
| `runId` | string | 실행 ID |
| `templateId` | string | 템플릿 ID |
| `channel` | string | 채널 (SMS, ALIMTALK, BOTH) |
| `totalCount` | number | 총 발송 수 |
| `successCount` | number | 성공 수 |
| `failCount` | number | 실패 수 |

**트리거 위치:**
- `POST /api/admin/campaigns/[id]/send` - 캠페인 발송 시

---

### 메시지 (Message) 이벤트

#### onMessageReceived

메시지가 수신될 때 발동 (카카오톡 등)

| 필드 | 타입 | 설명 |
|------|------|------|
| `messageId` | string | 메시지 ID |
| `channelId` | string | 채널 ID |
| `senderId` | string | 발신자 ID |
| `content` | string | 메시지 내용 |

**트리거 위치:** 메시지 수신 웹훅에서 호출 필요

---

#### onMessageSent

메시지가 발송될 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `messageId` | string | 메시지 ID |
| `channelId` | string | 채널 ID |
| `recipientId` | string | 수신자 ID |
| `content` | string | 메시지 내용 |
| `type` | string | 메시지 유형 |

**트리거 위치:** 메시지 발송 로직에서 호출 필요

---

### 문서 (Document) 이벤트

#### onConsentSigned

동의서가 서명될 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `consentId` | string | 동의 ID |
| `patientId` | string | 환자 ID |
| `consentType` | string | 동의 유형 |
| `ipAddress` | string | IP 주소 |

**트리거 위치:** 동의서 서명 로직에서 호출 필요

---

#### onIntakeSubmitted

문진표가 제출될 때 발동

| 필드 | 타입 | 설명 |
|------|------|------|
| `intakeId` | string | 문진표 ID |
| `patientId` | string | 환자 ID |
| `intakeType` | string | 유형 (general, remote, remote_integrated) |
| `isNewPatient` | boolean | 신규 환자 여부 |
| `visitCategory` | string | 방문 목적 |
| `mainSymptom` | string | 주요 증상 |

**트리거 위치:**
- `POST /api/intake/submit` - 문진표 제출 시

---

## SDK API

플러그인에서 코어 데이터에 접근할 때 사용하는 API입니다.

### 초기화

```typescript
import { createPluginSDK } from '@clinic-os/plugin-sdk';

export async function GET({ locals }) {
  const sdk = createPluginSDK(db, context);
  // SDK 사용
}
```

---

### sdk.patients

환자 데이터 접근 API

#### list(options)

환자 목록 조회

```typescript
const patients = await sdk.patients.list({
  status: 'active',    // 선택: 상태 필터
  limit: 50,           // 선택: 조회 수 (기본 50)
  offset: 0            // 선택: 시작 위치
});
```

**필요 권한:** `read:patients`

---

#### get(id)

환자 단일 조회

```typescript
const patient = await sdk.patients.get('patient-uuid');
```

**필요 권한:** `read:patients`

---

#### search(query)

환자 검색

```typescript
const results = await sdk.patients.search('홍길동');
```

**필요 권한:** `read:patients`

---

### sdk.payments

결제 데이터 접근 API

#### getByPatient(patientId)

환자별 결제 내역 조회

```typescript
const payments = await sdk.payments.getByPatient('patient-uuid');
```

**필요 권한:** `read:payments`

---

#### getTotalAmount(patientId)

환자 총 결제액 조회

```typescript
const total = await sdk.payments.getTotalAmount('patient-uuid');
// { total: 1500000, count: 5 }
```

**필요 권한:** `read:payments`

---

### sdk.reservations

예약 데이터 접근 API

#### getToday()

오늘 예약 목록 조회

```typescript
const reservations = await sdk.reservations.getToday();
```

**필요 권한:** `read:reservations`

---

#### getByPatient(patientId)

환자별 예약 내역 조회

```typescript
const reservations = await sdk.reservations.getByPatient('patient-uuid');
```

**필요 권한:** `read:reservations`

---

### sdk.database

커스텀 테이블 직접 접근 API

#### query(sql, params)

SELECT 쿼리 실행

```typescript
const members = await sdk.database.query(
  'SELECT * FROM custom_vip_members WHERE tier = ?',
  ['gold']
);
```

**필요 권한:** `database:read`

---

#### execute(sql, params)

INSERT/UPDATE/DELETE 쿼리 실행

```typescript
await sdk.database.execute(
  'INSERT INTO custom_vip_members (id, patient_id, tier) VALUES (?, ?, ?)',
  [id, patientId, 'silver']
);
```

**필요 권한:** `database:write`

---

### sdk.settings

플러그인 설정 접근 API

#### get(key)

설정 값 조회

```typescript
const apiKey = await sdk.settings.get('external_api_key');
```

---

#### set(key, value)

설정 값 저장

```typescript
await sdk.settings.set('notification_enabled', 'true');
```

---

## 권한 (Permissions)

manifest.json에 선언해야 사용 가능한 권한 목록

| 권한 | 설명 | 관련 API |
|------|------|----------|
| `read:patients` | 환자 정보 읽기 | sdk.patients.* |
| `write:patients` | 환자 정보 수정 | - |
| `read:payments` | 결제 정보 읽기 | sdk.payments.* |
| `read:reservations` | 예약 정보 읽기 | sdk.reservations.* |
| `database:read` | 커스텀 테이블 조회 | sdk.database.query |
| `database:write` | 커스텀 테이블 수정 | sdk.database.execute |

---

## 훅 핸들러 구현 예시

### VIP 포인트 자동 적립

```typescript
// src/plugins/vip-management/lib/hooks.ts

import type { HookContext } from '@clinic-os/plugin-sdk';

export async function handlePayment(context: HookContext) {
  const { patientId, amount } = context.data;

  // 1% 포인트 적립
  const points = Math.floor(amount * 0.01);

  // 기존 회원 확인
  const member = await context.db.prepare(
    'SELECT * FROM custom_vip_members WHERE patient_id = ?'
  ).bind(patientId).first();

  if (member) {
    // 포인트 추가
    await context.db.prepare(
      'UPDATE custom_vip_members SET points = points + ? WHERE patient_id = ?'
    ).bind(points, patientId).run();
  } else {
    // 신규 회원 생성
    await context.db.prepare(
      'INSERT INTO custom_vip_members (id, patient_id, points) VALUES (?, ?, ?)'
    ).bind(crypto.randomUUID(), patientId, points).run();
  }

  // 포인트 히스토리 기록
  await context.db.prepare(
    'INSERT INTO custom_vip_point_history (id, patient_id, type, amount, description) VALUES (?, ?, ?, ?, ?)'
  ).bind(
    crypto.randomUUID(),
    patientId,
    'earn',
    points,
    `결제 적립 (${amount.toLocaleString()}원)`
  ).run();
}
```

### 예약 알림 발송

```typescript
export async function handleReservationCreated(context: HookContext) {
  const { patientId, reservedAt, doctorId } = context.data;

  // 예약 알림 로직
  // ...
}
```

---

## 버전 히스토리

| 버전 | 날짜 | 변경 사항 |
|------|------|----------|
| 1.0.0 | 2025-01-18 | 최초 작성 |
