# Implementation Plan - SPEC-CONTEXT-001

## Phase Overview

This document outlines the implementation phases for the Context Awareness and Code Freshness system.

## Phase 1: Query Intent Analysis (PRIORITY: P1)

**Duration**: 1-2 days
**Files**: `support-agent-worker/src/lib/query-intent.ts`

### Implementation Steps

1. Create TypeScript interfaces for QueryIntent
2. Implement `analyzeQueryIntent()` function with:
   - File mention extraction (regex pattern for file paths)
   - Error pattern detection (Error:, 오류, failed, 실패)
   - General phrase detection (어떻게, how to, 설명, explain)
3. Add unit tests for various query types
4. Test with real user queries from existing sessions

### Integration Points

- `support-agent-worker/src/lib/ai.ts` - Call in `processChat()` before search
- `support-agent-worker/src/routes/chat.ts` - Use intent for routing

### Success Criteria

- Correctly classify 90%+ of test queries
- Support Korean and English queries
- Response time < 10ms per query

## Phase 2: Automatic Code Indexing (PRIORITY: P0)

**Duration**: 2-3 days
**Files**: `support-agent-worker/src/lib/code-indexer.ts`, `support-agent-worker/src/routes/webhook.ts`

### Implementation Steps

1. Create GitHub Webhook handler endpoint
2. Implement file change detection from push events
3. Update Vectorize index incrementally (changed files only)
4. Store index metadata in D1 (lastIndexed, fileCount, indexedFiles)
5. Add manual trigger endpoint for full reindexing

### GitHub Webhook Setup

```typescript
// POST /webhook/github
interface GitHubPushEvent {
  ref: string;
  repository: { full_name: string };
  commits: Array<{
    added: string[];
    modified: string[];
    removed: string[];
  }>;
}
```

### Integration Points

- `support-agent-worker/src/lib/search.ts` - Update Vectorize index
- `support-agent-worker/src/lib/db.ts` - Store metadata

### Success Criteria

- Webhook processes push events within 1 minute
- Incremental updates only touch changed files
- Full reindex takes < 5 minutes for 500 files

## Phase 3: Code Freshness Verification (PRIORITY: P1)

**Duration**: 1-2 days
**Files**: `support-agent-worker/src/lib/freshness.ts`

### Implementation Steps

1. Implement `checkFreshness()` function
2. Compare lastIndexed with current time
3. Check for uncommitted changes via GitHub API
4. Provide recommendations for reindexing
5. Add freshness indicator to search results

### Freshness Check Logic

```typescript
interface FreshnessStatus {
  isFresh: boolean;
  staleness: 'fresh' | 'stale' | 'unknown';
  lastIndexed: number;
  ageSeconds: number;
  recommendation: string;
}
```

### Integration Points

- `support-agent-worker/src/lib/ai.ts` - Check before generating response
- `support-agent-worker/src/routes/chat.ts` - Display freshness warning

### Success Criteria

- Freshness check completes in < 100ms
- Provides actionable recommendations
- Warns users when index is > 1 hour old

## Phase 4: Hybrid Search Strategy (PRIORITY: P2)

**Duration**: 2-3 days
**Files**: `support-agent-worker/src/lib/hybrid-search.ts`

### Implementation Steps

1. Implement `hybridSearch()` function combining:
   - Code search (Vectorize) for specific queries
   - Knowledge search (D1) for abstract queries
   - File-based search when files are mentioned
2. Add confidence scoring algorithm
3. Implement result ranking and fusion
4. Add tests for all query types

### Search Strategy Matrix

| Query Type | Specificity | Priority Search |
|------------|-------------|-----------------|
| code | specific | File search > Code search > Knowledge |
| knowledge | abstract | Knowledge > Trending > Code |
| general | abstract | Knowledge > Code |
| hybrid | mixed | Parallel search, rank fusion |

### Integration Points

- `support-agent-worker/src/lib/ai.ts` - Replace getRelevantCodeContext()
- `support-agent-worker/src/lib/search.ts` - Extend for hybrid
- `support-agent-worker/src/lib/knowledge.ts` - Extend for hybrid

### Success Criteria

- Search completes in < 2 seconds (PERF-CTX-002)
- Confidence scores correlate with result relevance
- Supports all query types with appropriate strategies

## Testing Strategy

### Unit Tests

Each phase requires:
- Test coverage > 85%
- Edge case handling (empty queries, special characters)
- Mock external dependencies (Vectorize, D1)

### Integration Tests

- End-to-end query processing
- Webhook event handling
- Full search pipeline

### Performance Tests

- Query intent analysis: < 10ms
- Freshness check: < 100ms
- Hybrid search: < 2 seconds

## Rollback Strategy

Each phase is independently deployable:
- Phase 1: Can be deployed without automatic indexing
- Phase 2: Adds webhook, manual indexing still works
- Phase 3: Optional freshness warnings
- Phase 4: Gradual rollout with A/B testing

## Dependencies

**Required**: None (new functionality)

**Optional Enhancements**:
- GitHub API rate limiting cache
- Vectorize index versioning
- Search result caching
- A/B testing framework

## Migration from Existing System

### Preserved Components

- `support-agent-worker/src/lib/search.ts` - Vectorize search (keep)
- `support-agent-worker/src/lib/knowledge.ts` - Knowledge search (keep)
- `support-agent-worker/scripts/index-codebase.sh` - Manual indexing (keep)

### New Components

- `support-agent-worker/src/lib/query-intent.ts` - NEW
- `support-agent-worker/src/lib/code-indexer.ts` - NEW
- `support-agent-worker/src/lib/freshness.ts` - NEW
- `support-agent-worker/src/lib/hybrid-search.ts` - NEW
- `support-agent-worker/src/routes/webhook.ts` - NEW

### Modified Components

- `support-agent-worker/src/lib/ai.ts` - Integrate new components
- `support-agent-worker/src/routes/chat.ts` - Use intent analysis
