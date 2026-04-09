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

# Acceptance Criteria: Support Agent Worker Data System Improvements

## Overview

This document defines the acceptance criteria for the Support Agent Worker data system improvements. Each criterion includes testable scenarios in Given-When-Then format.

## Quality Gates

### Pre-Implementation Gates

- [ ] All existing tests passing
- [ ] LSP baseline captured (zero errors, zero warnings)
- [ ] Database backup created
- [ ] Staging environment available

### Post-Implementation Gates

- [ ] All new tests passing
- [ ] All existing tests still passing
- [ ] LSP zero errors, zero warnings
- [ ] No performance regression
- [ ] Production deployment verified

## Critical Acceptance Criteria (P0)

### AC-DATA-001: Table Creation Verification

**Requirement**: REQ-DATA-001 - Missing Tables Creation

**Given**: The migration has been applied
**When**: Querying the database schema
**Then**:
- `conversational_states` table exists
- `conversation_turns` table exists
- All required columns present
- All CHECK constraints defined

**Test Scenario**:
```sql
-- Verify tables exist
SELECT name FROM sqlite_master
WHERE type='table'
AND name IN ('conversational_states', 'conversation_turns');

-- Expected: 2 rows returned
```

### AC-DATA-002: Foreign Key Enforcement

**Requirement**: REQ-DATA-002 - Foreign Key Enforcement

**Given**: A support session does not exist
**When**: Attempting to insert a conversation turn with invalid session_id
**Then**:
- Insert fails with foreign key constraint error
- No orphaned record created
- Error message clearly indicates FK violation

**Test Scenario**:
```typescript
// Test invalid insert
const invalidSessionId = 'non-existent-session';
await expect(
  addConversationTurn(env, invalidSessionId, 'support_agent', 'test')
).rejects.toThrow(/foreign key constraint/i);
```

### AC-DATA-003: Cascade Delete Behavior

**Requirement**: REQ-DATA-003 - Cascade Delete Implementation

**Given**: A support session exists with related conversation records
**When**: The support session is deleted
**Then**:
- All related conversation_turns are deleted
- Related conversational_state is deleted
- No orphaned records remain
- Delete operation completes in < 100ms

**Test Scenario**:
```typescript
// Test cascade delete
const sessionId = 'test-session';
await createConversationalSession(env, sessionId);
await addConversationTurn(env, sessionId, 'support_agent', 'test message');

// Delete session (should cascade)
await env.DB.prepare('DELETE FROM support_sessions WHERE id = ?')
  .bind(sessionId).run();

// Verify cascaded deletes
const turns = await env.DB.prepare(
  'SELECT COUNT(*) as count FROM conversation_turns WHERE session_id = ?'
).bind(sessionId).first<{ count: number }>();

const states = await env.DB.prepare(
  'SELECT COUNT(*) as count FROM conversational_states WHERE session_id = ?'
).bind(sessionId).first<{ count: number }>();

expect(turns?.count).toBe(0);
expect(states?.count).toBe(0);
```

## High Priority Acceptance Criteria (P1)

### AC-DATA-004: Composite Index Performance

**Requirement**: REQ-DATA-004 - Composite Index Creation

**Given**: A session with 1000 conversation turns
**When**: Querying turns by session_id with ordering
**Then**:
- Query executes in < 50ms (P95)
- Query plan shows index usage
- No full table scan occurs

**Test Scenario**:
```typescript
// Performance test
const sessionId = 'perf-test-session';
// Create 1000 turns...

const start = performance.now();
const result = await env.DB.prepare(
  'SELECT * FROM conversation_turns WHERE session_id = ? ORDER BY created_at DESC'
).bind(sessionId).all();
const duration = performance.now() - start;

expect(duration).toBeLessThan(50); // P95 requirement
```

### AC-DATA-005: Transaction Atomicity

**Requirement**: REQ-DATA-005 - Transaction Wrapping

**Given**: A multi-step operation that fails mid-transaction
**When**: An error occurs during the operation
**Then**:
- All changes are rolled back
- Database state unchanged from before operation
- No partial updates exist
- Error is logged with context

