# /onboarding — Softgate & Onboarding Entry Point

Unified entry point for the client setup journey.
Checks softgate guardrails first, then guides through onboarding tiers.
Primarily for client repos, but also works in the master repo.

## Source of Truth

- Softgate workflow: `.agent/workflows/softgate.md`
- Onboarding workflow: `.agent/workflows/onboarding.md`
- Feature registry: `.agent/onboarding-registry.json` (core, read-only)
- Onboarding state: `.agent/onboarding-state.json` (client, mutable)
- Softgate state: `.agent/softgate-state.json` (client, mutable)
- Clinic profile: `.agent/clinic-profile.json` (client, mutable)

## Procedure

### 1. Load state files

Read all state files in parallel:

```
.agent/softgate-state.json    — gate pass status
.agent/onboarding-state.json  — feature completion status
.agent/clinic-profile.json    — clinic data (Gate 0 result)
.agent/onboarding-registry.json — feature specs (33 features × 5 tiers)
```

If state files don't exist, initialize with defaults.

### 2. Check softgate gates (in order)

**Gate 0: Clinic Profiling**
- Check: `.agent/clinic-profile.json` exists and has `clinic.name_ko`
- If missing: Start profile interview per `.agent/workflows/softgate.md` Gate 0
- Flow: Ask for Naver Place URL / website URL / manual input → scrape → confirm → save

**Gate 1: Code Safety (GitHub)**
- Check: `git remote -v` includes `github.com`
- If missing: Guide GitHub setup per `.agent/workflows/softgate.md` Gate 1
- Soft gate: warn but don't block if user says "later"

**Gate 2: Data Safety (D1 Backup)**
- Check: `.agent/softgate-state.json` has recent `d1_backup.last_backup_at` (within 7 days)
- If missing: Run `npm run db:backup` and record
- Auto-action: no user input needed

**Gate 3: Asset Safety (R2)**
- Check: `wrangler.toml` contains `[[r2_buckets]]`
- If missing: Guide R2 setup per `.agent/workflows/softgate.md` Gate 3
- Soft gate: only needed before image uploads

### 3. All gates passed → Start/resume onboarding

Read `.agent/onboarding-state.json` to determine progress:

```
If no state file → fresh start (Tier 1)
If state exists → resume from last incomplete feature
```

### 4. Show progress summary

Present current status before continuing:

```
📊 Onboarding Progress: 7/48 complete (14%)
🏷️ Current: Tier 1 (Deploy Required) — 3/7 done

✅ Done: admin-account, clinic-info, clinic-contact
⏳ Next: clinic-hours, branding-minimal, terms-management, admin-password-env
```

### 5. Guide through features sequentially

Follow the feature execution pattern from `.agent/workflows/onboarding.md`:

```
[1] Read feature spec from registry (depends_on, doc_ref, human_inputs)
[2] Check dependencies → resolve if unmet
[3] Use clinic-profile.json data to auto-fill where possible
[4] Ask user only for required fields not already known
[5] Apply settings (admin API, DB, files)
[6] Verify and update onboarding-state.json
[7] Move to next pending feature in same tier
```

### 6. Tier completion checkpoints

At each tier boundary, offer deployment:

```
Tier 1 done → "Ready for first deploy. Deploy now or continue to Tier 2?"
Tier 2 done → "Site looks like an operating clinic. Deploy?"
Tier 3 done → "Patient intake enabled. Tier 4+ is optional."
Tier 4-5    → "Select features as needed."
```

## Deploy Guardrails

Before every deployment attempt (at tier boundaries or user request), run these checks **in order**. Do not proceed to `npm run deploy` until all blockers are resolved.

### Check 1: Cloudflare Authentication

```bash
npx wrangler whoami 2>&1
```

- **Pass**: Shows email address → continue
- **Fail**: Not authenticated →
  1. Tell user: "Cloudflare 로그인이 필요합니다. 브라우저 창이 열립니다."
  2. Run `npx wrangler login`
  3. If browser doesn't open, show the URL and tell user: "이 주소를 브라우저에 직접 붙여넣으세요."
  4. Re-check after login completes

