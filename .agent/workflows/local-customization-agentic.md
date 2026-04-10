---
description: Local customization — choose the right safe workspace for clinic-specific changes
category: dev
---

# Local Customization

Guide for choosing the correct safe workspace (NOT plugins — see `plugin-agentic.md` for that).

## Classify First

| Need | Path | Example |
|------|------|---------|
| **Customize AI/SEO endpoint** | **siteSettings DB** | **llms.txt, ai.json content** |
| Override existing public page | `src/pages/_local/**` | Custom doctors page |
| Clinic-specific helper/adapter | `src/lib/local/**` | Custom API formatter |
| Static images/logo/OG | `public/local/**` | Logo, OG image, banner |
| Internal ops docs | `docs/internal/**` | Recovery records, checklists |
| New feature/route/API | → Plugin (`plugin-agentic.md`) | |
| Survey/assessment tool | → Survey tool (`survey-tools-agentic.md`) | |

## Soft Core — siteSettings Override (⚠️ DO NOT edit core .ts files)

AI/SEO 엔드포인트 커스터마이즈는 **코어 파일 수정이 아닌 DB 설정**으로 합니다.
코어 파일을 직접 수정하면 core:pull 시 덮어쓰여집니다.

### Available Override Keys

| Endpoint | siteSettings key | Type |
|----------|-----------------|------|
| `/llms-full.txt` | `llms_full_txt` | text (full markdown) |
| `/llms.txt` | `llms_txt` | text (full markdown) |
| `/ai.txt` | `ai_txt` | text (full plaintext) |
| `/.well-known/ai.json` | `ai_json` | JSON string |
| `/.well-known/agent.json` | `agent_json` | JSON string |
| `/brand.txt` | `brand_txt` | text |

### How to Set (Agent)

**Option 1: wrangler CLI (로컬 DB)**
```bash
DB_NAME=$(grep database_name wrangler.toml | sed 's/.*"\(.*\)"/\1/')
npx wrangler d1 execute "$DB_NAME" --local --command \
  "INSERT INTO site_settings (category, key, value, updated_at) \
   VALUES ('siteSettings', 'llms_full_txt', 'YOUR CONTENT HERE', unixepoch()) \
   ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at"
```

**Option 2: Admin API (dev server running)**
```bash
curl -X PUT http://localhost:4321/api/admin/settings \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=..." \
  -d '{"category":"siteSettings","key":"llms_full_txt","value":"# Custom content..."}'
```

**Option 3: Leave empty** → 코어의 동적 생성 로직이 자동 작동 (기본값)

### Rules
- 빈 값 = 코어 기본값 사용 (override 비활성)
- JSON 엔드포인트 (ai.json, agent.json): 값이 유효한 JSON이어야 함. 파싱 실패 시 코어 기본값 fallback.
- core:pull 후에도 siteSettings 값은 DB에 유지됨 (안전)

## Custom Diagnosis (MiniDiagnosis) — survey_tools DB

프로그램에 커스텀 진단 도구를 추가하려면 **코어의 diagnosis-data.ts를 수정하지 말고** `survey_tools` 테이블에 등록하세요.

### 등록 방법

```bash
DB_NAME=$(grep database_name wrangler.toml | sed 's/.*"\(.*\)"/\1/')
npx wrangler d1 execute "$DB_NAME" --local --command \
  "INSERT INTO survey_tools (id, name, type, disclaimer, questions, mini_config, is_active) \
   VALUES ('my-program-mini', '커스텀 진단', 'mini', '참고용 자가진단입니다.', \
   '[{\"id\":\"q1\",\"text\":\"질문1\",\"options\":[{\"label\":\"보기1\",\"score\":0},{\"label\":\"보기2\",\"score\":3}]}]', \
   '{\"results\":[{\"level\":\"low\",\"title\":\"양호\",\"description\":\"설명\",\"minScore\":0,\"maxScore\":5}]}', 1)"
```

### 연결 규칙
- survey_tools.id = `{programId}-mini` 형식 (예: program slug가 "immunity"면 → "immunity-mini")
- 또는 프로그램 섹션에서 `toolId`를 직접 지정: `{"type":"MiniDiagnosis","data":{"toolId":"my-custom-tool"}}`
- DB에 없으면 → 코어 기본 진단(있는 경우만) 사용, 없으면 진단 섹션 미표시

### ClinicId 제한 없음
코어에 내장된 진단(diet, skin, digestive 등)은 하위호환용. 새 프로그램은 자유롭게 만들 수 있으며, survey_tools DB에 진단을 등록하면 됩니다.

## Read Before Starting

1. `.agent/runtime-context.json`
2. `.agent/manifests/change-strategy.json`
3. `.agent/manifests/local-workspaces.json`
4. `docs/CUSTOMIZATION_GUIDE.md`

## Page Override (`_local/`)

Copy original to same relative path under `_local/`:
```
src/pages/doctors/index.astro → src/pages/_local/doctors/index.astro
```

Rules:
- Import paths: use ORIGINAL file position (virtual mapping via Vite plugin)
- Check locale paths if i18n applies
- If admin values feed into the page, verify the data loader first

Verify: `npm run build` → check public URL → check locale variant.

## Local Lib (`src/lib/local/`)

For: clinic-specific utils, external API formatters, shared service between `_local` pages and local plugins.
NOT for: hiding core bugs, duplicating core loaders.

## Public Assets (`public/local/`)

For: git-tracked static files referenced in code (logo, OG image, banner).
NOT for: admin-uploaded images (→ R2), blog attachments (→ R2).

Verify: `npm run build` → check dist/ for asset path → verify page rendering.

## Internal Docs (`docs/internal/`)

For: recovery records, migration memos, clinic-specific checklists.
NOT for: user-facing content, secrets/tokens/keys.

## NOT Local Workspace

These need central patches, not local overrides:
- Auth/security/core loader bugs
- Admin→public reflection contract issues
- Bugs affecting all clients

## Completion Checklist

- [ ] Correct workspace chosen for the request
- [ ] Not hiding a core bug behind clinic-specific override
- [ ] `npm run build` passes
- [ ] Admin value → public rendering verified (if applicable)
- [ ] Static assets vs R2 uploads not confused
