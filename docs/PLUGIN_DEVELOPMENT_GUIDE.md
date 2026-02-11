# Clinic-OS 플러그인 개발 가이드

> 플러그인을 만들거나 수정할 때 따라야 하는 규칙입니다.

---

## 핵심 원칙: 코어 수정 없는 플러그인

**플러그인 추가 시 `src/pages/` 등 코어 코드를 수정하면 안 됩니다.**

Astro는 `src/pages/` 내 파일만 라우팅하지만, Clinic-OS는 2-Track 아키텍처로 이 제약을 해결합니다:
- 플러그인은 `src/plugins/{plugin-id}/` 에 위치
- 코어의 Universal Router가 플러그인 페이지를 자동 라우팅
- manifest.json만 있으면 자동 인식 (installed.json 불필요)

---

## 2-Track 플러그인 아키텍처

### Track 1: New Route 플러그인 (새 경로 추가)

**용도**: `/ext/{pluginId}/*` 경로로 새로운 페이지 추가

```json
{
  "id": "survey-tools",
  "type": "new-route",
  "routes": {
    "base": "/ext/survey-tools",
    "public": [
      { "path": "/", "file": "pages/index.astro", "title": "검사도구 목록" },
      { "path": "/:toolId", "file": "pages/[...tool].astro", "title": "검사 실행" }
    ]
  }
}
```

**라우팅 동작**:
- `/ext/survey-tools` → `plugins/survey-tools/pages/index.astro`
- `/ext/survey-tools/stress-check` → `plugins/survey-tools/pages/[...tool].astro`

**Universal Router**: `src/pages/ext/[...path].astro`가 모든 `/ext/*` 요청을 처리

### Track 2: Override 플러그인 (기존 경로 대체)

**용도**: 코어가 제공하는 Override Point를 대체 (예: 홈페이지)

```json
{
  "id": "custom-homepage",
  "type": "override",
  "overrides": [
    {
      "path": "/",
      "file": "pages/index.astro",
      "priority": 10,
      "description": "홈페이지 대체"
    }
  ]
}
```

**Override Points (코어 제공)**:
- `/` - 메인 홈페이지

**주의**: Override는 코어가 명시적으로 제공하는 포인트에서만 작동합니다. 임의 경로 대체 불가.

---

## 플러그인 구조

### 타입별 필수 파일

| 파일/디렉토리 | new-route | override | 설명 |
|---------------|-----------|----------|------|
| `manifest.json` | **필수** | **필수** | 플러그인 메타정보 |
| `README.md` | **필수** | **필수** | 사용 설명서 |
| `pages/` | **필수** | **필수** | Astro 페이지 (최소 1개) |
| `api/` | 선택 | - | API 엔드포인트 |
| `components/` | 선택 | 선택 | UI 컴포넌트 |
| `lib/` | 선택 | 선택 | 비즈니스 로직/유틸리티 |
| `migrations/` | 선택 | 선택 | DB 마이그레이션 (순차 번호) |
| `migration.sql` | 선택 | 선택 | DB 마이그레이션 (단일 파일) |

> **참고**: `main.js`는 필수가 아닙니다. 모든 플러그인 타입은 Astro 페이지 기반(`pages/`)으로 동작합니다.

### 전체 디렉토리 구조

```
src/plugins/{plugin-id}/
├── manifest.json       # 필수: 플러그인 메타정보 (type 필드 포함)
├── README.md           # 필수: 사용 설명서
├── pages/              # 필수: Astro 페이지 (라우팅 대상)
│   ├── index.astro     # /ext/{plugin-id}/ 또는 Override 대상
│   └── [...path].astro # Catch-all 라우트
├── api/                # 선택: API 엔드포인트
├── components/         # 선택: UI 컴포넌트
├── migrations/         # 선택: DB 마이그레이션 파일
│   ├── 0001_create_tables.sql
│   ├── 0001_create_tables.rollback.sql  # 롤백 SQL (선택)
│   └── 0002_add_indexes.sql
├── migration.sql       # 선택: DB 스키마 (단일 파일, migrations/ 대안)
└── lib/                # 선택: 비즈니스 로직
    └── hooks.ts        # 이벤트 훅 핸들러
```

