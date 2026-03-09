# Clinic-OS 플러그인 개발 가이드

> 이 문서는 로컬 클리닉 설치본에서 에이전트가 플러그인을 안전하게 만들고, 테스트하고, HQ 스토어에 제출하는 흐름을 기준으로 작성되었습니다.

## 1. 언제 플러그인을 써야 하나

Clinic-OS 커스터마이징은 크게 둘로 나뉩니다.

| 목적 | 방법 | 위치 |
|------|------|------|
| 기존 코어 페이지 수정 | 페이지 오버라이드 | `src/pages/_local/...` |
| 새 기능, 새 경로, 새 API, 새 관리 화면 추가 | 플러그인 | `src/plugins/local/{plugin-id}/` |

### `_local/` 이 맞는 경우

- 기존 소개 페이지 레이아웃 수정
- 기존 퍼블릭 페이지 문구/섹션 수정
- 코어 페이지를 그대로 복사해서 일부만 바꾸는 경우

### 플러그인이 맞는 경우

- 완전히 새로운 기능 추가
- `/ext/{pluginId}` 기반 공개 경로 추가
- `/admin/hub/{pluginId}` 기반 관리자 화면 추가
- 플러그인 전용 API 추가
- 플러그인 전용 `custom_` 테이블 사용

## 2. Agent-First 플로우

로컬 클리닉에서는 사용자가 구조를 외우기보다 에이전트가 아래 순서로 진행하는 것이 맞습니다.

1. 요청 분류
2. `_local/` 과 플러그인 중 어느 방식이 맞는지 결정
3. `npm run plugin:create -- --id={plugin-id} --dry-run --json` 으로 스캐폴드 계획 확인
4. 실제 생성 후 `manifest.json`, `README.md`, `pages/`, 필요 시 `api/`, `lib/`, `migrations/` 작성
5. 로컬 빌드/테스트
6. 필요 시 HQ 제출
7. 설치/리빌드/활성화 검증

권장 시작 명령:

```bash
npm run plugin:create -- --id=my-plugin --type=new-route --with-admin --dry-run --json
```

## 3. 플러그인 디렉토리 구조

표준 구조는 아래를 기준으로 하세요. 기본 스캐폴드는 `npm run plugin:create` 가 이 구조를 생성합니다.

```text
src/plugins/local/my-plugin/
├── manifest.json
├── README.md
├── pages/
│   ├── index.astro
│   └── manage.astro
├── api/
│   └── stats.ts
├── lib/
│   └── hooks.ts
└── migrations/
    ├── 0001_create_tables.sql
    └── 0001_create_tables.rollback.sql
```

필수 파일:

- `manifest.json`
- `README.md`
- `pages/` 내 최소 1개 Astro 페이지

선택 파일:

- `api/`
- `lib/`
- `migrations/`
- `components/`

## 4. 런타임 기준 manifest 계약

현재 런타임에서 가장 중요한 소스 오브 트루스는 `src/lib/plugin-loader.ts` 입니다.
즉, 플러그인 shape는 문서보다 실제 loader 기준으로 맞추는 편이 안전합니다.

기본 예시:

```json
{
  "id": "vip-lounge",
  "name": "VIP 라운지",
  "description": "VIP 환자 관리 기능",
  "version": "1.0.0",
  "author": "Local Clinic",
  "type": "new-route",
  "category": "utility",
  "permissions": ["read:patients", "database:write"],
  "routes": {
    "base": "/ext/vip-lounge",
    "public": [
      { "path": "/", "file": "pages/index.astro", "title": "VIP 라운지" }
    ]
  },
  "pages": [
    { "path": "manage", "title": "관리", "description": "VIP 설정" }
  ],
  "apis": [
    { "path": "stats", "methods": ["GET"], "description": "통계 조회" }
  ],
  "hooks": [
    { "event": "onPaymentCompleted", "handler": "handlePaymentCompleted" }
  ],
  "tables": ["custom_vip_lounge_members"],
  "documentation": {
    "summary": "VIP 환자 관리 플러그인입니다.",
    "features": ["VIP 회원 목록", "포인트 적립"],
    "requirements": ["로컬 테스트 후 제출"],
    "howToEdit": "src/plugins/local/vip-lounge 안에서 수정",
    "category": "utility"
  }
}
```