**Test Scenario**:
```typescript
// Test transaction rollback
const sessionId = 'transaction-test-session';

await expect(async () => {
  await withTransaction(env, async (db) => {
    await createConversationalSession(env, sessionId);
    await addConversationTurn(env, sessionId, 'support_agent', 'turn 1');
    throw new Error('Simulated failure'); // Should cause rollback
  });
}).rejects.toThrow('Simulated failure');

// Verify rollback - session should not exist
const session = await getConversationalSession(env, sessionId);
expect(session).toBeNull();
```

### AC-DATA-006: CHECK Constraint Validation

**Requirement**: REQ-DATA-006 - Data Validation Constraints

**Given**: An attempt to insert invalid enum values
**When**: Inserting with role='invalid_role' or current_phase='invalid_phase'
**Then**:
- Insert fails with CHECK constraint error
- Clear error message indicating constraint violation
- No invalid data in database

**Test Scenario**:
```typescript
// Test invalid role
await expect(
  env.DB.prepare(
    'INSERT INTO conversation_turns (session_id, role, content) VALUES (?, ?, ?)'
  ).bind('session-id', 'invalid_role', 'content').run()
).rejects.toThrow(/CHECK constraint/i);

// Test invalid phase
await expect(
  env.DB.prepare(
    'INSERT INTO conversational_states (session_id, current_phase) VALUES (?, ?)'
  ).bind('session-id', 'invalid_phase').run()
).rejects.toThrow(/CHECK constraint/i);
```

## Medium Priority Acceptance Criteria (P2)

### AC-DATA-007: Query Performance Monitoring

**Requirement**: REQ-DATA-007 - Query Performance Monitoring

**Given**: Query execution monitoring is enabled
**When**: A query takes longer than 100ms
**Then**:
- Query is logged as slow
- Log includes query, duration, and timestamp
- Alert is generated for investigation

**Test Scenario**:
```typescript
// Mock slow query
const slowQuery = async () => {
  await new Promise(resolve => setTimeout(resolve, 150));
  return env.DB.prepare('SELECT * FROM conversation_turns').all();
};

// Verify logging
const consoleSpy = vi.spyOn(console, 'warn');
await monitoredQuery(env, 'SELECT * FROM conversation_turns', []);

expect(consoleSpy).toHaveBeenCalledWith(
  expect.stringContaining('[DATA-FLOW] Slow query')
);
```

### AC-DATA-008: Orphaned Record Cleanup

**Requirement**: REQ-DATA-008: Orphaned Record Cleanup

**Given**: Orphaned records exist from previous bugs
**When**: Running the cleanup migration
**Then**:
- Orphaned records are identified and reported
- Only orphans are deleted
- Valid records are preserved
- Cleanup summary is logged

**Test Scenario**:
```typescript
// Create orphaned record
await env.DB.prepare(
  'INSERT INTO conversation_turns (session_id, role, content) VALUES (?, ?, ?)'
).bind('orphan-session', 'support_agent', 'orphaned content').run();

// Run cleanup
const result = await env.DB.prepare(
  'DELETE FROM conversation_turns WHERE session_id NOT IN (SELECT id FROM support_sessions)'
).run();

// Verify cleanup
expect(result.meta.changes).toBeGreaterThan(0);

const remaining = await env.DB.prepare(
  'SELECT COUNT(*) as count FROM conversation_turns WHERE session_id = ?'
).bind('orphan-session').first<{ count: number }>();

expect(remaining?.count).toBe(0);
```

## Integration Test Scenarios

### Scenario 1: Complete Conversation Flow

**Given**: A new support session is created
**When**: Processing a complete conversation with multiple turns
**Then**:
- Session state is correctly maintained
- All turns are stored with proper relationships
- Phase transitions work correctly
- Cascade delete works when session is removed

