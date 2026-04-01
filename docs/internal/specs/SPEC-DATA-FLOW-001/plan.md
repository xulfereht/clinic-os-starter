---
id: SPEC-DATA-FLOW-001
version: 1.0.0
status: draft
created: 2026-02-09
related_specs:
  - SPEC-AGENT-COMM-001
tags:
  - database
  - data-flow
  - support-agent
  - migration
---

# Implementation Plan: Support Agent Worker Data System Improvements

## Overview

This plan outlines the implementation of critical data integrity and performance improvements for the Support Agent Worker's data flow system.

## Milestones by Priority

### Primary Goal (P0) - Critical Issues Resolution

**Target**: Resolve CRIT-001, CRIT-002, CRIT-003
**Dependencies**: None
**Estimated Complexity**: Medium

**Tasks**:
1. Verify current database state
2. Create/enhance migration for missing tables
3. Test table creation in local environment
4. Apply migration to staging environment
5. Verify tables exist and are functional

**Success Criteria**:
- Both `conversational_states` and `conversation_turns` tables exist
- No runtime errors related to missing tables
- Conversation history storage functional

### Secondary Goal (P1) - Data Integrity Enforcement

**Target**: Resolve HIGH-001, HIGH-002, HIGH-003
**Dependencies**: Primary Goal complete
**Estimated Complexity**: High

**Tasks**:
1. Create composite indexes for query optimization
2. Implement foreign key constraint enforcement
3. Add ON DELETE CASCADE to all foreign keys
4. Create orphaned record detection queries
5. Build cleanup script for existing orphans
6. Test cascade delete behavior

**Success Criteria**:
- Foreign key constraints enforced
- Cascade deletes working correctly
- Zero orphaned records
- Query performance improved

### Tertiary Goal (P2) - Transaction and Validation

**Target**: Resolve MED-001, MED-002
**Dependencies**: Secondary Goal complete
**Estimated Complexity**: Medium

**Tasks**:
1. Implement transaction wrapping pattern
2. Add CHECK constraints for enum values
3. Create integration tests for transactions
4. Add data validation at database level

**Success Criteria**:
- All multi-step operations use transactions
- CHECK constraints preventing invalid data
- Atomic updates verified by tests

### Optional Goal (P3) - Observability Enhancement

**Target**: Resolve LOW-001, LOW-002
**Dependencies**: Tertiary Goal complete
**Estimated Complexity**: Low

**Tasks**:
1. Implement query performance monitoring
2. Add structured logging for data flow
3. Create metrics dashboard queries
4. Document observability patterns

**Success Criteria**:
- Slow queries identified and logged
- Structured logs for debugging
- Performance baseline established

## Technical Approach

### Phase 1: Migration Enhancement

**File**: `migrations/0920_conversation_turns.sql`

**Changes**:

1. Add PRAGMA for foreign key enforcement:
```sql
PRAGMA foreign_keys = ON;
```

2. Enhance existing table definitions with proper constraints

3. Add composite indexes for common query patterns:
```sql
-- Session-based queries with time ordering
CREATE INDEX IF NOT EXISTS idx_conversation_session_created
  ON conversation_turns(session_id, created_at DESC);

-- Phase-based queries
CREATE INDEX IF NOT EXISTS idx_conversational_state_phase
  ON conversational_states(current_phase);
```

**Testing Strategy**:
- Unit tests for migration idempotency
- Integration tests for constraint enforcement
- Performance benchmarks for index effectiveness

### Phase 2: Orphaned Record Cleanup

**File**: `migrations/cleanup_orphans.sql` (new)

**Content**:
```sql
-- Cleanup orphaned conversation_turns
DELETE FROM conversation_turns
WHERE session_id NOT IN (SELECT id FROM support_sessions);

-- Cleanup orphaned conversational_states
DELETE FROM conversational_states
WHERE session_id NOT IN (SELECT id FROM support_sessions);
```

**Testing Strategy**:
- Test with synthetic orphaned data
- Verify cleanup removes only orphans
- Confirm valid records preserved

