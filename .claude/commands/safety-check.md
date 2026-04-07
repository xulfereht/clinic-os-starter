# /safety-check — Protection Rule Sync Verifier
> **Scope: local** — Runs in client repos. Also useful in master to verify manifest consistency.

> **Role**: Protection Auditor
> **Cognitive mode**: Compare, verify, surface drift. Trust the manifest as SOT — everything else must match it.

## When to Use

- After `core:pull` — verify protection rules propagated correctly
- After editing `.docking/protection-manifest.yaml` — check consumers are in sync
- After running `generate-protection-docs.js` — verify output matches
- Before deploy — ensure no protection drift that could expose client files
- Periodic audit — catch manual edits that bypass the manifest

## SOT (Single Source of Truth)

`.docking/protection-manifest.yaml`

## Procedure

1. Read `.docking/protection-manifest.yaml` (SOT).

2. Extract actual paths from each consumer file:
   - `.docking/engine/fetch.js`: CORE_PATHS, LOCAL_PREFIXES, PROTECTED_EXACT, PROTECTED_PREFIXES, SPECIAL_MERGE_FILES
   - `.claude/rules/clinic-os-safety.md`: HARD rule path lists
   - `.claude/settings.json`: deny/allow rules

3. Compare the SOT against each consumer and report discrepancies:

### Comparison Matrix

| Comparison Item | SOT Key | Consumer |
|-----------------|---------|----------|
| Core paths | `core_paths` | fetch.js fallback CORE_PATHS |
| Core paths | `core_paths` | safety.md HARD rules |
| Core paths | `core_paths` | settings.json deny |
| Protected files | `protected_exact` | fetch.js fallback PROTECTED_EXACT |
| Protected files | `protected_exact` | safety.md protected config |
| Local paths | `local_prefixes` | fetch.js fallback LOCAL_PREFIXES |
| Local paths | `local_prefixes` | safety.md local/ rules |
| Local paths | `local_prefixes` | settings.json allow |

4. Check auto-generated file status:
   - Running `scripts/generate-protection-docs.js` regenerates safety.md and settings.json from the manifest
   - Warn if manual edits are detected

## Output

Present a synchronization report in Korean:
- Number of matching/mismatching items
- Mismatch details (what is missing and where)
- Suggested fix: since the manifest is the SOT, either fix the consumers or run `node scripts/generate-protection-docs.js`

If all sources match: output "모든 보호 규칙이 매니페스트(SOT)와 동기화되어 있습니다."

## Recovery

If mismatches are found:

```bash
# Auto-fix: regenerate consumers from manifest
node scripts/generate-protection-docs.js
```

If the manifest itself seems wrong (paths missing that should be protected):
- Check `.docking/config.yaml` for `protected_pages` / `protected_prefixes`
- Report to user and suggest manifest update

## Triggers

- "보호 규칙 확인", "safety check", "protection sync"
- "매니페스트 검증", "파일 보호 상태"
- Automatically suggested after `core:pull` completes

## All user-facing output in Korean.