### Check 2: D1 Database ID (placeholder detection)

```bash
grep 'database_id' wrangler.toml
```

- **Pass**: UUID format (e.g., `8a34f9d2-...`) → continue
- **Fail**: Placeholder value (`local-db-placeholder`, `YOUR_DATABASE_ID_HERE`, empty) →
  1. Tell user: "프로덕션 데이터베이스가 아직 생성되지 않았습니다. 지금 만들어드리겠습니다."
  2. Extract database_name from wrangler.toml
  3. Run: `npx wrangler d1 create {database_name}`
  4. Parse the real database_id from output
  5. Ask user for permission to update wrangler.toml with the real ID
  6. **Important**: This is a PROTECTED_EXACT file — explain to user: "wrangler.toml은 보호 파일이라 업데이트 승인이 필요합니다."
  7. After user approves, update the database_id line

### Check 3: R2 Bucket Existence

```bash
grep 'bucket_name' wrangler.toml
```

- **Pass**: Non-empty bucket_name → verify with `npx wrangler r2 bucket list 2>&1 | grep {bucket_name}`
- **Fail**: Missing or bucket doesn't exist →
  1. Tell user: "이미지 저장소(R2)가 필요합니다. 지금 만들어드리겠습니다."
  2. Run: `npx wrangler r2 bucket create {bucket_name}`
  3. If bucket_name is missing from wrangler.toml, derive from database_name: `{name}-uploads`
  4. Update wrangler.toml (with user approval, same PROTECTED_EXACT note)

### Check 4: Build Verification

```bash
npm run build 2>&1
```

- **Pass**: Exit code 0 and `dist/_worker.js` exists → continue
- **Fail**: Build error →
  - If error is in `_local/` or `local/` code → fix it directly, retry
  - If error is in core path → trigger **Bug Escalation** (do NOT attempt to fix core files)
  - Tell user: "빌드 에러가 코어 파일에서 발생했습니다. 개발팀에 보고합니다." and continue escalation procedure

### Check 5: ADMIN_PASSWORD Check

```bash
grep 'ADMIN_PASSWORD' wrangler.toml
```

- **Fail if** value is a common default: `1234`, `admin`, `password`, `test`, `changeme`, empty
  1. Tell user: "관리자 비밀번호가 기본값입니다. 보안을 위해 변경이 필요합니다."
  2. Ask user for new password (minimum 8 characters)
  3. Update wrangler.toml (with user approval)
- **Pass**: Non-default value → continue

### Check 6: Deploy Execution

All checks passed → run deploy:

```bash
npm run deploy
```

### Check 7: Post-Deploy Remote Migration

**Immediately after successful deploy**, check remote D1 migration status:

```bash
npx wrangler d1 execute {database_name} --remote --command "SELECT COUNT(*) as count FROM d1_migrations" 2>&1
```

- **Pass**: Count > 0 → migrations already applied
- **Fail**: Count = 0 or table doesn't exist →
  1. Tell user: "프로덕션 데이터베이스에 테이블 구조를 적용합니다. (최초 1회)"
  2. Run: `npx wrangler d1 migrations apply {database_name} --remote`
  3. Verify: re-run the count query
  4. If fails → tell user: "마이그레이션 적용 중 오류가 발생했습니다" and show error
- **Important**: This step is often forgotten and causes 500 errors on first visit. Always run it automatically.

### Check 8: Post-Deploy Smoke Test

```bash
curl -sf -o /dev/null -w "%{http_code}" "https://{project_name}.pages.dev/" 2>/dev/null
```

- **200**: Tell user: "배포 완료! 사이트가 정상 작동합니다." and show URL
- **500**: Likely migration issue → re-run Check 7
- **404**: Pages project may not exist → tell user to check Cloudflare dashboard
- **Timeout/unreachable**: "배포는 완료했지만 아직 반영 중입니다. 1-2분 후 다시 확인하세요."

## GitHub Auth Guardrail

When Gate 1 (GitHub) runs and `git push` is needed:

### Preferred path: `gh` CLI

```bash
which gh 2>/dev/null
```