### 필드 메모

- `id`: 폴더명과 같아야 함
- `type`: 권장값은 `new-route`, `override`, `admin-page`
- `routes.base`: 공개 경로 기준
- `pages`: `/admin/hub/{pluginId}/{page.path}` 탭에 노출
- `apis`: `/api/hub/{pluginId}/{api.path}` 또는 `/api/plugins/run/{pluginId}/{api.path}` 라우팅 기준
- `hooks`: 현재 런타임 기준으로 `event` 키를 사용

현재 validator는 runtime 계약을 더 많이 반영하지만, 최종 기준은 여전히 실제 loader/install 라우트입니다.

## 5. 라우팅 규칙

### 공개 페이지

- URL: `/ext/{pluginId}`
- 처리 파일: `pages/index.astro`, `pages/...`
- 라우터: `src/pages/ext/[...path].astro`

### 관리자 페이지

- URL: `/admin/hub/{pluginId}`
- 추가 탭: `manifest.pages`
- 라우터: `src/pages/admin/hub/[...path].astro`

### 플러그인 API

- URL 1: `/api/hub/{pluginId}/{path}`
- URL 2: `/api/plugins/run/{pluginId}/{path}`
- 처리 파일: `src/plugins/local/{pluginId}/api/*.ts`

현재 구현에서는 페이지와 API 라우트 모두 disabled 상태를 확인합니다. 다만 플러그인 내부에서 외부 API 호출이나 쓰기 작업을 할 때는 자체 방어 로직을 추가하는 편이 안전합니다.

## 6. SDK 사용법

### import 경로

로컬 플러그인은 현재 앱 내부 소스로 동작합니다. 따라서 `@clinic-os/plugin-sdk` alias를 바로 쓰면 안 됩니다.

#### API 파일 예시

`src/plugins/local/my-plugin/api/stats.ts`

```ts
import type { APIRoute } from 'astro';
import { createSDKFromContext } from '../../../../lib/plugin-sdk';

export const GET: APIRoute = async ({ locals, plugin }) => {
  const sdk = createSDKFromContext(locals, plugin.id);
  const rows = await sdk.db.query(
    'SELECT * FROM custom_my_plugin_stats ORDER BY created_at DESC LIMIT 20'
  );

  return new Response(JSON.stringify({ success: true, data: rows }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
```

#### lib/hooks.ts 예시

`src/plugins/local/my-plugin/lib/hooks.ts`

```ts
import { createSDK } from '../../../../lib/plugin-sdk';

export async function handlePaymentCompleted(context: {
  db: D1Database;
  pluginId: string;
  data: { patientId: string; amount: number };
}) {
  const sdk = createSDK({
    db: context.db,
    pluginId: context.pluginId,
  });

  await sdk.db.execute(
    'INSERT INTO custom_my_plugin_events (id, patient_id, amount) VALUES (?, ?, ?)',
    [crypto.randomUUID(), context.data.patientId, context.data.amount]
  );
}
```

### 현재 제공되는 주요 SDK surface

- `sdk.patients`
- `sdk.reservations`
- `sdk.payments`
- `sdk.products`
- `sdk.programs`
- `sdk.promotions`
- `sdk.patientEvents`
- `sdk.leads`
- `sdk.staff`
- `sdk.schedules`
- `sdk.messages`
- `sdk.campaigns`
- `sdk.segments`
- `sdk.shipping`
- `sdk.tasks`
- `sdk.settings`
- `sdk.storage`
- `sdk.db`
- `sdk.migrations`

자세한 내용은 [PLUGIN_API_REFERENCE.md](./PLUGIN_API_REFERENCE.md) 를 보세요.

## 7. 데이터와 스키마 규칙

### 읽기

`sdk.db.query()` 와 `sdk.db.first()` 는 현재 구현상 모든 테이블 읽기가 가능합니다.

### 쓰기

`sdk.db.execute()` 는 아래에만 쓰기가 허용됩니다.

- `custom_*`
- `plugin_storage`

### 스키마 변경

스키마가 필요하면 두 방식 중 하나만 사용하세요.

1. `src/plugins/local/{pluginId}/migrations/*.sql`
2. `sdk.migrations.runMigration()`

둘 다 공통 원칙은 같습니다.

