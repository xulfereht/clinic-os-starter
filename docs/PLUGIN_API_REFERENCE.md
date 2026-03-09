# Plugin API Reference

이 문서는 현재 Clinic-OS 플러그인 런타임 기준의 간단한 레퍼런스입니다.

가장 중요한 점은 두 가지입니다.

1. 로컬 플러그인은 앱 내부 소스로 동작하므로 import 경로를 실제 폴더 구조에 맞춰야 합니다.
2. 데이터 쓰기와 스키마 변경은 `custom_` 범위 안에서만 해야 합니다.

## 1. 소스 오브 트루스

플러그인 관련 문맥을 읽을 때 우선순위는 아래가 안전합니다.

1. `src/lib/plugin-loader.ts`
2. `src/pages/api/plugins/install.ts`
3. `src/pages/api/plugins/submit.ts`
4. `src/pages/api/plugins/migrate.ts`
5. `src/lib/plugin-sdk/index.ts`
6. `src/lib/plugin-sdk/api/*.ts`

## 1.5. 플러그인 스캐폴드

새 로컬 플러그인은 보통 아래처럼 시작하는 것이 가장 안전합니다.

```bash
npm run plugin:create -- --id=my-plugin --type=new-route --with-admin --dry-run --json
```

실제 생성:

```bash
npm run plugin:create -- --id=my-plugin --type=new-route --with-admin --with-api
```

## 2. SDK 초기화

### API 핸들러 안에서

```ts
import type { APIRoute } from 'astro';
import { createSDKFromContext } from '../../../../lib/plugin-sdk';

export const GET: APIRoute = async ({ locals, plugin }) => {
  const sdk = createSDKFromContext(locals, plugin.id);
  const rows = await sdk.db.query('SELECT * FROM custom_my_plugin_table');

  return new Response(JSON.stringify(rows), {
    headers: { 'Content-Type': 'application/json' }
  });
};
```

### 일반 서버 코드 안에서

```ts
import { createSDK } from '../../../../lib/plugin-sdk';

const sdk = createSDK({
  db,
  pluginId: 'my-plugin',
  user: null,
  permissions: ['read:patients']
});
```

> 주의: `@clinic-os/plugin-sdk` alias는 현재 스타터킷에 기본 설정되어 있지 않습니다.

## 3. 현재 SDK namespace

`createSDK()` 가 반환하는 주요 API:

- `patients`
- `reservations`
- `payments`
- `products`
- `programs`
- `promotions`
- `patientEvents`
- `leads`
- `staff`
- `schedules`
- `messages`
- `campaigns`
- `segments`
- `shipping`
- `tasks`
- `settings`
- `storage`
- `db`
- `migrations`

## 4. 데이터 접근 규칙

### 읽기

현재 구현상 `sdk.db.query()` 와 `sdk.db.first()` 는 모든 테이블 읽기를 허용합니다.

```ts
const patients = await sdk.db.query(
  'SELECT id, name, current_phone FROM patients ORDER BY created_at DESC LIMIT 20'
);
```

### 쓰기

`sdk.db.execute()` 는 아래 대상만 허용됩니다.

- `custom_*`
- `plugin_storage`

```ts
await sdk.db.execute(
  'INSERT INTO custom_my_plugin_logs (id, message) VALUES (?, ?)',
  [crypto.randomUUID(), 'created']
);
```

금지 예:

```ts
await sdk.db.execute(
  'UPDATE patients SET notes = ? WHERE id = ?',
  ['test', patientId]
);
```

## 5. 스키마 변경 규칙

### migrations 폴더 사용

```text
src/plugins/local/my-plugin/migrations/
├── 0001_create_tables.sql
└── 0001_create_tables.rollback.sql
```

실행은 설치 후 관리자 UI 또는 `/api/plugins/migrate` 경로를 사용합니다.

### SDK migrations 사용

```ts
await sdk.migrations.runMigration(
  `
  CREATE TABLE IF NOT EXISTS custom_my_plugin_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL
  )
  `,
  'create_items_table',
  {
    rollbackSql: 'DROP TABLE IF EXISTS custom_my_plugin_items'
  }
);
```

허용 원칙:

- `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, `DELETE`
- 단, 대상은 `custom_` 범위여야 함
- 내부 추적용 `plugin_migrations` 는 예외 허용

## 6. manifest 훅 형식

현재 런타임 loader 기준 manifest 훅은 보통 아래처럼 작성합니다.

```json
{
  "hooks": [
    { "event": "onPaymentCompleted", "handler": "handlePaymentCompleted" }
  ]
}
```

validator도 `event` 와 레거시 `type` 둘 다 읽도록 맞춰졌지만, 실제 plugin loader 문맥에서는 `event` 형식을 기준으로 생각하는 편이 안전합니다.

## 7. 권장 훅 이름

현재 코드 기준으로 자주 쓰이는 이벤트 이름:

- `onReservationCreated`
- `onReservationUpdated`
- `onReservationCancelled`
- `onPatientCreated`
- `onPatientUpdated`
- `onPatientCheckedIn`
- `onPaymentCompleted`
- `onPaymentRefunded`
- `onLeadCreated`
- `onLeadConverted`
- `onCampaignSent`
- `onDailySchedule`
- `onWeeklyReport`

## 8. API 라우팅 규칙

manifest:

```json
{
  "apis": [
    { "path": "stats", "methods": ["GET"] }
  ]
}
```

구현 파일:

```text
src/plugins/local/my-plugin/api/stats.ts
```

호출 경로:

- `/api/hub/my-plugin/stats`
- `/api/plugins/run/my-plugin/stats`

## 9. 관리자/공개 페이지 규칙

### 공개 페이지

- 경로: `/ext/{pluginId}`
- 파일: `pages/index.astro`

### 관리자 페이지

manifest:

```json
{
  "pages": [
    { "path": "manage", "title": "관리" }
  ]
}
```

파일:

```text
src/plugins/local/my-plugin/pages/manage.astro
```

경로:

- `/admin/hub/my-plugin/manage`

## 10. 응답 형식 권장

```ts
return new Response(JSON.stringify({
  success: true,
  data: result
}), {
  headers: { 'Content-Type': 'application/json' }
});
```

에러:

```ts
return new Response(JSON.stringify({
  success: false,
  error: 'message'
}), {
  status: 400,
  headers: { 'Content-Type': 'application/json' }
});
```

## 11. 주의할 점

- 코어 테이블 `ALTER TABLE` 금지
- 루트 `migrations/` 폴더 수정 금지
- `@clinic-os/plugin-sdk` import 금지
- 설치 후 자동 리빌드가 돌 수 있지만, 실패하면 rebuild 상태를 먼저 확인
- disabled 플러그인 API 차단은 현재 일부 경로에서 약하므로 플러그인 내부 방어도 권장

## 12. 함께 읽을 문서

- [플러그인 개발 가이드](./PLUGIN_DEVELOPMENT_GUIDE.md)
- [안전한 작업 흐름](./WORKFLOW_GUIDE.md)
