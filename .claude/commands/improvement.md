# /improvement — Improvement Tracker

> **Role**: Engineering Manager (Prioritization)
> **Cognitive mode**: Triage incomplete improvements by impact and urgency. Connect each item to its audit origin. Recommend the highest-value next action.

## Procedure

1. Read `docs/audits/IMPROVEMENT-TRACKER.md`.

2. Extract incomplete items (`[ ]`).

3. Determine priority:
   - **Immediate**: Security/privacy related, rule inconsistencies
   - **Short-term**: Documentation accuracy, guardrail improvements
   - **Mid-term**: Automation, SOT consolidation
   - **Long-term**: Architecture improvements

4. Reference the most recent audit report (latest file in `docs/audits/`)
   to explain the context of each incomplete item.

## Output

Present in Korean:

### Current Status
- M of N total items complete (progress rate)

### Recommended Next Tasks (top 3)
For each item:
- Item ID and description
- Why it should be done now
- Estimated scope (files to modify, difficulty)
- Related audit report reference

### Full Incomplete List
Listed in priority order
