---
id: SPEC-DATA-FLOW-001
version: 1.0.0
status: draft
created: 2026-02-09
author: moai
priority: P0
lifecycle_level: spec-anchored
related_specs:
  - SPEC-AGENT-COMM-001
tags:
  - database
  - data-flow
  - support-agent
  - migration
---

# Support Agent Worker Data System Review and Improvements

## Overview

This SPEC addresses critical data integrity and performance issues discovered in the Support Agent Worker's data flow system. The migration `0920_conversation_turns.sql` exists but requires comprehensive review and improvements to ensure data integrity, query performance, and proper cascade behavior.

### Critical Issues Found

**CRIT-001**: `conversational_states` table missing in production - causes runtime errors
**CRIT-002**: `conversation_turns` table missing in production - cannot store conversation history
**CRIT-003**: Migration not properly applied to all environments

### High Severity Issues

**HIGH-001**: Foreign key constraints not enforced consistently
**HIGH-002**: Missing composite indexes on frequently queried column combinations
**HIGH-003**: No cascade delete for orphaned records in child tables

### Medium/Low Priority Issues

**MED-001**: Transaction handling gaps in multi-step operations
**MED-002**: Data validation constraints at database level incomplete
**LOW-001**: Query performance monitoring not implemented
**LOW-002**: Observability for data flow issues limited

## Environment

### Current System

- **Database**: SQLite (D1 compatible)
- **Worker Environment**: Cloudflare Workers
- **Current Migration**: `migrations/0920_conversation_turns.sql`
- **Related Files**:
  - `support-agent-worker/src/lib/conversation.ts`
  - `tests/support-agent/test-conversation.ts`

### Constraints

- Must maintain backward compatibility with existing code
- Migration must be idempotent (safe to re-run)
- Cannot break existing conversations
- Must work within Cloudflare Workers D1 database limits

## Assumptions

### Technical Assumptions

| Assumption | Confidence | Evidence Basis | Risk if Wrong | Validation Method |
|------------|------------|----------------|---------------|-------------------|
| D1 supports foreign key constraints | High | D1 documentation | Cascade deletes fail | Run migration on test DB |
| Composite indexes supported | High | SQLite standard | Query performance degradation | Performance test after migration |
| ON DELETE CASCADE works | Medium | D1 limitations doc | Orphaned records | Integration test with delete |

### Business Assumptions

| Assumption | Confidence | Evidence Basis | Risk if Wrong | Validation Method |
|------------|------------|----------------|---------------|-------------------|
| Existing conversations must be preserved | High | Project requirement | Data loss | Verify row count before/after |
| Zero downtime required | Medium | Production environment | User impact | Staged deployment plan |

## EARS Requirements

### Critical Requirements (P0)

#### REQ-DATA-001: Missing Tables Creation
**WHEN** the migration is applied, **THE** system **SHALL** create both `conversational_states` and `conversation_turns` tables if they do not exist.

**Rationale**: CRIT-001 and CRIT-002 indicate these tables are missing in production, causing runtime errors.

#### REQ-DATA-002: Foreign Key Enforcement
**WHEN** inserting data into child tables, **THE** system **SHALL** enforce foreign key constraints to `support_sessions(id)`.

**Rationale**: HIGH-001 - Foreign keys not enforced consistently leads to data integrity issues.

#### REQ-DATA-003: Cascade Delete Implementation
**WHEN** a support session is deleted, **THE** system **SHALL** automatically delete all related conversational states and conversation turns.

**Rationale**: HIGH-003 - No cascade delete creates orphaned records.

### High Priority Requirements (P1)

#### REQ-DATA-004: Composite Index Creation
**THE** system **SHALL** create composite indexes on frequently queried column combinations to optimize join performance.

**Rationale**: HIGH-002 - Missing indexes on query patterns cause performance degradation.

#### REQ-DATA-005: Transaction Wrapping
**WHEN** performing multi-step database operations, **THE** system **SHALL** wrap operations in transactions to ensure atomicity.