---

## manifest.json 스키마

### 공통 필드 (필수)

```json
{
  "id": "plugin-id",           // 고유 ID (폴더명과 일치)
  "name": "플러그인 이름",      // UI 표시 이름
  "description": "설명",        // 간단한 설명
  "version": "1.0.0",          // 시맨틱 버전
  "author": "작성자",
  "type": "new-route",         // "new-route" | "override"
  "category": "utility"        // core|marketing|integration|customization|analytics|utility
}
```

### New Route 전용 필드

```json
{
  "routes": {
    "base": "/ext/my-plugin",  // 기본 경로 (필수)
    "public": [                // 공개 라우트
      { "path": "/", "file": "pages/index.astro", "title": "메인" },
      { "path": "/:id", "file": "pages/[id].astro", "title": "상세" }
    ],
    "admin": "pages/admin/",   // 어드민 라우트 디렉토리 (선택)
    "api": "api/"              // API 라우트 디렉토리 (선택)
  }
}
```

### Override 전용 필드

```json
{
  "overrides": [
    {
      "path": "/",                    // 대체할 경로
      "file": "pages/index.astro",    // 플러그인 내 파일
      "priority": 10,                 // 우선순위 (높을수록 우선)
      "description": "홈페이지 대체"
    }
  ]
}
```

### 문서화 필드 (HQ 제출 시 필수)

```json
{
  "documentation": {
    "summary": "플러그인 요약 (최소 10자, 2-3문장 권장)",
    "features": ["기능1", "기능2"],       // 최소 1개 필수
    "requirements": ["필요 조건"],         // 선택
    "howToEdit": "수정 방법 안내",         // 선택
    "category": "integration"             // 선택: core|marketing|integration|customization|analytics|utility|communication|automation|ui
  },
```

> **HQ 제출 시**: `documentation.summary` (최소 10자)와 `documentation.features` (최소 1개) 는 필수입니다. 누락 시 검증 실패합니다.

### 선택 필드

```json
{
  "permissions": ["database:read", "database:write"],
  "pages": [                     // 어드민 허브에 표시
    { "path": "manage", "title": "관리 페이지" }
  ],
  "apis": [
    { "path": "data", "methods": ["GET", "POST"], "description": "데이터 API" }
  ],
  "hooks": [
    { "event": "onPatientCreated", "handler": "handlePatientCreated" }
  ],
  "migration": "migration.sql",    // DB 마이그레이션 파일 (레거시, 단일 파일)
  // 또는 migrations/ 디렉토리 사용 권장 (순차 실행, 롤백 지원)
  "tables": ["custom_my_table"],   // 생성되는 테이블 목록
  "settings": {
    "option1": { "type": "string", "label": "옵션1", "default": "value" }
  }
}
```

---

## 플러그인 페이지 작성

### Props (Universal Router가 전달)

```typescript
// pages/index.astro
---
interface Props {
  settings: ClinicSettings;      // 클리닉 설정
  db: D1Database;                // 데이터베이스
  pluginId: string;              // 플러그인 ID
  path: string;                  // 남은 경로 (예: "stress-check")
  url: URL;                      // 전체 URL
  request: Request;              // 요청 객체
  plugin: PluginManifest;        // 플러그인 매니페스트
}

const { settings, db, pluginId, path, plugin } = Astro.props;
---

<BaseLayout title="My Plugin">
  <h1>{plugin.name}</h1>
  <!-- 플러그인 콘텐츠 -->
</BaseLayout>
```

### Catch-all 패턴

```typescript
// pages/[...tool].astro
---
const { path } = Astro.props;
const segments = path.split('/');
const toolId = segments[0];
const action = segments[1]; // 'result' 등

// toolId에 따른 처리
---
```

---

## 플러그인 설치 과정