- `custom_` 접두사 테이블만 생성/수정
- 루트 `migrations/` 폴더는 건드리지 않음
- 코어 테이블 `ALTER TABLE` 금지

권장 테이블명:

```sql
custom_{plugin_id}_{entity}
```

예:

```sql
CREATE TABLE custom_vip_lounge_members (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);
```

## 8. 로컬 개발 순서

1. `npm run plugin:create -- --id={plugin-id} --dry-run --json` 으로 계획 검토
2. 필요하면 `--with-api`, `--with-hooks`, `--with-migration` 옵션을 조정해 실제 생성
3. `manifest.json` 작성
4. 페이지/API/DB 코드 작성
5. 필요 시 `migrations/` 추가
6. `npm run build`
7. `/ext/{pluginId}` 와 `/admin/hub/{pluginId}` 확인
8. 필요 시 `/api/plugins/migrate` 또는 관리 UI에서 마이그레이션 실행

## 9. HQ 스토어 제출

현재 구현 기준 로컬 제출 조건은 아래와 같습니다.

- 관리자 세션 필요
- dev 모드 필요
- `clinic.json` 의 라이선스가 유효해야 함
- 제출 대상은 `src/plugins/local/{pluginId}`

제출 흐름:

1. 로컬 플러그인 스캔
2. `manifest.json` 기본 검증
3. zip 패키징
4. SHA-256 생성
5. HQ `/api/plugins/submit` 전송

현재 HQ 구현상 첫 제출 때 developer 레코드가 자동 생성될 수 있습니다. 다만 개발자 신청/심사 정책과 완전히 정렬되어 있지는 않으므로, 운영 정책은 HQ 쪽 기준을 함께 확인해야 합니다.

## 10. HQ 스토어 설치

설치 흐름은 현재 코드 기준으로 아래와 같습니다.

1. HQ에서 메타데이터 조회
2. 권한 분석
3. dev 모드면 `src/plugins/local/{pluginId}` 에 패키지 추출
4. `installed_pending_rebuild` 상태 기록
5. 리빌드 후 활성화

중요한 점:

- `import.meta.glob` 기반이라 파일만 복사해도 바로 보이지 않을 수 있습니다
- 설치 후 리빌드가 필요합니다
- 에이전트는 사용자에게 `Ctrl+C` 같은 수동 지시를 하기보다 리빌드 API 또는 관리 화면의 rebuild 흐름을 사용해야 합니다

## 11. 현재 구현의 주의점

에이전트가 문서만 믿고 작업하면 틀릴 수 있는 부분입니다.

- 공식 스캐폴드 명령은 `npm run plugin:create` 이다
- manifest validator와 runtime loader 계약이 완전히 같지 않음
- `@clinic-os/plugin-sdk` alias는 현재 스타터킷에 기본 설정되어 있지 않음
- HQ marketplace 스키마와 서버 코드가 일부 어긋난 구간이 있음
- disabled 플러그인 API 방어가 페이지 라우트보다 약함

따라서 에이전트는 아래 순서로 판단하는 편이 안전합니다.

1. `docs/PLUGIN_DEVELOPMENT_GUIDE.md`
2. `docs/PLUGIN_API_REFERENCE.md`
3. `src/lib/plugin-loader.ts`
4. `src/pages/api/plugins/*.ts`
5. `hq/src/index.js` 와 `hq/migrations/0014_plugin_marketplace.sql`

## 12. 체크리스트

- [ ] `_local/` 이 아니라 플러그인이 필요한 작업인가
- [ ] `src/plugins/local/{pluginId}` 에서만 작업했는가
- [ ] `manifest.json` 과 폴더명이 일치하는가
- [ ] SDK import 경로가 실제 스타터킷 구조와 맞는가
- [ ] 코어 테이블을 수정하지 않았는가
- [ ] `custom_` 테이블만 쓰는가
- [ ] 빌드와 관리자/퍼블릭 라우트가 모두 확인됐는가
- [ ] 제출 전 README 와 documentation 필드를 채웠는가

## 다음 문서

- [플러그인 API 레퍼런스](./PLUGIN_API_REFERENCE.md)
- [커스터마이징 가이드](./CUSTOMIZATION_GUIDE.md)
- [안전한 작업 흐름](./WORKFLOW_GUIDE.md)
