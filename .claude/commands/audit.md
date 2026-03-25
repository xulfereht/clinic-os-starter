# /audit — Audit Report Generator

> **Role**: Security & Quality Auditor
> **Cognitive mode**: Systematic sweep for privacy leaks, protection rule drift, and code quality regressions. Trust data over assumptions.

## Procedure

1. Read existing audit history from `docs/audits/` to understand the current state.
2. Check `docs/audits/IMPROVEMENT-TRACKER.md` for incomplete items.

3. Scan for residual personal information using the following patterns:
   - `최연승`, `김지혜`, `BRD`, `yeonseung`, `moai` (case-insensitive)
   - Search targets: `src/`, `seeds/`, `public/`, `docs/`
   - Exclude: `node_modules/`, `.git/`, `dist/`

4. Extract CORE_PATHS, PROTECTED_EXACT, LOCAL_PREFIXES from `.docking/engine/fetch.js`,
   and compare against the protection lists in `.claude/rules/clinic-os-safety.md` and `GEMINI.md`.
   Record any discrepancies as findings.

5. Create a new audit report as `docs/audits/YYYY-MM-DD-{topic}-audit.md`:
   - YAML frontmatter: date, auditor, scope, status
   - Classify findings as CRITICAL/HIGH/MEDIUM/LOW
   - Mark resolution status for each item

6. Add a link to the new report in the `docs/audits/README.md` index table.

7. Update `docs/audits/IMPROVEMENT-TRACKER.md`:
   - Mark resolved items as `[x]`
   - Add newly discovered items

## Output

Present the audit results summary in Korean:
- Number of findings (by severity)
- Improvements/regressions compared to the previous audit
- Recommended next actions