**Rationale**: MED-001 - Transaction handling gaps cause partial updates.

#### REQ-DATA-006: Data Validation Constraints
**THE** system **SHALL** enforce CHECK constraints for enum values (role, current_phase) at database level.

**Rationale**: MED-002 - Data validation at DB level prevents invalid data insertion.

### Medium Priority Requirements (P2)

#### REQ-DATA-007: Query Performance Monitoring
**THE** system **SHALL** log query execution time for operations exceeding 100ms.

**Rationale**: LOW-001 - Performance monitoring identifies slow queries.

#### REQ-DATA-008: Orphaned Record Cleanup
**THE** system **SHALL** provide a mechanism to identify and clean up orphaned records from previous bugs.

**Rationale**: Legacy data cleanup required before enabling FK constraints.

### Optional Requirements (P3)

#### REQ-DATA-009: Observability Enhancement
**WHERE** possible, **THE** system **SHALL** provide structured logging for data flow operations.

**Rationale**: LOW-002 - Enhanced observability aids debugging.

## Specifications

### SP-DATA-001: Enhanced Schema Definition

```sql
-- Migration: conversation_turns table improvements
-- Description: Enhanced schema with proper constraints and indexes
-- Related: SPEC-DATA-FLOW-001, SPEC-AGENT-COMM-001

-- Enable foreign key enforcement (SQLite specific)
PRAGMA foreign_keys = ON;

-- CONVERSATION TURNS Table with enhanced constraints
CREATE TABLE IF NOT EXISTS conversation_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('coding_agent', 'support_agent')),
  content TEXT NOT NULL,
  context_data TEXT,  -- JSON string for extended context (AgentContext)
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (session_id) REFERENCES support_sessions(id) ON DELETE CASCADE
);

-- Composite Index for session-based queries with time ordering
CREATE INDEX IF NOT EXISTS idx_conversation_session_created
  ON conversation_turns(session_id, created_at DESC);

-- Index for role-based time-series queries
CREATE INDEX IF NOT EXISTS idx_conversation_role_created
  ON conversation_turns(role, created_at DESC);

-- Index for cleanup operations (time-based)
CREATE INDEX IF NOT EXISTS idx_conversation_created_at
  ON conversation_turns(created_at);

-- CONVERSATIONAL STATES Table with enhanced constraints
CREATE TABLE IF NOT EXISTS conversational_states (
  session_id TEXT PRIMARY KEY,
  current_phase TEXT NOT NULL CHECK(current_phase IN (
    'understanding', 'investigating', 'resolving', 'verifying'
  )),
  hypotheses TEXT DEFAULT '[]',  -- JSON array
  verified_facts TEXT DEFAULT '[]',  -- JSON array
  remaining_questions TEXT DEFAULT '[]',  -- JSON array
  context_summary TEXT,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (session_id) REFERENCES support_sessions(id) ON DELETE CASCADE
);

-- Index for phase-based queries
CREATE INDEX IF NOT EXISTS idx_conversational_state_phase
  ON conversational_states(current_phase);

-- Index for state updates (time-series)
CREATE INDEX IF NOT EXISTS idx_conversational_state_updated
  ON conversational_states(updated_at DESC);

-- Index for stale session detection
CREATE INDEX IF NOT EXISTS idx_conversational_state_stale
  ON conversational_states(updated_at);
```

### SP-DATA-002: Transaction Wrapping Pattern

```typescript
/**
 * Execute database operation within transaction
 */
export async function withTransaction<T>(
  env: Env,
  operation: (db: D1Database) => Promise<T>
): Promise<T> {
  // D1 supports transactions via batch operations
  // For complex operations, use explicit transaction management
  try {
    const result = await operation(env.DB);
    return result;
  } catch (error) {
    // Log transaction failure
    console.error('[DATA-FLOW] Transaction failed:', error);
    throw error;
  }
}
```

### SP-DATA-003: Orphaned Record Detection

