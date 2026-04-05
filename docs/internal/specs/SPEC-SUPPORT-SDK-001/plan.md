# Implementation Plan - SPEC-SUPPORT-SDK-001

## Overview

This document outlines the technical implementation plan for the Support Bot SDK. The implementation is divided into three phases, each building upon the previous one.

## Phase 1: Foundation - REST + Session Management

**Priority**: P1 (Required)
**Estimated Complexity**: Medium
**Dependencies**: None

### Milestones

#### M1-T1: Project Initialization

**Tasks**:
1. Create monorepo structure for `@clinic-os/support-bot-sdk`
2. Configure TypeScript with strict mode
3. Set up build tooling (esbuild/tsup)
4. Configure testing with vitest
5. Set up package.json with proper exports

**Output**:
- Buildable TypeScript project
- Test runner configured
- npm package structure ready

#### M1-T2: JSON Schema Definitions

**Tasks**:
1. Create `schemas/` directory
2. Define `schemas/common.json` - shared types
3. Define `schemas/session.json` - session APIs (from SPEC-SUPPORT-AGENT-001)
4. Define `schemas/chat.json` - chat APIs (from SPEC-AGENT-COMM-001)
5. Add schema validation tests

**Output**:
- JSON Schema files for all API contracts
- Schema validation utilities

#### M1-T3: Core Types Module

**Tasks**:
1. Create `src/types.ts` with all exported interfaces
2. Create error class hierarchy (`src/utils/errors.ts`)
3. Add JSDoc comments for all types
4. Generate TypeScript types from JSON schemas (optional)

**Output**:
- Complete type definitions
- Error classes with proper inheritance

#### M1-T4: REST API Client

**Tasks**:
1. Create `src/api/rest.ts` with fetch-based client
2. Implement session management (`src/session.ts`)
3. Add retry logic (`src/utils/retry.ts`)
4. Implement rate limit handling

**Key Methods**:
```typescript
class SupportBotClient {
  async startSession(): Promise<Session>
  async getSession(sessionId: string): Promise<Session>
  async endSession(sessionId: string, resolved: boolean): Promise<void>
  async chat(sessionId: string, context: AgentContext): Promise<ChatResponse>
}
```

**Output**:
- Working REST client
- Session lifecycle management
- Automatic retry on failures

#### M1-T5: Main SDK Class

**Tasks**:
1. Create `src/client.ts` with `SupportBotSDK` class
2. Implement `initialize()` factory method
3. Add `chat()` method
4. Implement `solve()` high-level API

**Output**:
- Public SDK API
- Documentation and examples

#### M1-T6: Context Builder Helpers

**Tasks**:
1. Create `src/utils/context.ts`
2. Implement `buildErrorContext()`
3. Implement `buildLocalContext()`
4. Implement `buildAgentContext()`

**Output**:
- Helper functions for building context
- Improved developer experience

#### M1-T7: Testing

**Tasks**:
1. Write unit tests for all modules
2. Add integration tests with mock server
3. Test error handling edge cases
4. Verify 85%+ coverage

**Output**:
- Comprehensive test suite
- Coverage report

### Technical Approach

**Project Structure**:
```
packages/support-bot-sdk/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── client.ts
│   ├── session.ts
│   ├── types.ts
│   ├── api/
│   │   └── rest.ts
│   └── utils/
│       ├── context.ts
│       ├── retry.ts
│       └── errors.ts
├── schemas/
│   ├── common.json
│   ├── session.json
│   └── chat.json
├── tests/
│   ├── client.test.ts
│   ├── session.test.ts
│   └── utils.test.ts
└── README.md
```

**Build Tool**: tsup (fast TypeScript bundler)
- Outputs ESM and CJS formats
- Generates TypeScript declarations
- Tree-shakeable output

**Testing**: vitest
- Unit tests for all modules
- Integration tests with mock responses
- Coverage tracking with c8

## Phase 2: Real-time - SSE Streaming

**Priority**: P2 (High Value)
**Estimated Complexity**: Medium
**Dependencies**: Phase 1 complete

### Milestones

#### M2-T1: SSE Server Endpoint

