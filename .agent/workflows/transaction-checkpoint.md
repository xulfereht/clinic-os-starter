---
description: Transaction & checkpoint system — Git-based rollback for all agent work
category: dev
---

# Transaction & Checkpoint System

All agent work is wrapped in Git-based transactions. Checkpoint before work, commit on success, rollback on failure.

## Flow

```
Lock acquire → Checkpoint create (git commit + tag) → Work execute
  → Success: git commit + audit log + lock release
  → Failure: git checkout [checkpoint] + audit log + lock release
```

## Work Lock

**File**: `.agent/work.lock` — one agent at a time, 30min TTL, 5min heartbeat refresh.

```json
{ "lockId", "acquiredBy", "acquiredAt", "expiresAt", "currentTask", "checkpointRef" }
```

Timeout → auto-release on next agent entry.

## Checkpoints

Checkpoint = git commit + tag. Format: `checkpoint-before-{task}-{YYYYMMDD-HHMMSS}`

```bash
# Create checkpoint before risky work
git stash push -m "checkpoint-stash-$name"
git add -A && git commit --allow-empty -m "checkpoint: $message"
git tag -a "checkpoint-$name-$(date +%Y%m%d-%H%M%S)" -m "Checkpoint: $message"
```

## Audit Trail

**File**: `.agent/audit.log` (JSON Lines)
Events: SESSION_START, LOCK_ACQUIRED, CHECKPOINT_CREATED, WORK_COMPLETED, STEP_FAILED, ROLLBACK_EXECUTED, LOCK_RELEASED.
Security: never log passwords, API keys, or sensitive patient data.

## Rollback

```bash
npm run tx:rollback              # Last checkpoint
npm run tx:rollback -- --to=TAG  # Specific checkpoint
npm run tx:list                  # List all checkpoints
```

## Commands

```bash
# Lock
npm run tx:lock                  # Acquire
npm run tx:unlock                # Release
npm run tx:lock-status           # Status

# Checkpoint
npm run tx:checkpoint            # Manual create
npm run tx:rollback              # Rollback
npm run tx:list                  # List

# Error recovery
npm run error:status             # Check error state
npm run error:recover            # Auto-recover
npm run error:recover -- --force # Force recover
npm run error:resolve            # Mark resolved

# Unified
npm run status                   # Install + onboarding + health + lock
```

## Recovery Scenarios

| Scenario | Resolution |
|----------|------------|
| SIGKILL during work | Lock times out → next agent reads last-checkpoint.txt → rollback or retry |
| User deletes file | `npm run tx:rollback` → restore from last checkpoint |
| Two agents conflict | Second agent sees lock → wait or `--force-lock` |

## State File

`.agent/transaction-state.json`: current transaction (id, task, checkpoint, status) + history array.
