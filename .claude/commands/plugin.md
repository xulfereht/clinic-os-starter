# /plugin — Plugin Manager

Collaboratively create, test, and publish plugins with the client.
Designed for extending Clinic-OS with custom features — pages, APIs, widgets, homepage overrides.

## Source of Truth

- Plugin loader: `src/lib/plugin-loader.ts`
- Plugin SDK: `src/lib/plugin-sdk.ts`
- Universal router: `src/pages/ext/[...path].astro`
- Local plugin path: `src/plugins/local/{plugin-id}/`
- Development guide: `docs/PLUGIN_DEVELOPMENT_GUIDE.md`
- HQ submit API: `src/pages/api/plugins/submit.ts`
- HQ install API: `src/pages/api/plugins/install.ts`

## Modes

Detect user intent and route to the appropriate mode:

| Intent | Mode |
|--------|------|
| 만들기, 새 기능, 플러그인 만들기, create | `create` |
| 목록, 어떤 플러그인, list | `list` |
| 수정, 편집, edit | `edit` |
| 테스트, test | `test` |
| 공개, 제출, publish | `publish` |
| 삭제, remove | `delete` |

If unclear, ask:
```
어떤 작업을 하시겠어요?
[A] 새 플러그인 만들기
[B] 기존 플러그인 보기/수정
[C] HQ에 제출하기
```

---

## Mode: create

### Step 1 — Discovery (conversation)

DO NOT immediately generate files. First, understand what the user needs:

```
어떤 기능을 추가하고 싶으신가요?

예시:
• 우리 병원만의 예약 페이지
• 이벤트/프로모션 관리
• 환자 설문 결과 대시보드
• 원장님 블로그/칼럼
• 멤버십/포인트 시스템
• 홈페이지 커스터마이징

자유롭게 설명해주세요. 어떤 페이지가 필요하고, 누가 사용하는지 알려주시면
최적의 구조로 설계합니다.
```

Gather:
- **Purpose**: What does this plugin do?
- **Users**: Admin only? Public? Both?
- **Pages needed**: What screens/views are required?
- **Data**: Does it need its own DB tables? (`custom_` prefix required)
- **Type**: New route (`/ext/{id}/...`) or homepage override?
- **Permissions**: Does it need access to patients, reservations, etc.?

### Step 2 — Architecture Design

Present the design before generating:

```
📦 플러그인 설계안
━━━━━━━━━━━━━━━━━

이름: {name}
ID: {plugin-id}
타입: {new-route | override}
경로: /ext/{plugin-id}/

📄 페이지:
  • / — 메인 페이지 (공개)
  • /admin — 관리 페이지 (관리자 전용)
  ...

🗄️ 데이터베이스:
  • custom_{table} — {description}
  ...

🔐 권한:
  • read:patients — 환자 정보 조회
  ...

이대로 진행할까요?
```

Iterate until the user approves.

### Step 3 — Generate Files

Create in `src/plugins/local/{plugin-id}/`:

**manifest.json** (always required):

```json
{
  "id": "{plugin-id}",
  "name": "{name}",
  "description": "{description}",
  "version": "1.0.0",
  "author": "{clinic name}",
  "type": "new-route",
  "category": "{category}",
  "permissions": [],
  "routes": {
    "base": "/ext/{plugin-id}",
    "public": [
      { "path": "/", "file": "pages/index.astro", "title": "메인" }
    ]
  },
  "documentation": {
    "summary": "{10자 이상 요약}",
    "features": ["{feature1}", "{feature2}"]
  }
}
```

**README.md** (required for HQ submission):

```markdown
# {Plugin Name}

{Description}

## Features
- {feature 1}
- {feature 2}
```

**pages/index.astro** (main page):

```astro
---
/**
 * {Plugin Name} - Main Page
 * Route: /ext/{plugin-id}/
 */
interface Props {
    settings?: any;
    db?: any;
    pluginId?: string;
    path?: string;
    url?: URL;
    request?: Request;
    plugin?: any;
}

const props = Astro.props as Props;
// @ts-ignore
const db = props.db ?? Astro.locals?.runtime?.env?.DB;
const settings = props.settings;
---

<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{name}</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>
<body>
    <!-- Plugin content here -->
</body>
</html>
```

**migration.sql** (if DB tables needed):

```sql
-- Custom tables must use custom_ prefix
CREATE TABLE IF NOT EXISTS custom_{table_name} (
    id TEXT PRIMARY KEY,
    -- columns...
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);
```

### Page Template Patterns

**Public page** (visitors/patients see this):
- Use standalone HTML with Tailwind CDN
- Include clinic branding via `settings.clinic_name` etc.
- Mobile-first responsive design

**Admin page** (accessible via admin hub):
- Import `AdminLayout` from `../../../layouts/AdminLayout.astro`
- Follow admin UI patterns (cards, tables, forms)
- Add to manifest: `"pages": [{"path": "manage", "title": "관리"}]`

**Override page** (replaces homepage):
- Type: `"override"` in manifest
- `"overrides": [{"path": "/", "file": "pages/index.astro", "priority": 10}]`
- Higher priority wins when multiple plugins override same path

### Step 4 — DB Migration (if needed)

If the plugin has `migration.sql`:

```bash
npm run dev
# In another terminal or via API:
curl -X POST http://localhost:4321/api/plugins/migrate \
  -H "Content-Type: application/json" \
  -d '{"pluginId": "{plugin-id}"}'
```