### 방법 1: HQ 마켓플레이스에서 설치 (권장)
1. Admin UI → Plugin Store 페이지 접속
2. 원하는 플러그인의 "Install" 버튼 클릭
3. 권한 승인 (위험한 권한이 있는 경우)
4. 자동 다운로드 → SHA-256 검증 → `src/plugins/local/{id}/`에 추출
5. "Rebuild" 버튼 클릭 → Astro 리빌드 → 플러그인 활성화

> **참고**: HQ에서 설치한 플러그인은 `src/plugins/local/` 디렉토리에 추출됩니다. `import.meta.glob`이 빌드 타임에 플러그인을 인식하므로, 파일 추출 후 반드시 리빌드가 필요합니다.

### 방법 2: 직접 개발 (로컬)
1. `src/plugins/local/` 폴더에 플러그인 디렉토리 생성
2. `manifest.json` 파일 작성
3. 페이지/API/컴포넌트 추가
4. `bun run dev` 또는 `bun run build`로 반영

플러그인은 `import.meta.glob('../plugins/*/manifest.json')`으로 빌드 타임에 자동 인식됩니다.

---

## DB 마이그레이션

플러그인이 DB 스키마를 필요로 하는 경우, `migrations/` 디렉토리에 SQL 파일을 추가합니다.

### 파일 명명 규칙
```
migrations/
├── 0001_create_tables.sql          # 순차 번호_설명.sql
├── 0001_create_tables.rollback.sql # 롤백 파일 (선택)
├── 0002_add_indexes.sql
└── 0002_add_indexes.rollback.sql
```

- 파일명은 `NNNN_description.sql` 형식 (알파벳순 = 실행순)
- `.rollback.sql` 파일이 있으면 자동으로 롤백 SQL로 저장됨
- 이미 적용된 마이그레이션은 자동 스킵

### 마이그레이션 실행
설치 후 Admin UI에서 "Run Migrations" 버튼으로 실행하거나:
```
POST /api/plugins/migrate
body: { "pluginId": "my-plugin" }
```

### 테이블명 규칙 (기존 규칙 유지)
```sql
-- custom_ 접두사 필수
CREATE TABLE custom_my_table (...);
```

---

## HQ 마켓플레이스 제출

로컬에서 개발한 플러그인을 HQ 마켓플레이스에 제출할 수 있습니다.

### 제출 조건
- 유효한 `manifest.json` 필수 (validateManifest 통과)
- `manifest.json`에 `type` 필드 필수 (`"new-route"` 또는 `"override"`)
- `documentation` 필드 필수: `summary` (최소 10자), `features` (최소 1개 배열)
- `pages/` 디렉토리 필수 (new-route, override 모두)
- 클리닉 라이선스 키 등록 필수
- 개발자 등록 완료 필수
- Dev 모드에서만 동작
- 보안 스캔 통과: `eval()`, `new Function()`, `document.write`, `localStorage` 직접 접근 금지

### 제출 방법
1. Admin UI → Plugins → "로컬 플러그인" 탭
2. 제출할 플러그인의 "HQ에 제출" 버튼 클릭
3. manifest 미리보기 확인 후 제출

또는 API 직접 호출:
```
POST /api/plugins/submit
body: { "pluginId": "my-plugin" }
```

자동으로 zip 패키징 → SHA-256 생성 → HQ API 전송이 진행됩니다.

---

## 로컬 오버라이드 (Local Override)

**문제**: 클라이언트가 코어 플러그인(예: custom-homepage)을 커스터마이징한 후 `core:pull`하면 변경사항이 덮어씌워짐.

**해결책**: `src/plugins/local/` 폴더 사용

### 폴더 구조

```
src/plugins/
├── custom-homepage/           ← 코어 제공 (core:pull 시 업데이트됨)
├── survey-tools/              ← 코어 제공
└── local/                     ← 클라이언트 전용 (gitignore, 보호됨)
    └── custom-homepage/       ← 로컬 오버라이드 (우선순위 높음)
```

### 동작 방식