- **Found**: Use `gh auth login` (browser-based, handles 2FA automatically)
  ```bash
  gh auth login --web
  gh repo create {name} --private --source=. --push
  ```
  This is one command — no manual repo creation needed.

- **Not found**: Fall back to manual flow, but guide clearly:
  1. Tell user: "GitHub에 코드를 백업하려면 저장소가 필요합니다."
  2. Guide to create private repo on github.com
  3. When `git push` asks for password, explain: "GitHub은 비밀번호 대신 토큰을 사용합니다."
  4. Link to token creation: Settings → Developer Settings → Personal Access Tokens → Fine-grained
  5. Required scope: `repo` (Contents read/write)
  6. After token entry succeeds, suggest: "다음부터 편하게 하려면 `brew install gh`를 추천합니다."

### Never do

- Never store GitHub tokens in any file
- Never show tokens in output after initial entry
- If push fails with 403/401, don't retry with same credentials — ask user to re-enter

## Bug Escalation

When a feature fails during onboarding, determine whether the issue is **within your authority** or **outside your authority** before deciding to report.

### Report to HQ (outside agent authority)

These are problems the agent cannot fix — they require a core code change from upstream:

- **Core file bug**: The error originates in a core path (`src/pages/`, `src/components/`, `src/lib/`, `migrations/`, etc.) which the agent must not modify
- **cos-ask exhausted**: The support agent was consulted and returned no actionable solution
- **HQ API error**: An HQ endpoint returns unexpected errors (5xx, schema mismatch)
- **Migration schema mismatch**: D1 schema doesn't match what core code expects
- **Protected config conflict**: A protected file (`wrangler.toml`, `clinic.json`) conflicts with core code expectations

### Do NOT report (within agent authority)

- User input errors — ask again
- Network timeouts — retry
- Local environment issues (`node_modules`, `.env` missing) — fix directly
- `_local/` or `local/` code bugs — agent can edit these
- Feature dependency not met — resolve the dependency first

### Escalation procedure

```
[1] Determine the root cause is in core code (not local/user error)
[2] Collect context:
    - feature_id from onboarding-registry.json
    - error message and stack trace
    - core file path where the bug exists
    - clinic-os version (from package.json or .core/version)
    - what was attempted (including cos-ask result if used)
[3] Read license_key from clinic.json (will be sent for client identification)
[4] POST to HQ:
    curl -sf -X POST https://clinic-os-hq.pages.dev/api/support/bug \
      -H "Content-Type: application/json" \
      -d '{
        "license_key": "{license_key}",
        "title": "Onboarding: {feature_id} — {short description}",
        "description": "{detailed description}",
        "error_message": "{error}",
        "environment": {"version": "{version}"},
        "severity": "medium"
      }'
[5] Inform user: "이 문제는 코어 코드의 버그로 판단되어 개발팀에 자동 보고했습니다."
[6] Mark feature as `blocked` in onboarding-state.json with bug reference
[7] Skip to next unblocked feature and continue onboarding
```

### Severity guide

| Severity | Condition |
|----------|-----------|
| critical | Onboarding completely stuck — no features can proceed |
| high | A Tier 1-2 feature is blocked (affects first deploy) |
| medium | A Tier 3+ feature is blocked |
| low | Non-blocking issue (cosmetic, warning) |

## Key Rules

1. **Always read state files first** — never start without context
2. **One feature at a time** — don't overwhelm the user
3. **Auto-fill from clinic-profile.json** — minimize questions
4. **Respect "later" choices** — mark as `skipped`, don't re-ask same session
5. **Update state after each feature** — persist progress immediately
6. **Follow tier order** — don't skip tiers unless user explicitly requests
7. **Use simple language** — avoid git/technical jargon with clinic staff
8. **Refer to doc_ref** — point to specific guides when detailed help is needed

## Triggers

User says: "온보딩", "셋업", "설정", "시작", "onboarding", "setup"

## Soft Reminder Schedule

For incomplete gates, remind every 3 sessions:
- Track `reminders.{gate}_reminded_at` in softgate-state.json
- Don't re-ask in the same session if user said "later"

## All user-facing output in Korean