### Phase 3: Code Enhancement

**File**: `support-agent-worker/src/lib/conversation.ts`

**Changes**:

1. Add transaction wrapping:
```typescript
export async function withTransaction<T>(
  env: Env,
  operation: (db: D1Database) => Promise<T>
): Promise<T> {
  // Implementation
}
```

2. Wrap multi-step operations in transactions:
- `createConversationalSession`
- `processTurnRequest`
- `updateConversationalState`

3. Add error handling for constraint violations

**Testing Strategy**:
- Unit tests for transaction rollback
- Integration tests for atomic operations
- Error injection tests for constraint violations

### Phase 4: Monitoring Implementation

**File**: `support-agent-worker/src/lib/monitoring.ts` (new)

**Content**:
```typescript
export async function monitoredQuery<T>(
  env: Env,
  sql: string,
  params: unknown[]
): Promise<D1Result<T>> {
  // Implementation with performance tracking
}

export function logDataFlow(operation: string, details: unknown): void {
  // Structured logging implementation
}
```

**Testing Strategy**:
- Unit tests for monitoring functions
- Verify slow query detection
- Test structured log format

## Migration Files to Create

### 1. Enhanced Migration

**File**: `migrations/0921_enhance_conversation_schema.sql`

**Purpose**: Add missing constraints, indexes, and cascade deletes

**Content**:
```sql
-- Migration: Enhance conversation schema with constraints and indexes
-- Related: SPEC-DATA-FLOW-001

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Add missing composite indexes
CREATE INDEX IF NOT EXISTS idx_conversation_session_created
  ON conversation_turns(session_id, created_at DESC)
  WHERE created_at > 0;

CREATE INDEX IF NOT EXISTS idx_conversational_state_phase
  ON conversational_states(current_phase)
  WHERE current_phase IS NOT NULL;

-- Ensure cascade deletes are set (recreate tables if needed)
-- Note: SQLite doesn't support ALTER TABLE ADD CONSTRAINT with CASCADE
-- May need to recreate tables for existing installations
```

### 2. Orphan Cleanup

**File**: `migrations/0922_cleanup_orphans.sql`

**Purpose**: Remove orphaned records before FK enforcement

**Content**:
```sql
-- Migration: Cleanup orphaned conversation records
-- Related: SPEC-DATA-FLOW-001

-- Report orphans before cleanup
SELECT 'orphaned_turns' as type, COUNT(*) as count
FROM conversation_turns
WHERE session_id NOT IN (SELECT id FROM support_sessions);

SELECT 'orphaned_states' as type, COUNT(*) as count
FROM conversational_states
WHERE session_id NOT IN (SELECT id FROM support_sessions);

-- Cleanup orphaned records
DELETE FROM conversation_turns
WHERE session_id NOT IN (SELECT id FROM support_sessions);

DELETE FROM conversational_states
WHERE session_id NOT IN (SELECT id FROM support_sessions);

-- Verify cleanup
SELECT 'cleanup_complete' as status,
  (SELECT COUNT(*) FROM conversation_turns) as total_turns,
  (SELECT COUNT(*) FROM conversational_states) as total_states;
```

### 3. Validation Migration

**File**: `migrations/0923_add_validation_checks.sql`

**Purpose**: Add CHECK constraints for data validation

**Content**:
```sql
-- Migration: Add validation CHECK constraints
-- Related: SPEC-DATA-FLOW-001

-- Note: SQLite doesn't support ALTER TABLE ADD CONSTRAINT
-- Tables need to be recreated with new constraints
-- This migration documents the required constraints
```

## Code Changes Required

### 1. Conversation Module Enhancement

**File**: `support-agent-worker/src/lib/conversation.ts`

**Changes**:
- Add `withTransaction` helper function
- Wrap `createConversationalSession` in transaction
- Wrap `processTurnRequest` in transaction
- Add constraint violation error handling
- Add retry logic for transient failures

### 2. Monitoring Module Creation