```sql
-- Query to detect orphaned conversation_turns
SELECT ct.id, ct.session_id, ct.created_at
FROM conversation_turns ct
LEFT JOIN support_sessions ss ON ct.session_id = ss.id
WHERE ss.id IS NULL;

-- Query to detect orphaned conversational_states
SELECT cs.session_id, cs.updated_at
FROM conversational_states cs
LEFT JOIN support_sessions ss ON cs.session_id = ss.id
WHERE ss.id IS NULL;
```

### SP-DATA-004: Performance Monitoring Hooks

```typescript
interface QueryMetrics {
  query: string;
  duration_ms: number;
  rows_affected: number;
  timestamp: number;
}

export async function monitoredQuery<T>(
  env: Env,
  sql: string,
  params: unknown[]
): Promise<D1Result<T>> {
  const start = performance.now();
  const result = await env.DB.prepare(sql).bind(...params).all<T>();
  const duration = performance.now() - start;

  if (duration > 100) {
    console.warn(`[DATA-FLOW] Slow query (${duration.toFixed(2)}ms):`, sql);
  }

  return result;
}
```

## Traceability

### Tag Mapping

| Requirement ID | Tag | Related Component |
|----------------|-----|-------------------|
| REQ-DATA-001 | data:tables:create | migrations/0920_conversation_turns.sql |
| REQ-DATA-002 | data:fk:enforce | migrations/0920_conversation_turns.sql |
| REQ-DATA-003 | data:cascade:delete | migrations/0920_conversation_turns.sql |
| REQ-DATA-004 | data:index:composite | migrations/0920_conversation_turns.sql |
| REQ-DATA-005 | data:transaction | src/lib/conversation.ts |
| REQ-DATA-006 | data:validation:check | migrations/0920_conversation_turns.sql |
| REQ-DATA-007 | data:monitor:query | src/lib/monitoring.ts |
| REQ-DATA-008 | data:cleanup:orphan | migrations/cleanup_orphans.sql |
| REQ-DATA-009 | data:logging:structured | src/lib/logging.ts |

### Implementation Mapping

- `migrations/0920_conversation_turns.sql` - Enhanced schema with all constraints and indexes
- `support-agent-worker/src/lib/conversation.ts` - Transaction wrapping implementation
- `support-agent-worker/src/lib/monitoring.ts` - Query performance monitoring (new)
- `migrations/cleanup_orphans.sql` - Orphaned record cleanup (new)
- `tests/support-agent/test-data-flow.ts` - Integration tests for data flow (new)

## Dependencies

### Required Dependencies

- **D1 Database**: Cloudflare D1 with foreign key support
- **Existing Migration**: `migrations/0920_conversation_turns.sql` must be enhanced
- **Related SPEC**: SPEC-AGENT-COMM-001 for conversation system context

### Related Code

- `support-agent-worker/src/lib/conversation.ts` - Main conversation management
- `support-agent-worker/src/types.ts` - Type definitions
- `tests/support-agent/test-conversation.ts` - Existing test suite

## Risks

### Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Foreign key enforcement breaks existing code | High | Medium | Test in staging first, add FK checks gradually |
| Migration fails in production | Critical | Low | Idempotent migration, rollback plan ready |
| Performance degradation from new indexes | Medium | Low | Benchmark before/after, index optimization |
| Orphaned records prevent FK creation | High | Medium | Cleanup script runs before FK enforcement |

### Rolling Back Plan

1. **Migration Rollback**: Keep `migrations/0920_conversation_turns.sql` idempotent
2. **Code Rollback**: Git revert of conversation.ts changes
3. **Data Rollback**: Pre-migration database snapshot (if possible in D1)
4. **Feature Flag**: Environment variable to disable new constraints temporarily

## Success Criteria

### Data Integrity

- Zero orphaned records after cleanup
- All foreign key constraints enforced
- Cascade deletes working correctly

### Performance

- Query time for session retrieval < 50ms (P95)
- Insert time for new turn < 10ms (P95)
- No performance regression from indexes

### Quality Gates

- All integration tests passing
- Zero D1 errors in production logs
- LSP zero errors, zero warnings
