# Acceptance Criteria - SPEC-CONTEXT-001

## AC-CTX-001: Query Intent Analysis

### Scenario: Code-related query with error

**Given**:
- User queries: "pages/API 라우터에서 오류가 발생해"
- System has query intent analyzer configured

**When**:
- Query is received

**Then**:
- Query type is classified as `code`
- Urgency is `high`
- File mentions include `src/pages/api/`
- Error context is captured
- Response time < 10ms

### Verification Steps

1. Send test query with error keywords
2. Verify intent classification
3. Check error context extraction
4. Measure response time

---

## AC-CTX-002: Automatic Code Change Detection

### Scenario: GitHub push triggers indexing

**Given**:
- GitHub repository is configured
- Webhook endpoint is deployed
- Vectorize index exists

**When**:
- Developer pushes code changes to GitHub
- Webhook event is received

**Then**:
- Changed files are identified
- Vectorize index is updated incrementally
- Metadata is saved to D1
- Process completes within 5 minutes (PERF-CTX-001)

### Verification Steps

1. Push code change to test repository
2. Verify webhook is called
3. Check Vectorize index for new content
4. Verify D1 metadata is updated
5. Measure total processing time

---

## AC-CTX-003: Code Freshness Verification

### Scenario: Index is stale

**Given**:
- Code was changed 2 hours ago
- Index was not updated

**When**:
- User queries the system
- Freshness check runs

**Then**:
- Staleness is detected (`stale` status)
- Warning is shown to user
- Recommendation to reindex is provided
- Check completes in < 100ms

### Verification Steps

1. Modify code without triggering webhook
2. Wait for index to become stale
3. Send query and check freshness
4. Verify warning is displayed
5. Measure check time

---

## AC-CTX-004: Knowledge-based Query

### Scenario: Abstract question about system

**Given**:
- User queries: "예약 시스템은 어떻게 작동하나?"
- No specific files mentioned

**When**:
- Query is analyzed
- Search strategy is selected

**Then**:
- Query type is `knowledge`
- Specificity is `abstract`
- Knowledge base search is prioritized
- Similar sessions are searched first
- Code search is optional

### Verification Steps

1. Send abstract query
2. Verify knowledge prioritization
3. Check similar session results
4. Verify response includes knowledge from sessions

---

## AC-CTX-005: Hybrid Search

### Scenario: Mixed query requiring both code and knowledge

**Given**:
- User queries: "pages API에서 D1 연동 오류가 나"
- Combines file mention + error + database context

**When**:
- Query is analyzed as `hybrid`
- Search executes

**Then**:
- File search: `src/pages/api/` files
- Code search: D1-related code
- Knowledge search: Previous D1 bugs/sessions
- Results are ranked by relevance
- Combined context is provided
- Total search time < 2 seconds (PERF-CTX-002)

### Verification Steps

1. Send hybrid query
2. Verify both code and knowledge search
3. Check result ranking
4. Measure search time
5. Verify response uses both sources

---

## Performance Acceptance Criteria

### PERF-CTX-001: Indexing Latency

**Requirement**: Code changes indexed within 5 minutes

**Test**:
1. Push code change
2. Measure time until searchable
3. Acceptable: < 300 seconds

### PERF-CTX-002: Search Response Time

**Requirement**: Context + search within 2 seconds

**Test**:
1. Send various query types
2. Measure from query receipt to results
3. Acceptable: < 2000ms for 95th percentile

---

## Integration Tests

### Test Suite 1: End-to-End Query Processing

```typescript
// Given
const query = "API 라우터에서 D1 오류가 발생해";

// When
const result = await processQuery(query);

// Then
expect(result.intent.type).toBe('code');
expect(result.intent.urgency).toBe('high');
expect(result.searchResults.length).toBeGreaterThan(0);
expect(result.freshness.isFresh).toBe(true);
expect(result.responseTime).toBeLessThan(2000);
```

### Test Suite 2: Webhook Processing

```typescript
// Given
const pushEvent = {
  ref: 'refs/heads/main',
  commits: [{
    modified: ['src/pages/api/reservations.ts']
  }]
};

// When
await handleWebhook(pushEvent);
const searchResults = await searchCode('reservations');

// Then
expect(searchResults).toContain('src/pages/api/reservations.ts');
```

---

## Quality Gates

### TRUST 5 Validation

- **Tested**: 85%+ test coverage
- **Readable**: Clear naming, English comments
- **Unified**: Consistent TypeScript patterns
- **Secured**: Webhook signature verification
- **Trackable**: Logging for all operations

### LSP Quality Gates

- Zero TypeScript errors
- Zero type errors
- Zero lint errors
- Maximum 10 warnings

---

## Rollback Criteria

If any acceptance criterion fails:
1. Identify failing component
2. Revert to previous stable version
3. Document issue
4. Create fix with additional tests

---

## Sign-off

- [ ] All acceptance criteria pass
- [ ] Performance targets met
- [ ] Quality gates passed
- [ ] Documentation complete
- [ ] Tests passing (85%+ coverage)
