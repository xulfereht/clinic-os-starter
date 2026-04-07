# /core-update — Post-Update Conflict Resolution & Deploy

> **Role**: Update Engineer
> **Cognitive mode**: Pull, resolve, verify, deploy. Protect client customizations while applying upstream changes.

Runs `core:pull`, resolves conflicts automatically, verifies the build, and optionally deploys.
Designed for non-technical clients who need a one-shot update experience.
Primarily for client repos.

## When to Use

- New core version available — "업데이트 해", "코어풀"
- After master releases a new version — client needs to sync
- Recovering from a broken update — "업데이트 실패했어"
- Checking available updates — "새 버전 있어?"

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

### 4. Post-pull: audit-local + conflict resolution

core:pull이 완료되면 `audit-local.js`가 자동 실행됩니다.
결과를 확인하고 각 항목을 처리합니다.

#### 4a. audit-local 결과 확인

core:pull 끝에 자동으로 표시됩니다. 수동 실행도 가능:

```bash
node scripts/audit-local.js
```

결과 카테고리별 처리:

| 카테고리 | 의미 | 처리 |
|---------|------|------|
| **STALE** | 코어와 동일하거나 열화된 _local | **즉시 삭제** — 코어 업데이트를 차단하고 있음 |
| **DRIFT** | 코어와 차이 있는 _local | diff 확인 → 코어가 더 나으면 삭제, _local이 필요하면 유지 |
| **ORPHAN** | 코어에 없는 _local | 더 이상 필요 없으면 삭제, 커스텀이면 유지 |
| **ADMIN** | admin 페이지 오버라이드 | 빌드 시 무시됨 — 삭제 권장 |
| **OK** | 진짜 커스텀 | 유지 |

```bash
# STALE + ORPHAN 자동 삭제
node scripts/audit-local.js --auto-clean
```

#### 4b. 충돌 백업 확인

충돌 파일은 `.core-backup/`에 백업됩니다 (자동). 확인:

```bash
ls -t .core-backup/ | head -1
cat .core-backup/$(ls -t .core-backup/ | head -1)/manifest.json
```

**기본 동작: 새 코어 버전을 사용.** 이전 버전이 필요한 경우에만:
```bash
# 백업에서 _local로 복원 (의도적으로 코어를 오버라이드할 때만)
cp .core-backup/{날짜}/{파일경로} src/pages/_local/{파일경로}
```

⚠️ **_local로 복원하면 이후 코어 업데이트가 해당 파일에 적용되지 않습니다.**
반드시 이유를 기록하세요: `.agent/core-patches.log`

#### 4c. _local import 검증

기존 _local 파일의 import가 코어 변경으로 깨졌는지 확인:

```
For each _local/ file:
  Extract import paths
  Check if target file exists
  If NOT → auto-fix or warn user
```

#### 4d. Pointer-stub 복구

```bash
find src/pages/api -name "*.ts" -size -200c | while read f; do
  head -1 "$f" | grep -q '^\.\./\.\.' && echo "STUB: $f"
done
```

Stub 발견 시 upstream에서 실제 파일로 교체.

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

```bash
# 오래된 백업/스냅샷 자동 정리 (최근 5개 보존)
node scripts/cleanup.js
```

Update `.agent/softgate-state.json` with last_update timestamp.

### 10. Summary report

```
📦 Core Update 완료
━━━━━━━━━━━━━━━━━━

📌 버전: v1.23.0 → v1.23.1
📝 적용: 16개 파일
🔀 머지: package.json (새 의존성 2개 추가)
⚠️  충돌: 2개 → .core-backup/에 백업됨
🔍 _local 감사: STALE 3개 삭제, DRIFT 1개 검토, OK 2개 유지
🧹 정리: 백업 68→5개, 스냅샷 32→5개 (60MB 확보)
📦 npm install: 완료
🔨 빌드: 성공
🌐 배포: 완료 (https://www.example.com → 200)

💡 다음 안내:
   - _local은 코어 업데이트를 차단합니다. 최소한으로 유지하세요.
   - audit-local.js로 수시 점검: node scripts/audit-local.js
   - _local 생성 시 이유를 .agent/core-patches.log에 기록하세요.
```

## Conflict Resolution Rules

### What the agent resolves automatically

| Conflict Type | Resolution | Safe? |
|---------------|-----------|-------|
| STALE _local (audit-local) | Delete — 코어와 동일하거나 열화 | ✅ Safe |
| ORPHAN _local (audit-local) | Delete — 코어에 없음 | ✅ Safe |
| ADMIN _local | Delete — 빌드 시 무시됨 | ✅ Safe |
| Pointer-stub file | Replace with upstream content | ✅ Safe |
| Broken import in `_local/` | Auto-fix path if target found | ✅ Safe |
| Missing npm dependency | `npm install` | ✅ Safe |
| Missing DB column | Schema doctor auto-fix | ✅ Safe |
| Old backups/snapshots | `cleanup.js` — 최근 5개 보존 | ✅ Safe |

### What requires user input

| Situation | Action |
|-----------|--------|
| DRIFT _local (audit-local) | Show diff → 코어 수용 or _local 유지? |
| 충돌 파일 복원 요청 | .core-backup/ → _local/ 복사 (이유 기록 필수) |
| Build error in core code | Bug Escalation to HQ |
| Health score < 50 after fix | Inform user, suggest manual review |

### What the agent never does

- Modify protected files (wrangler.toml, clinic.json)
- **자동으로 _local 생성** — 충돌 시 백업만, _local 복사는 사용자 결정
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
