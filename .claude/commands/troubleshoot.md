# /troubleshoot — Problem Resolution Helper

> **Role**: Diagnostician
> **Cognitive mode**: Systematic diagnosis. Collect symptoms, run checks, identify root cause, fix or escalate. Never guess — verify.

Systematically diagnoses and resolves initial setup failures, build errors, deployment issues, and runtime errors.

## When to Use

- `npm run dev` / `npm run build` failure
- `npm run deploy` failure
- 500/404 errors on site access
- D1 database issues
- R2 images not showing
- Problems after core:pull/core:update
- "It's not working", "There's an error", "It broke"

## Procedure

### Step 1 — Symptom collection

Ask user minimal questions:

```
What problem are you experiencing?
  [1] Build / dev server error
  [2] Deploy failure
  [3] Site access error (500, 404, blank page)
  [4] Images / assets not showing
  [5] Data issue (admin page, DB)
  [6] Problem after core update
  [7] Other (please share the error message)
```

### Step 2 — Automated diagnosis

Run relevant checks based on selection. Parallelize where possible.

#### [1] Build/dev server errors

```bash
# Environment check
node --version
npm --version
cat package.json | python3 -c "import json,sys; print(json.load(sys.stdin).get('version','?'))"

# Dependency status
ls node_modules/.package-lock.json 2>/dev/null && echo "node_modules OK" || echo "node_modules MISSING"

# Build attempt + error capture
npm run build 2>&1 | tail -30
```

**Common causes and fixes:**

| Error Pattern | Cause | Fix |
|----------|------|------|
| `Cannot find module` | node_modules missing | `npm install` |
| `Cannot find package '@astrojs/'` | Dependency version mismatch | `rm -rf node_modules && npm install` |
| `Type error in src/pages/` | Core file type error | Core bug → escalation |
| `Type error in _local/` | Local file error | Can fix directly |
| `EACCES permission denied` | File permissions | `chmod -R 755 .` |
| `Port 4321 already in use` | Existing process | `lsof -ti:4321 \| xargs kill` |

#### [2] Deployment failure

```bash
# Cloudflare auth
npx wrangler whoami 2>&1

# D1 binding check
grep 'database_id' wrangler.toml

# R2 binding check
grep 'bucket_name' wrangler.toml

# Build check
npm run build 2>&1 | tail -10

# Deploy attempt
npm run deploy 2>&1 | tail -20
```

| Error Pattern | Cause | Fix |
|----------|------|------|
| `Not authenticated` | Cloudflare not logged in | `npx wrangler login` |
| `database_id.*placeholder` | D1 not created | See `/onboarding` deploy guardrails |
| `Build failed` | Build error | Branch to [1] |
| `Pages project not found` | CF project missing | `npx wrangler pages project create` |

#### [3] Site access errors

```bash
# Site URL check
SITE_URL=$(grep 'site_url' wrangler.toml 2>/dev/null | head -1)

# HTTP status check
curl -sf -o /dev/null -w "%{http_code}" "${SITE_URL}/" 2>/dev/null

# Remote DB migration status
DB=$(grep 'database_name' wrangler.toml | head -1 | awk -F'"' '{print $2}')
npx wrangler d1 execute "${DB}" --remote --command \
  "SELECT COUNT(*) as count FROM d1_migrations" 2>&1
```

| Error | Cause | Fix |
|------|------|------|
| 500 | DB migrations not applied | `npx wrangler d1 migrations apply {db} --remote` |
| 500 | DB schema mismatch | `npm run doctor` → auto-repair |
| 404 | Pages project not linked | Check custom domain in CF dashboard |
| Blank page | JS error | Ask user to check browser console |

#### [4] Images/assets not showing

```bash
# R2 binding check
grep -A2 'r2_buckets' wrangler.toml

# Local image file existence
ls public/local/ 2>/dev/null
ls public/homepage/ 2>/dev/null

# R2 bucket contents
npx wrangler r2 object list {bucket_name} --prefix="uploads/" 2>&1 | head -20
```

| Cause | Fix |
|------|------|
| No R2 binding | `/onboarding` Gate 3 (R2 setup) |
| Image path mismatch | Check public/local/, fix paths in index.astro |
| R2 upload failure | Re-run `/extract-content` (--skip-existing) |

#### [5] Data issues

```bash
# DB schema validation
npm run doctor 2>&1

# Table list
npx wrangler d1 execute DB --local --command ".tables" 2>&1

# Site settings check
npx wrangler d1 execute DB --local --command \
  "SELECT category, key, value FROM site_settings ORDER BY category, key;"
```

#### [6] Post-core-update issues

```bash
# Current core version
cat .core/version 2>/dev/null || echo "no .core/version"

# Last core:pull log
cat .core/last-pull.log 2>/dev/null | tail -20

# Conflict files
git status --porcelain | grep "^UU"

# Health score
npm run health 2>&1
```

### Step 3 — Auto-repair attempt

Based on diagnosis, attempt safe repairs first:

```
🔧 Auto-repairable items:
  [1] Reinstall node_modules (npm install)
  [2] Auto-repair DB schema (npm run doctor)
  [3] Apply remote migrations
  [4] Fix _local/ file import paths

Proceed with auto-repair?
```

**Non-repairable cases (escalation):**
- Bugs in core files (src/pages/, src/components/, etc.)
- wrangler.toml structural issues
- Cloudflare account/billing issues

→ Call `cos-ask` support agent or file HQ bug report

### Step 4 — cos-ask escalation (after 2 failures)

If direct repair fails after 2 attempts:

```bash
./scripts/cos-ask "error message + summary of attempted fixes"
```

If cos-ask result also fails → HQ bug report (follow Bug Escalation procedure in onboarding).

### Step 5 — Result report + handoff recording

```
🔧 Problem Resolution Result

Problem: npm run build failure — Cannot find module '@astrojs/cloudflare'
Cause: Corrupted node_modules
Resolution: Reinstalled npm → build succeeded

⚠️ Unresolved: None
```

Auto-record resolved/unresolved issues to `/handoff`:

```bash
# Add issue to handoff.json
# resolved: true/false
```

## Quick Recipes

| Symptom | One-step Fix |
|------|-----------|
| "Build isn't working" | `rm -rf node_modules && npm install && npm run build` |
| "500 error" | `npx wrangler d1 migrations apply {db} --remote` |
| "Images broken" | `ls public/local/` → check paths → fix |
| "Can't access admin" | `grep ADMIN_PASSWORD wrangler.toml` → verify |
| "Broke after update" | `npm run health:fix` |

## Integration

| Skill | Relationship |
|-------|-------------|
| `/handoff` | Auto-integrates issue recording |
| `/onboarding` | Overlaps with deploy guardrails — if mid-onboarding, return to /onboarding |
| `/status` | System status check (part of diagnosis) |
| `/infra-check` | Infrastructure check (part of diagnosis) |
| `/core-update` | Post-core-update issues → handled here |
| cos-ask | Escalation after 2 failures |

## Triggers

- "에러", "안 돼", "깨졌어", "문제", "실패"
- "빌드 에러", "배포 실패", "500 에러"
- "도와줘", "고장", "troubleshoot"
- "이미지 안 보여", "DB 에러"

## All user-facing output in Korean.
