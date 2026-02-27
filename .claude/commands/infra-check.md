# /infra-check — Infrastructure Verification

Comprehensive check of all infrastructure required for Clinic-OS operation.
Works in both master and client repos.

## Source of Truth

- Environment diagnostics: `scripts/doctor.js`
- Health audit: `scripts/health-audit.js`
- Deploy guard checks: `scripts/deploy-guard.js` (reference for check logic)
- Infrastructure config: `wrangler.toml`

## Procedure

### 1. Environment diagnostics

```bash
node scripts/doctor.js --quiet
```

Checks:
- Node.js v18+ installed
- Git, npm, Wrangler CLI available
- Network connectivity
- Local DB existence + data

### 2. Health audit

```bash
node scripts/health-audit.js
```

Checks:
- Version consistency (package.json ↔ .core/version)
- Starter compatibility (minStarterVersion)
- Critical file existence (middleware.ts, astro.config.mjs, etc.)
- DB schema integrity (missing tables/columns)
- Migration state (applied count vs file count)
- node_modules freshness

### 3. Parse wrangler.toml

Read `wrangler.toml` and verify:

- `name`: project name
- `[[d1_databases]]`: DB binding
  - Check `database_id` for placeholder values (YOUR_DATABASE_ID_HERE, 00000000-..., etc.)
- `[[r2_buckets]]`: R2 binding existence
- `compatibility_date`: warn if >6 months old

### 4. Remote Cloudflare resource verification

```bash
# Login status
npx wrangler whoami

# D1 database list
npx wrangler d1 list

# R2 bucket list (if R2 binding configured)
npx wrangler r2 bucket list
```

### 5. Environment variable check

Check `.env` for key existence only (never output values):

| Key | Purpose | Required |
|-----|---------|----------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account | Yes |
| `CLOUDFLARE_API_TOKEN` | API token | Yes |
| `ADMIN_PASSWORD` | Admin password | Yes |
| `GOOGLE_CLIENT_ID` | Google login | Optional |
| `SOLAPI_API_KEY` | SMS sending | Optional |
| `R2_ACCESS_KEY_ID` | R2 storage | Optional |

Dangerous defaults to detect:
- ADMIN_PASSWORD: `admin`, `password`, `1234`, `change-me`

### 6. HQ infrastructure (master only)

If `hq/` directory exists, additionally check:

```bash
# HQ D1
npx wrangler d1 list | grep clinic-hq

# HQ site response
curl -sf -o /dev/null -w "%{http_code}" "https://clinic-os-hq.pages.dev/api/health"
```

## Rules

- Run all info-gathering commands in **parallel** where possible
- On failure, show ❌ or "unavailable" instead of crashing
- **Never output .env values** — key existence only
- All user-facing output in Korean
- Suggest `npm run health:fix` if auto-fixable issues exist