1. **로컬 우선**: `src/plugins/local/custom-homepage/`가 있으면 이것 사용
2. **코어 폴백**: 없으면 `src/plugins/custom-homepage/` 사용
3. **보호됨**: `local/` 폴더는 `.gitignore`에 포함되어 `core:pull`에 영향 안 받음

### 커스터마이징 방법

```bash
# 1. 코어 플러그인을 local 폴더로 복사
cp -r src/plugins/custom-homepage src/plugins/local/custom-homepage

# 2. local 버전 수정
# src/plugins/local/custom-homepage/pages/index.astro 편집

# 3. 끝! 빌드 시 자동으로 local 버전 사용
npm run dev
```

### 검사도구도 동일

```
src/survey-tools/
├── stress-check/              ← 코어 제공 (샘플)
└── local/                     ← 클라이언트 전용 (보호됨)
    └── stress-check/          ← 로컬 오버라이드
    └── my-custom-tool/        ← 새 검사도구
```

---

## 필수 규칙 (MUST)

### 1. 테이블명 규칙
```sql
-- ✅ GOOD: custom_ 접두사 필수
CREATE TABLE custom_vip_members (...);
CREATE TABLE custom_loyalty_points (...);

-- ❌ BAD: 접두사 없음
CREATE TABLE vip_members (...);
CREATE TABLE my_table (...);
```

### 2. 코어 데이터는 SDK로만 접근
```typescript
// ✅ GOOD: SDK API 사용
const patient = await sdk.patients.get(patientId);
const payments = await sdk.payments.getByPatient(patientId);

// ❌ BAD: 코어 테이블 직접 쿼리
await db.prepare('SELECT * FROM patients WHERE id = ?').bind(id).first();
```

### 3. 커스텀 테이블은 직접 쿼리 OK
```typescript
// ✅ GOOD: custom_ 테이블은 직접 접근 가능
await sdk.database.query(
  'SELECT * FROM custom_vip_members WHERE tier = ?',
  ['gold']
);
```

### 4. 플러그인 ID는 폴더명과 일치
```
src/plugins/survey-tools/
└── manifest.json → "id": "survey-tools"
```

---

## 금지 규칙 (NEVER)

### 1. 코어 파일 수정 금지
```
❌ src/pages/ 에 파일 추가
❌ src/lib/ 의 코어 로직 수정
❌ src/components/layout/ 수정
```

### 2. 코어 테이블 수정 금지
```sql
-- ❌ NEVER
ALTER TABLE patients ADD COLUMN custom_field TEXT;
UPDATE patients SET status = 'vip';
DELETE FROM payments;
```

### 3. 동적 코드 실행 금지
```typescript
// ❌ NEVER
eval(userInput);
new Function(code)();
require(dynamicPath);
import(dynamicPath);
```

### 4. 하드코딩된 시크릿 금지
```typescript
// ❌ NEVER
const API_KEY = "sk-1234567890";
const password = "admin123";

// ✅ GOOD: 설정에서 로드
const apiKey = await sdk.settings.get('api_key');
```

---

## SDK 위반 보고

플러그인이 승인되지 않은 권한을 사용하려 하면:
1. 해당 API 호출이 차단됩니다 (`PluginPermissionError`)
2. 위반 내역이 HQ에 자동 보고됩니다 (비동기, fire-and-forget)
3. 동일 플러그인에서 위반이 10회 이상 발생하면 **자동 비활성화**됩니다

> **중요**: manifest.json의 `permissions`에 필요한 권한을 모두 선언하고, 관리자가 설치 시 승인해야 합니다.

---

## 권장 패턴 (SHOULD)

### 1. 에러 처리
```typescript
try {
  const result = await sdk.patients.get(id);
  return new Response(JSON.stringify(result));
} catch (e) {
  const message = e instanceof Error ? e.message : 'Unknown error';
  return new Response(JSON.stringify({ error: message }), { status: 500 });
}
```

### 2. API 응답 형식
```typescript
// 성공
return new Response(JSON.stringify({ success: true, data: result }), { status: 200 });

// 에러
return new Response(JSON.stringify({ success: false, error: 'message' }), { status: 400 });
```

