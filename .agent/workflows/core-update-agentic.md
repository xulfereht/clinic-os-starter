---
description: Core update Agent-First workflow — safe update with 5-phase guardrails
category: dev
---

# Core Update (Agent-First)

Agent analyzes changes, user decides. 5-phase guardrail process.

## Risk Assessment

| Risk Factor | Impact | Guardrail |
|-------------|--------|-----------|
| File overwrite | Core files changed (except `_local/`) | Pre-report change list |
| DB schema change | Migration needed | Auto-backup + rollback ready |
| Dependency change | npm package versions | Test environment verification |
| Config change | wrangler.toml etc. | Diff display + user confirm |

## 5-Phase Process

### Phase 1: Pre-Flight (auto)
```bash
npm run agent:doctor -- --json
npm run agent:lifecycle -- --json
npm run agent:snapshot -- --reason=pre-core-pull
npm run core:status
```
Saves analysis to `.agent/core-update-state.json`: versions, file/db/dep changes, risk level, backup path.

### Phase 2: User Decision Gate
Present: current → target version, risk level, file changes, DB migrations, dependency changes, safety checks (`_local/` conflicts, breaking changes). User: proceed / view details / cancel.

### Phase 3: Step-by-Step Execution
1. File download (git fetch + apply)
2. Dependency update (npm install)
3. DB migration (apply new migrations)
4. Test build (npm run build)
5. Verification (admin access, core features)

Each step: report progress. On failure: auto-retry 3x → offer rollback or manual fix.

### Phase 4: User Verification
User checks: `npm run dev` → localhost:4321 → main features. Feedback: "works" → Phase 5 | "problem" → rollback options.

### Phase 5: Complete or Rollback
- Complete: delete core-update-state.json, update version info
- Rollback: `npm run core:rollback` (files + DB from backup)

## Risk-Based Handling

| Risk | Criteria | Behavior |
|------|----------|----------|
| 🟢 Low | <10 files, no DB migration, no breaking | Auto with single confirm |
| 🟡 Medium | 10-30 files, has migration, warnings | Confirm per step |
| 🔴 High | >30 files, major schema change, `_local/` conflicts | Detailed diff review required |

## Auto-Rollback Triggers
db_migration_failed, build_failed, core_file_corrupted, npm_install_failed, user_reported_issue.

## Commands
```bash
npm run core:pull -- --auto [--stable]  # Execute update
npm run core:rollback                    # Rollback to previous
npm run core:status                      # Current version info
```

## State File

`.agent/core-update-state.json`: phase (analysis→completed/rolled_back), versions, risk, steps with status, backup path, error info.

## Messages (ko)

### 업데이트 준비 완료
```
Core 업데이트를 준비했습니다.

현재: {current} → 대상: {target}
위험도: {risk_emoji} {risk_level}
파일 변경: {file_count}개
DB 마이그레이션: {migration_count}개

✅ 자동 백업 완료
✅ _local/ 파일 충돌 없음

[🚀 업데이트 진행] [🔍 상세 보기] [⏸️ 취소]
```

### 업데이트 완료
```
✅ Core 업데이트 완료: {target}
백업은 7일간 보관됩니다.
문제 발생 시 'npm run core:rollback'으로 복구 가능합니다.
```

### 문제 발생
```
⚠️ 문제를 확인했습니다. 롤백하시겠습니까?
[🔄 {previous}로 롤백] [🔧 문제 해결 시도] [📞 서포트 요청]
```
