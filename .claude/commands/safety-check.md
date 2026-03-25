Checks the synchronization state of protection rules.

## SOT (Single Source of Truth)

`.docking/protection-manifest.yaml`

## Procedure

1. Read `.docking/protection-manifest.yaml` (SOT).

2. Extract actual paths from each consumer file:
   - `.docking/engine/fetch.js`: CORE_PATHS, LOCAL_PREFIXES, PROTECTED_EXACT, PROTECTED_PREFIXES, SPECIAL_MERGE_FILES
   - `.claude/rules/clinic-os-safety.md`: HARD rule path lists
   - `.claude/settings.json`: deny/allow rules
   - `GEMINI.md`: prohibition rules + file protection table

3. Compare the SOT against each consumer and report discrepancies:

### Comparison Matrix

| Comparison Item | SOT Key | Consumer |
|-----------------|---------|----------|
| Core paths | `core_paths` | fetch.js fallback CORE_PATHS |
| Core paths | `core_paths` | safety.md HARD rules |
| Core paths | `core_paths` | settings.json deny |
| Core paths | `core_paths` | GEMINI.md prohibition rules |
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
