# /status — System Status Dashboard

Displays a unified overview of the Clinic-OS system state.
Works in both master and client repos.

## Procedure

### 1. Gather version info

```bash
node scripts/check-version.js
```

### 2. Health score

```bash
node scripts/health-audit.js --quiet
```

Extract the `score` value from output.

### 3. Git state

```bash
git status --porcelain
git log --oneline -5
git branch --show-current
```

### 4. Release state (master only)

Read `.agent/release-state.json` if it exists.
Show current release progress. If state is IDLE or file missing, show "no release in progress".

### 5. HQ channel versions (master only)

If `hq/` directory exists, this is a master repo. Run:

```bash
curl -sf "https://clinic-os-hq.pages.dev/api/v1/update/channel-version?channel=stable"
curl -sf "https://clinic-os-hq.pages.dev/api/v1/update/channel-version?channel=beta"
```

### 6. DB status

```bash
node scripts/doctor.js --db-only --quiet
```

## Output Format

```
📊 Clinic-OS Status Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Version
   Local: v1.23.0
   Core: v1.23.0
   [Master] HQ beta: v1.23.0 / stable: v1.22.0

🏥 Health: 85/100 ✅
   [Show issues if any]

📂 Git: main (clean)
   Recent commits:
   - abc1234 release: v1.23.0
   - def5678 feat: new feature
   - ...

🚀 Release: IDLE (no release in progress)
   [Or show current state + next step if in progress]

💾 DB: ✅ OK
   [Show issues if any]
```

## Score Thresholds

| Range | Display | Meaning |
|-------|---------|---------|
| 80-100 | ✅ | Healthy |
| 50-79 | ⚠️ | Attention needed |
| 0-49 | ❌ | Action required |

## Rules

- Run all info-gathering commands in **parallel** (no dependencies)
- On failure, show "unavailable" instead of error (dashboard must not break)
- All user-facing output in Korean
- Master vs client detection: check if `hq/` directory exists
