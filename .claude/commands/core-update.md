# /core-update — Post-Update Conflict Resolution & Deploy

Runs `core:pull`, resolves conflicts automatically, verifies the build, and optionally deploys.
Designed for non-technical clients who need a one-shot update experience.
Primarily for client repos.

## Source of Truth

- Fetch engine: `.docking/engine/fetch.js`
- Protection manifest: `.docking/protection-manifest.yaml`
- Backup manifest: `.core-backup/*/manifest.json`
- Health audit: `scripts/health-audit.js`
- Schema doctor: `scripts/doctor.js`
- Core repair: `scripts/core-repair.js`

## Pre-check

Verify this is a client repo (`.docking/config.yaml` exists with `device_token`).
If this is the master repo, inform user: "마스터에서는 /release를 사용하세요."

## Procedure

### 1. Pre-update snapshot

Before anything, ensure git is initialized (starter kit may lack root .git):

```bash
# v1.24.0+ fetch.js auto-fixes this, but check for older versions
if [ ! -d .git ]; then
  git init
fi
```

Capture current state:

```bash
node scripts/check-version.js
```

Note the current version. Also check for uncommitted changes:

```bash
git status --short
```

If uncommitted changes exist, ask user: "커밋되지 않은 변경이 있습니다. 계속할까요?"
If yes, the changes will be preserved (core:pull only touches core paths).

### 2. Choose channel and run dry-run

Ask user:
```
[A] stable (기본) — 안정 버전
[B] beta — 최신 베타 버전
```

Run dry-run first to preview changes:

```bash
# Stable
node .docking/engine/fetch.js --check

# Beta
node .docking/engine/fetch.js --beta --check
```

Present the dry-run summary:
```
📦 업데이트 미리보기: v1.23.0 → v1.23.1

📝 적용 예정: N개 파일
🔀 머지 예정: 1개 (package.json)
⚠️  충돌 예상: N개 파일 (자동 해소됩니다)
🔄 Drift: N개 파일 (upstream으로 동기화)
```

### 3. Execute core:pull

```bash
# Stable
echo "y" | node .docking/engine/fetch.js

# Beta
echo "y" | node .docking/engine/fetch.js --beta
```

### 4. Post-pull conflict resolution

After core:pull completes, resolve all remaining conflicts:

#### 4a. Check backup manifest

```bash
ls -t .core-backup/ | head -1
```

Read the latest `.core-backup/*/manifest.json` to see what was backed up.

#### 4b. Resolve component/lib conflicts

For each file in the backup manifest:

**Pages** (`src/pages/`):
- Already auto-migrated to `src/pages/_local/` by fetch.js → no action needed
  - ⚠️ **단, `src/pages/admin/**`는 제외** — Core 버전을 항상 사용 (관리자 페이지는 자동 업데이트됨)
  - Admin 페이지는 `.core-backup/`에만 백업되고 `_local/`로 이전되지 않음
- Verify: check that the `_local/` version exists (admin 제외)

**Components** (`src/components/`):
- Copy backup to `src/plugins/local/components/{filename}`
- Create the directory if needed
- Update imports: the component can be imported from its new local path

**Libs** (`src/lib/`):
- Copy backup to `src/lib/local/{filename}`
- Create the directory if needed

**Other core files** (`src/layouts/`, `src/styles/`):
- These rarely conflict. If they do, inform user and show the diff between backup and new version
- Ask user if they want to keep their version (move to local path) or accept upstream

#### 4c. Fix broken imports in _local/ overrides

Scan all `src/pages/_local/**/*.astro` files for imports that reference core paths.
Check if those imported modules still exist at the same path.

```
For each _local/ file:
  Extract import paths (from '...', from "...")
  For imports starting with @/ or relative paths into src/:
    Check if target file exists
    If NOT → report: "import 경로가 변경되었습니다"
    Try to find the file at a new location (search by filename)
    If found → auto-fix the import path
    If not found → warn user
```

#### 4d. Fix pointer-stub files

Check for any remaining pointer-stub files that the doctor may have missed:

