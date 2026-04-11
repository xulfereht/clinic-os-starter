---
description: Delegated setup workflow — central agent builds client site from master repo
category: dev
---

# Delegated Setup

Master repo agent sets up a client site on their behalf (client submitted intake on HQ `/delegated`).

## Prerequisites

- Running from master repo
- Client intake submitted → `handoff_status: intake_received`
- `DELEGATED_OPERATOR_TOKEN` env var set (HQ API auth)
- Client's Cloudflare API Token in intake (required permissions: Pages/D1/R2 Edit, Account Settings Read)
  - Or pass `CLOUDFLARE_ACCOUNT_ID` to skip Account Settings Read
  - Ref: [CF Setup Guide](https://clinic-os-hq.pages.dev/guide/cloudflare-setup)

## DELEGATED_OPERATOR_TOKEN

```bash
# Generate
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Register on HQ
cd hq && echo "<token>" | npx wrangler pages secret put DELEGATED_OPERATOR_TOKEN --project-name clinic-os-hq
# Redeploy HQ to apply
npx wrangler pages deploy dist --project-name clinic-os-hq
# Set locally
export DELEGATED_OPERATOR_TOKEN=<token>   # or add to .env (not committed)
```

## Normal Flow

### Phase 1: Init
```bash
node scripts/delegated-init.js --client-id=<CLIENT_ID>
# → ../delegated-clients/{slug}/ created with clinic.json, clinic-profile.json, .env, delegated-setup.json
# → HQ handoff_status → setup_in_progress
```

### Phase 2: Setup
```bash
cd ../delegated-clients/{slug}/
npm install
npm run setup:step -- --next   # Repeat until all steps complete
```
CF API Token in .env → no `wrangler login` needed. If `/memberships` error → set `CLOUDFLARE_ACCOUNT_ID`.

### Phase 3: Onboarding
From intake data (`.agent/clinic-profile.json`):
1. Read `.agent/onboarding-registry.json`
2. Tier 1 (required) → Tier 2 (core) first
3. Auto-fill from intake data, skip items needing human input

### Phase 3.5: Content Bootstrap
Full guide: `.agent/workflows/content-bootstrap.md`

**Seed remote DB**:
```bash
npx wrangler d1 execute <DB_NAME> --remote --file=seeds/sample_notices.sql
npx wrangler d1 execute <DB_NAME> --remote --file=seeds/sample_faqs.sql
npx wrangler d1 execute <DB_NAME> --remote --file=seeds/dummy_reviews.sql
```

**Blog import** (2 stages):
1. Extract: `node scripts/extract-naver.js --blog-id=<ID> --place-url=<URL> --site-url=<URL> --api-key=<KEY>`
2. Clean: HTML → Markdown, strip Naver boilerplate. Test 1 post first, then batch.
3. (Optional) R2 image migration for external CDN images.

**Program generation**: From clinic-profile services + blog keywords → `/admin/api/programs`. Target: 3-5+ programs.

**Image generation** (Nano Banana 2): Style card → base sources (~5) → per-program images (~3 each). Budget: ~23/30 quota. Swap AI images for real blog photos when available. See content-bootstrap.md Phase 3 + 6b.

**Update onboarding state**: blog-management (partial), program-management (partial), naver-content-import (done), branding-minimal (done).

### Phase 4: Deploy
```bash
npm run build && npm run deploy && npm run health
```

### Phase 5: Package + Upload
```bash
node scripts/delegated-package.js --dir=../delegated-clients/{slug}
# → ZIP uploaded to HQ R2 (handoff/{clientId}/v{timestamp}.zip)
# → handoff_status → setup_complete
# → Client download command printed
```
ZIP excludes: node_modules, .git, .env, dist, .wrangler, public/local/base.

### Phase 6: Client Handoff
Client runs one command:
```bash
curl -fsSL https://clinic-os-hq.pages.dev/cos-handoff.sh | bash
```
Auto: HQ auth → ZIP download → `npm install` → `npx wrangler login` → `npm run handoff:claim` (device register + status change).

Then `claude` → agent detects `handoff_status: claimed` → delegated-handoff workflow (password change, dev server, remaining onboarding, softgate).

## Demo Mode

For webinar/workshop live demos. No HQ intake — uses operator's CF account.

```
PRE-DEMO: delegated-init --demo-mode → setup:step --demo-mode → deploy
LIVE:     Skill pipeline demo (extract → setup → write → deploy)
POST:     delegated-package → cos-handoff.sh → handoff:claim
```

```bash
# Pre-demo
export CLOUDFLARE_API_TOKEN=<operator-token>
node scripts/delegated-init.js --demo-mode --clinic-name="Demo Clinic"
cd ../delegated-clients/demo-<id>/ && npm install
npm run setup:step -- --demo-mode --next  # Repeat
npm run build && npm run deploy

# Post-demo handoff: winner claims, resets CF resources to their account
npm run setup:step -- --step=cf-login
npm run setup:step -- --step=device-register
npm run build && npm run deploy
```

Demo differences: device-register skipped, core-pull uses default URL, `setup_mode: "demo"` in clinic.json.

## Status Transitions

```
intake_received → setup_in_progress → setup_complete → packaged → claimed
```

## Checklist

- [ ] delegated-init.js success
- [ ] npm install + setup:step all complete
- [ ] clinic-profile.json filled (phone, address, representative, hours)
- [ ] site_settings real data (not sample defaults)
- [ ] staff ≥ 1 (is_active=1)
- [ ] Onboarding Tier 1 complete
- [ ] Sample data seeded to remote DB
- [ ] Programs ≥ 3 with doctor_ids NOT NULL
- [ ] Naver content extracted (if applicable)
- [ ] Build + deploy + health pass
- [ ] GitHub push complete
- [ ] HQ handoff_status → setup_complete
- [ ] Client handoff notification sent

## Artifact Paths

| Artifact | Path | Created | Consumed |
|----------|------|---------|----------|
| Clinic profile | `.agent/clinic-profile.json` | Gate 0, `/extract-content` | `/setup-clinic-info`, `/onboarding` |
| Style card | `.agent/style-card.yaml` | `/analyze-content` | `/write-blog`, `/setup-skin`, `/setup-homepage` |
| Edge profile | `.agent/edge-profile.yaml` | `/discover-edge` | `/write-copy`, `/plan-content` |
| Site plan | `.agent/site-plan.yaml` | `/plan-content` | `/setup-homepage`, `/setup-programs` |
| Asset metadata | `public/local/homepage/asset-metadata.json` | content-bootstrap 6d | Agent ref |

All `.agent/*.yaml` and `public/local/` paths are core:pull protected.

## Related Files

| File | Role |
|------|------|
| `scripts/delegated-init.js` | Directory init |
| `scripts/delegated-package.js` | ZIP + HQ upload |
| `scripts/handoff-claim.js` | Client claim script |
| `.agent/delegated-setup.json` | Status tracking |
| `.agent/_archived/workflows-legacy/delegated-handoff.md` | Post-claim workflow (archived) |
| `.agent/workflows/content-bootstrap.md` | Full content pipeline |