**File**: `support-agent-worker/src/lib/monitoring.ts` (new)

**Functions**:
- `monitoredQuery` - Wrapper for query execution with timing
- `logDataFlow` - Structured logging for data operations
- `getQueryMetrics` - Retrieve performance metrics

### 3. Type Updates

**File**: `support-agent-worker/src/types.ts`

**Additions**:
```typescript
export interface QueryMetrics {
  query: string;
  duration_ms: number;
  rows_affected: number;
  timestamp: number;
}

export interface DataFlowEvent {
  operation: string;
  table: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}
```

## Testing Strategy

### Unit Tests

**File**: `tests/support-agent/unit/test-data-flow.ts`

**Test Cases**:
1. Transaction wrapper commits on success
2. Transaction wrapper rolls back on failure
3. Monitored query logs slow queries
4. Orphan detection queries return correct results
5. CHECK constraints reject invalid values

### Integration Tests

**File**: `tests/support-agent/integration/test-conversation-db.ts`

**Test Cases**:
1. Cascade delete removes child records
2. Foreign key constraint prevents invalid inserts
3. Composite indexes improve query performance
4. Orphan cleanup preserves valid records
5. Transaction isolation prevents race conditions

### Performance Tests

**File**: `tests/support-agent/performance/test-query-performance.ts`

**Benchmarks**:
1. Session retrieval time (with and without indexes)
2. Insert time for new conversation turn
3. Cascade delete performance
4. Query performance under load

## Rollback Plan

### Migration Rollback

**Procedure**:
1. Keep migration files idempotent
2. Document table structure before migration
3. Create reverse migration file

**Reverse Migration**: `migrations/rollback_0921_enhance_conversation_schema.sql`

```sql
-- Drop new indexes
DROP INDEX IF EXISTS idx_conversation_session_created;
DROP INDEX IF EXISTS idx_conversational_state_phase;

-- Note: Cannot drop foreign keys without recreating tables in SQLite
-- Consider using feature flags to disable FK enforcement if needed
```

### Code Rollback

**Procedure**:
1. Git revert of code changes
2. Re-deploy previous version
3. Verify system functionality

**Feature Flag**: Add `DATA_FLOW_ENHANCEMENTS_ENABLED` environment variable to allow quick disable

## Dependencies

### Internal Dependencies

- **SPEC-AGENT-COMM-001**: Conversation system design
- **Existing Tests**: `tests/support-agent/test-conversation.ts`
- **Current Migration**: `migrations/0920_conversation_turns.sql`

### External Dependencies

- **D1 Database**: Cloudflare D1 with foreign key support
- **SQLite Version**: Compatible with D1's SQLite version
- **Workers Environment**: Cloudflare Workers runtime

## Risk Mitigation

### Risk: Migration Breaks Production

**Mitigation**:
- Test in staging environment first
- Create database backup before migration
- Use feature flags for gradual rollout
- Monitor error rates post-deployment

### Risk: Performance Regression

**Mitigation**:
- Benchmark before and after
- Profile queries with new indexes
- Monitor query execution times
- Have index removal plan ready

### Risk: Orphaned Records Prevent FK Creation

**Mitigation**:
- Run cleanup script before FK enforcement
- Verify cleanup results
- Handle remaining orphans with manual intervention
- Document orphaned record resolution

## Acceptance Criteria

Each phase must meet its success criteria before proceeding to the next phase. See `acceptance.md` for detailed acceptance criteria.

## Traceability

### Tag Mapping

| Task | Tag | Related Component |
|------|-----|-------------------|
| Migration Enhancement | data:migration:enhance | migrations/0921_enhance_conversation_schema.sql |
| Orphan Cleanup | data:cleanup:orphan | migrations/0922_cleanup_orphans.sql |
| Transaction Wrapping | data:transaction:implement | src/lib/conversation.ts |
| Monitoring | data:monitoring:implement | src/lib/monitoring.ts |
| Testing | data:test:coverage | tests/support-agent/test-data-flow.ts |