```bash
find src/pages/api -name "*.ts" -size -200c | while read f; do
  head -1 "$f" | grep -q '^\.\./\.\.' && echo "STUB: $f"
done
```

For each stub found:
- Check if the target file exists at the referenced path
- If yes → copy the actual content over the stub
- If no → restore from upstream using git: `git show v{version}:{path}`

### 5. Install dependencies

If package.json was modified (check git diff):

```bash
npm install
```

### 6. Build verification

```bash
npm run build 2>&1
```

- **Success**: Continue to deploy offer
- **Failure in _local/ code**: Fix the error (agent has write access to _local/)
  - Common fixes: update import paths, fix API changes
- **Failure in core code**: Trigger Bug Escalation per `/onboarding` rules
  - This means the new core version has a bug
  - Report to HQ and inform user

### 7. Health check

```bash
node scripts/health-audit.js
```

Score must be ≥ 50 to proceed. If below, run:

```bash
node scripts/health-audit.js --fix
```

### 8. Deploy offer

If build passes and health score ≥ 50:

```
✅ 업데이트 완료: v{old} → v{new}
   빌드 성공, 건강 점수: {score}/100

배포하시겠습니까? [Y/n]
```

If user accepts, run the Deploy Guardrails from `/onboarding`:
- Cloudflare auth check
- D1 placeholder check
- Build (already done, skip)
- Deploy
- Post-deploy remote migration
- Smoke test

### 9. Cleanup

After successful deploy (or if user declines deploy):

```
Check .core-backup/ for resolved conflicts:
  - If all files migrated to local paths → delete backup folder
  - If some remain → keep and inform user

Update .agent/softgate-state.json with last_update timestamp
```

### 10. Summary report

```
📦 Core Update 완료
━━━━━━━━━━━━━━━━━━

📌 버전: v1.23.0 → v1.23.1
📝 적용: 16개 파일
🔀 머지: package.json (새 의존성 2개 추가)
⚠️  충돌 해소:
   - src/pages/doctors/index.astro → _local/ 자동 이전
   - src/components/Header.tsx → plugins/local/ 이전
   - src/pages/admin/login.astro → Core 버전 사용 (admin은 _local로 이전되지 않음)
📦 npm install: 완료
🔨 빌드: 성공
🌐 배포: 완료 (https://www.example.com → 200)

💡 다음 안내:
   - _local/ 파일을 정기적으로 코어와 비교하세요
   - 코어 기능이 개선되면 _local/ 오버라이드가 불필요할 수 있습니다
```

## Conflict Resolution Rules

### What the agent resolves automatically

| Conflict Type | Resolution | Safe? |
|---------------|-----------|-------|
| Page in `src/pages/` | Already in `_local/` by fetch.js | ✅ Always safe |
| Component in `src/components/` | Copy to `src/plugins/local/components/` | ✅ Safe |
| Lib in `src/lib/` | Copy to `src/lib/local/` | ✅ Safe |
| Pointer-stub file | Replace with actual content or upstream | ✅ Safe |
| Broken import in `_local/` | Auto-fix path if target found | ✅ Safe |
| Missing npm dependency | `npm install` | ✅ Safe |
| Missing DB column | Schema doctor auto-fix | ✅ Safe |

### What requires user input

| Situation | Action |
|-----------|--------|
| Layout conflict (`src/layouts/`) | Ask: keep yours or accept upstream? |
| Style conflict (`src/styles/`) | Ask: keep yours or accept upstream? |
| Build error in core code | Bug Escalation to HQ |
| Health score < 50 after fix | Inform user, suggest manual review |

### What the agent never does

- Modify protected files (wrangler.toml, clinic.json)
- Delete user's _local/ overrides
- Force deploy without user confirmation
- Skip backup verification

## Bug Escalation

Same rules as `/onboarding` Bug Escalation section.
If the new core version causes build failures in core paths, report to HQ:

```
POST /api/support/bug
title: "core:pull v{version} — {error description}"
severity: "high" (blocks deployment)
```

## Triggers

User says: "업데이트", "코어풀", "core:pull", "core update", "버전 업데이트"

## All user-facing output in Korean