**Tasks**:
1. Add SSE endpoint to support-agent-worker
2. Endpoint: `GET /support/chat/stream`
3. Query params: `session_id`, `conversation_mode=true`
4. Return headers: `Content-Type: text/event-stream`
5. Server implementation in `src/routes/stream.ts`

**Server Implementation**:
```typescript
// support-agent-worker/src/routes/stream.ts
export const streamChat = async (
  c: Context,
  sessionId: string,
  context: AgentContext
) => {
  // Set SSE headers
  // Stream tokens from GLM 4.7
  // Format: data: {"content": "...", "done": false}
};
```

**Output**:
- Working SSE endpoint on Cloudflare Workers

#### M2-T2: SSE Client Implementation

**Tasks**:
1. Create `src/api/sse.ts`
2. Implement `streamChat()` method
3. Handle EventSource for browser, fetch for Node.js
4. Parse SSE events and yield chunks

**API**:
```typescript
async *streamChat(
  sessionId: string,
  context: AgentContext
): AsyncGenerator<StreamingChatResponse>
```

**Output**:
- Streaming chat client
- Browser and Node.js compatible

#### M2-T3: SDK Integration

**Tasks**:
1. Add `streamChat()` to `SupportBotSDK` class
2. Add streaming example to README
3. Update types

**Output**:
- Public streaming API
- Documentation

#### M2-T4: Testing

**Tasks**:
1. Test streaming with mock SSE server
2. Verify token-by-token delivery
3. Test connection interruption handling

**Output**:
- Streaming test suite
- 85%+ coverage maintained

### Technical Approach

**SSE Protocol**:
```
data: {"content": "Hello", "done": false}
data: {"content": " there", "done": false}
data: {"content": "!", "done": true, "reasoning": "..."}
```

**Browser Support**: Native `EventSource`
**Node.js Support**: `eventsource` polyfill or native fetch with stream handling

## Phase 3: Bidirectional - WebSocket Server + Client

**Priority**: P3 (Nice to Have)
**Estimated Complexity**: High
**Dependencies**: Phase 2 complete

### Milestones

#### M3-T1: WebSocket Server Deployment

**Tasks**:
1. Create separate WebSocket server project
2. Deploy to Railway/Fly.io (not Cloudflare Workers due to WebSocket limitations)
3. Implement authentication (JWT token from session)
4. Add connection management

**Server Stack**:
- Runtime: Node.js with ws library
- Framework: Fastify or raw ws
- Deployment: Railway/Fly.io

**Endpoints**:
- `wss://ws-support.clinic-os.com`

**Output**:
- Deployed WebSocket server
- Authentication working

#### M3-T2: WebSocket Protocol

**Tasks**:
1. Define message format (JSON)
2. Implement client-side event handlers
3. Add heartbeat/ping-pong

**Message Types**:
```typescript
// Client -> Server
{ "type": "authenticate", "token": "..." }
{ "type": "subscribe", "channel": "session:<session_id>" }

// Server -> Client
{ "type": "notification", "data": {...} }
{ "type": "ping" }
{ "type": "pong" }
```

**Output**:
- Protocol documentation
- Server implementation

#### M3-T3: WebSocket Client

**Tasks**:
1. Create `src/api/websocket.ts`
2. Implement `connectWebSocket()` method
3. Handle reconnection with backoff
4. Add event registration API

**API**:
```typescript
connectWebSocket(
  onEvent: (event: WebSocketEvent) => void
): WebSocketConnection

interface WebSocketConnection {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  send(data: unknown): void
  close(): void
}
```

**Output**:
- WebSocket client implementation
- Reconnection logic

#### M3-T4: SDK Integration

**Tasks**:
1. Add `connectWebSocket()` to `SupportBotSDK` class
2. Add WebSocket examples to README
3. Implement event types

**Output**:
- Public WebSocket API
- Documentation

#### M3-T5: Testing

**Tasks**:
1. Test WebSocket connection lifecycle
2. Test reconnection scenarios
3. Test event delivery
4. Load testing for concurrent connections

**Output**:
- WebSocket test suite
- 85%+ coverage maintained