### Step 5 — Build & Test

```bash
npm run build
```

If build succeeds:

```
✅ 플러그인 생성 완료!

📂 위치: src/plugins/local/{plugin-id}/
🔗 공개 URL: /ext/{plugin-id}/
🔗 관리 허브: /admin/hub/

다음 단계:
  1. npm run dev 로 로컬에서 테스트
  2. /ext/{plugin-id}/ 에서 동작 확인
  3. 배포하면 프로덕션에서 바로 사용 가능
  4. 원하시면 HQ에 제출하여 다른 병원에 공유
```

### Step 6 — Deploy Offer

```
플러그인을 배포하시겠습니까?
[A] 로컬만 (우리 병원에서만 사용)
[B] HQ에 제출 (다른 병원도 사용 가능)
```

---

## Mode: list

Scan plugins and present:

```
📋 설치된 플러그인
━━━━━━━━━━━━━━━━━

🔵 코어 (core:pull로 관리)
  • survey-tools — 검사도구 플랫폼 [new-route] /ext/survey-tools
  • custom-homepage — 홈페이지 커스텀 [override] /

🟢 로컬 (우리 병원 전용)
  • {id} — {name} [{type}] {route}

총 {N}개 플러그인
```

Also check plugin status in DB:

```sql
SELECT plugin_id, status, installed_at FROM installed_plugins
```

---

## Mode: edit

1. List plugins (same as `list`)
2. User selects a plugin
3. Only edit plugins in `local/` — core plugins require override:
   - "코어 플러그인을 수정하면 core:pull 시 덮어쓰기됩니다."
   - "local/에 같은 ID로 복사하여 수정할까요?"
4. Read manifest and pages, apply changes, rebuild

---

## Mode: test

1. Verify manifest.json validity
2. Check all referenced page files exist
3. If migration.sql exists, validate SQL syntax
4. Run build
5. Report status:

```
🧪 플러그인 검증: {name}
━━━━━━━━━━━━━━━━━━━━━━

✅ manifest.json — 유효
✅ pages/index.astro — 존재
✅ migration.sql — SQL 유효
✅ 빌드 — 성공
⚠️  HQ 제출 요건:
  ✅ README.md 존재
  ✅ documentation.summary (10자+)
  ✅ documentation.features (1개+)
```

---

## Mode: publish

Submit a local plugin to HQ marketplace.

### Pre-checks

1. Plugin must be in `src/plugins/local/`
2. Required for HQ submission:
   - `README.md` exists
   - `manifest.documentation.summary` (min 10 chars)
   - `manifest.documentation.features` (min 1 item)
   - `pages/` directory exists
   - No security violations (eval, dynamic code generation, etc.)
3. Build must pass

### Procedure

1. Validate all HQ submission requirements
2. Fix any gaps (add README, documentation, etc.)
3. Guide user:

```
📦 HQ 제출 준비
━━━━━━━━━━━━━━

플러그인: {name} v{version}
타입: {type}
권한: {permissions count}개
페이지: {pages count}개

⚠️  HQ에 제출하면 검토 후 다른 Clinic-OS 사용자에게 공개됩니다.
제출하시겠습니까? [Y/n]
```

4. Dev server must be running (`npm run dev`)
5. Submit via admin UI: `/admin/hub/` → select the plugin → "HQ에 제출"

---

## Mode: delete

Only local plugins can be deleted.

1. Confirm with user
2. Remove files:
```bash
rm -rf src/plugins/local/{plugin-id}
```
3. If DB tables were created, inform user they remain (safe; custom_ prefix)
4. Rebuild

---

## Plugin Categories

| Category | Korean | Use Case |
|----------|--------|----------|
| `marketing` | 마케팅 | 이벤트, 프로모션, SEO |
| `integration` | 연동 | 외부 서비스 연결 |
| `customization` | 커스터마이징 | UI/UX 변경, 홈페이지 |
| `analytics` | 분석 | 데이터 시각화, 리포트 |
| `utility` | 유틸리티 | 도구, 헬퍼 |
| `communication` | 소통 | 메시지, 알림, 채팅 |
| `automation` | 자동화 | 워크플로우, 스케줄 |
| `ui` | UI | 위젯, 테마, 컴포넌트 |

## Permission Risk Levels

| Risk | Permissions | Review |
|------|------------|--------|
| Low | `read:reservations`, `read:staff`, `read:settings`, `storage:*`, `ui:*` | Auto-approve |
| Medium | `read:patients`, `read:analytics`, `write:reservations`, `database:read` | User confirm |
| High | `read:payments`, `write:patients`, `write:messages`, `write:settings`, `database:write`, `network:*` | Explicit warning |
| Critical | `write:payments` | Strong warning + double confirm |

When generating permissions, use the minimum required. Explain each to the user.

## DB Table Rules

- All custom tables MUST use `custom_` prefix
- NEVER ALTER existing core tables (patients, reservations, etc.)
- Use `id TEXT PRIMARY KEY` pattern
- Include `created_at INTEGER DEFAULT (unixepoch())`
- Foreign keys to core tables are OK for read relationships

## File Safety

- All files go to `src/plugins/local/` — safe from core:pull
- Never modify `src/plugins/survey-tools/` or `src/plugins/custom-homepage/`
- If overriding a core plugin, copy to `local/{same-id}/` first

## Triggers

User says: "플러그인", "기능 추가", "확장", "plugin", "새 페이지", "기능 만들기"

## All user-facing output in Korean