### 3. 레이아웃 사용
```astro
---
import BaseLayout from "../../../components/layout/BaseLayout.astro";
---

<BaseLayout title="페이지 제목">
  <!-- 콘텐츠 -->
</BaseLayout>
```

---

## 권한 목록

### 읽기 권한
| 권한 | 설명 | 위험도 |
|------|------|--------|
| `read:patients` | 환자 정보 읽기 | medium |
| `read:reservations` | 예약 정보 읽기 | low |
| `read:payments` | 결제 정보 읽기 | high |
| `read:staff` | 직원 정보 읽기 | low |
| `read:settings` | 설정 읽기 | low |
| `read:analytics` | 분석 데이터 읽기 | medium |

### 쓰기 권한
| 권한 | 설명 | 위험도 |
|------|------|--------|
| `write:patients` | 환자 정보 수정 | high |
| `write:reservations` | 예약 수정 | medium |
| `write:payments` | 결제 수정 | **critical** |
| `write:messages` | 메시지 발송 | high |
| `write:settings` | 설정 수정 | high |

### 특수 권한
| 권한 | 설명 | 위험도 |
|------|------|--------|
| `network:*` | 외부 HTTP 요청 (127.0.0.1, 192.168.*, 10.* 차단) | high |
| `storage:*` | 플러그인 KV 스토리지 | low |
| `ui:notifications` | 토스트 알림 표시 | low |
| `ui:dialogs` | 모달 다이얼로그 표시 | low |

> **주의**: `critical`/`high` 위험도 권한을 요청하면 설치 시 관리자 승인이 필요합니다.

---

## 훅 이벤트

### 예약 관련
| 이벤트 | 설명 |
|--------|------|
| `onReservationCreated` | 예약 생성 시 |
| `onReservationUpdated` | 예약 수정 시 |
| `onReservationCancelled` | 예약 취소 시 |

### 환자 관련
| 이벤트 | 설명 |
|--------|------|
| `onPatientCreated` | 환자 생성 시 |
| `onPatientUpdated` | 환자 정보 수정 시 |
| `onPatientCheckedIn` | 환자 체크인 시 |

### 결제 관련
| 이벤트 | 설명 |
|--------|------|
| `onPaymentCompleted` | 결제 완료 시 |
| `onPaymentRefunded` | 환불 처리 시 |

### 리드 관련
| 이벤트 | 설명 |
|--------|------|
| `onLeadCreated` | 리드 생성 시 |
| `onLeadConverted` | 리드 전환 시 |

### 시스템
| 이벤트 | 설명 |
|--------|------|
| `onCampaignSent` | 캠페인 발송 시 |
| `onDailySchedule` | 일일 스케줄 (매일 실행) |
| `onWeeklyReport` | 주간 리포트 (주 1회 실행) |

---

## 라우팅 우선순위 (참고)

Astro 라우팅 우선순위:
1. 정적 경로 (`/about`)
2. 동적 경로 (`/[id]`)
3. Catch-all (`/[...slug]`)

**이것이 `/ext/` prefix를 사용하는 이유입니다.**

예: 기존 `/surveys/[patient_id]` 라우트가 있으면, `/surveys/tools`도 해당 라우트가 캡처합니다.
`/ext/survey-tools/...`는 기존 라우트와 충돌하지 않습니다.

---

## 트러블슈팅

### 페이지가 404로 나옴
1. `manifest.json`의 `id`와 폴더명이 일치하는지 확인
2. `type`이 올바른지 확인 (`new-route` vs `override`)
3. 빌드 후 `import.meta.glob`이 파일을 인식하는지 확인

### Override가 작동하지 않음
1. 코어가 해당 경로에 Override Point를 제공하는지 확인
2. `priority` 값 확인 (높을수록 우선)
3. 플러그인이 활성화되어 있는지 확인 (`plugin_status` 테이블)

### props가 undefined
Universal Router에서 전달하는 props 목록 확인:
- `settings`, `db`, `pluginId`, `path`, `url`, `request`, `plugin`