### Technical Approach

**WebSocket Server Architecture**:
```
                    Railway/Fly.io
                          |
                   ws-support-server
                          |
        +-----------------+-----------------+
        |                 |                 |
   Connection Mgr    Auth Service    Notification Service
        |                 |                 |
        +-----------------+-----------------+
                          |
                   Redis Pub/Sub (optional)
```

**Deployment Architecture**:
- Cloudflare Workers: REST + SSE (Phases 1-2)
- Railway/Fly.io: WebSocket server (Phase 3)
- Shared: D1 database, authentication

## Risks and Mitigation

### Risk 1: Cloudflare Workers SSE Limitations

**Description**: Cloudflare Workers has limitations on streaming responses.

**Impact**: Medium - Phase 2 may need alternative approach

**Mitigation**:
- Test SSE on Workers early in Phase 2
- If SSE doesn't work, use chunked transfer encoding
- Fallback: Long polling or polling-based approach

### Risk 2: WebSocket Server Deployment Complexity

**Description**: Separate WebSocket deployment increases operational complexity.

**Impact**: Medium - Phase 3 may be delayed

**Mitigation**:
- Use managed services (Railway/Fly.io) for easy deployment
- Consider Cloudflare WebSocket API when available
- Document deployment process clearly

### Risk 3: Browser Compatibility

**Description**: Some environments don't support EventSource or WebSocket.

**Impact**: Low - Affects edge cases

**Mitigation**:
- Provide polyfills for EventSource
- Graceful degradation for unsupported features
- Document supported environments

### Risk 4: Session Management Across Transports

**Description**: Session state must be consistent across REST, SSE, and WebSocket.

**Impact**: High - Could cause data inconsistency

**Mitigation**:
- Use shared D1 database for session state
- Implement proper locking/queueing
- Add integration tests for cross-transport scenarios

## Rollback Plan

### Phase 1 Rollback

If Phase 1 has critical issues:
1. Keep existing REST API documentation
2. Mark SDK as beta/experimental
3. Revert to direct HTTP fetch in client code

**Impact**: Low - REST API remains functional

### Phase 2 Rollback

If SSE implementation has issues:
1. Disable streaming endpoint
2. SDK falls back to REST API
3. `streamChat()` method throws NotImplementedError

**Impact**: Low - Phase 1 functionality unaffected

### Phase 3 Rollback

If WebSocket server has issues:
1. Shut down WebSocket server
2. `connectWebSocket()` method throws NotImplementedError
3. Continue using REST + SSE

**Impact**: Low - Phases 1-2 functionality unaffected

## Success Criteria

### Phase 1
- [ ] SDK can be installed via npm
- [ ] `solve()` API works end-to-end
- [ ] 85%+ test coverage
- [ ] TypeScript types exported correctly
- [ ] Documentation complete

### Phase 2
- [ ] SSE endpoint deployed and working
- [ ] `streamChat()` yields tokens in real-time
- [ ] 85%+ test coverage maintained
- [ ] Browser and Node.js compatibility verified

### Phase 3
- [ ] WebSocket server deployed
- [ ] `connectWebSocket()` works
- [ ] Reconnection handles network failures
- [ ] 85%+ test coverage maintained
- [ ] End-to-end notification delivery verified

## Next Steps

1. **Immediate**: Run `/moai:2-run SPEC-SUPPORT-SDK-001` to begin Phase 1 implementation
2. **After Phase 1**: Evaluate SSE feasibility on Cloudflare Workers before Phase 2
3. **After Phase 2**: Assess WebSocket deployment platform for Phase 3

## Tag Mapping

| Plan Item | Related SPEC Tags |
|-----------|-------------------|
| M1-T2 | sdk:schema:definition |
| M1-T3 | sdk:type:safety |
| M1-T4 | sdk:chat:rest, sdk:session:manage |
| M1-T5 | sdk:solve:api |
| M1-T6 | sdk:context:builder |
| M2-T1 | sdk:sse:server |
| M2-T2 | sdk:sse:client |
| M3-T1 | sdk:websocket:server |
| M3-T3 | sdk:websocket:client |