**Test Steps**:
```typescript
describe('Complete Conversation Flow', () => {
  it('should maintain data integrity throughout conversation', async () => {
    const sessionId = 'integration-test-session';

    // Create session
    await createConversationalSession(env, sessionId);
    let session = await getConversationalSession(env, sessionId);
    expect(session).toBeDefined();
    expect(session?.current_state.phase).toBe('understanding');

    // Add turns
    await addConversationTurn(env, sessionId, 'coding_agent', 'Problem: X error');
    await addConversationTurn(env, sessionId, 'support_agent', 'Solution: Try Y');

    // Update state
    await updateConversationalState(env, sessionId, {
      phase: 'investigating',
      verified_facts: ['Fact 1', 'Fact 2']
    });

    // Verify state
    session = await getConversationalSession(env, sessionId);
    expect(session?.turns.length).toBe(2);
    expect(session?.current_state.phase).toBe('investigating');
    expect(session?.current_state.verified_facts).toHaveLength(2);

    // Test cascade delete
    await env.DB.prepare('DELETE FROM support_sessions WHERE id = ?')
      .bind(sessionId).run();

    const deletedSession = await getConversationalSession(env, sessionId);
    expect(deletedSession).toBeNull();
  });
});
```

### Scenario 2: Concurrent Session Handling

**Given**: Multiple sessions processing simultaneously
**When**: Concurrent operations occur
**Then**:
- No session data crosses between sessions
- Transactions maintain isolation
- No deadlocks occur
- All operations complete successfully

### Scenario 3: Large Conversation History

**Given**: A session with 10,000 conversation turns
**When**: Querying conversation history
**Then**:
- Query completes in < 100ms (P95)
- Pagination works correctly
- Memory usage remains stable
- No connection pool exhaustion

## Performance Benchmarks

### Query Performance Targets

| Query | Target (P50) | Target (P95) | Target (P99) |
|-------|-------------|-------------|-------------|
| Get session by ID | < 10ms | < 25ms | < 50ms |
| Get conversation turns | < 20ms | < 50ms | < 100ms |
| Insert new turn | < 5ms | < 10ms | < 25ms |
| Update state | < 10ms | < 25ms | < 50ms |
| Cascade delete session | < 25ms | < 75ms | < 150ms |

### Index Effectiveness Metrics

- **Index Hit Ratio**: > 95% for indexed queries
- **Full Table Scans**: 0 for common query patterns
- **Query Plan Score**: All queries use optimal indexes

## Definition of Done

A requirement is considered complete when:

1. **Implementation**: Code is written and committed
2. **Testing**: All test scenarios pass
3. **Documentation**: Code is documented with comments
4. **Review**: Code has been peer-reviewed
5. **Integration**: Changes are integrated with main branch
6. **Verification**: Production deployment verified

## Traceability

### Acceptance Criteria to Requirements Mapping

| AC ID | Requirement ID | Tag |
|-------|----------------|-----|
| AC-DATA-001 | REQ-DATA-001 | data:ac:table_creation |
| AC-DATA-002 | REQ-DATA-002 | data:ac:fk_enforce |
| AC-DATA-003 | REQ-DATA-003 | data:ac:cascade_delete |
| AC-DATA-004 | REQ-DATA-004 | data:ac:composite_index |
| AC-DATA-005 | REQ-DATA-005 | data:ac:transaction |
| AC-DATA-006 | REQ-DATA-006 | data:ac:check_constraint |
| AC-DATA-007 | REQ-DATA-007 | data:ac:monitoring |
| AC-DATA-008 | REQ-DATA-008 | data:ac:orphan_cleanup |

### Test File Mapping

| Test File | Coverage |
|-----------|----------|
| tests/support-agent/unit/test-data-flow.ts | AC-DATA-005, AC-DATA-006, AC-DATA-007 |
| tests/support-agent/integration/test-conversation-db.ts | AC-DATA-001, AC-DATA-002, AC-DATA-003 |
| tests/support-agent/performance/test-query-performance.ts | AC-DATA-004 |
| tests/support-agent/integration/test-cleanup.ts | AC-DATA-008 |

## Verification Methods

### Automated Verification

- Unit tests for all individual components
- Integration tests for complete workflows
- Performance tests for benchmark verification
- Linting and type checking

### Manual Verification

- Manual testing in staging environment
- Database schema inspection
- Query plan analysis
- Performance profiling

### Production Verification

- Monitor error rates post-deployment
- Check query performance metrics
- Verify cascade delete behavior
- Confirm no orphaned records exist
