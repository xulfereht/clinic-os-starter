# Acceptance Criteria - SPEC-SUPPORT-SDK-001

## Overview

This document defines the acceptance criteria for the Support Bot SDK implementation. Each criterion is written in Given-When-Then format for clarity and testability.

## Phase 1: Foundation Acceptance Criteria

### AC-SDK-001: SDK Installation and Initialization

**Priority**: P1

**Given**: A developer has Node.js 18+ installed
**When**: They run `npm install @clinic-os/support-bot-sdk`
**Then**:
- Package installs successfully without errors
- TypeScript types are available for import
- Package exports are properly defined

**Given**: The SDK is installed
**When**: Developer calls `SupportBotSDK.initialize()` with valid config
**Then**:
- SDK instance is created successfully
- License key is validated
- No errors are thrown

### AC-SDK-002: Session Management

**Priority**: P1

**Given**: An initialized SDK instance
**When**: Developer calls `sdk.getSession()`
**Then**:
- New session is created on first call
- Session ID is returned
- Expires at timestamp is in the future
- Rate limit info is included

**Given**: An active session exists
**When**: Developer calls `sdk.getSession()` again
**Then**:
- Existing session is returned (not creating new one)
- Same session ID as before

**Given**: An active session exists
**When**: 30 minutes pass without activity
**Then**:
- Session is marked as expired
- Next API call returns SESSION_EXPIRED error

### AC-SDK-003: Chat API (REST)

**Priority**: P1

**Given**: An active session exists
**When**: Developer calls `sdk.chat()` with valid AgentContext
**Then**:
- Chat request is sent to server
- Response is received within 10 seconds
- Response includes `response`, `reasoning`, `confidence` fields
- No errors are thrown

**Given**: An invalid session ID is used
**When**: Developer calls `sdk.chat()`
**Then**:
- `SupportBotSDKError` is thrown
- Error code is `INVALID_SESSION`
- Error is not retryable

### AC-SDK-004: High-Level solve() API

**Priority**: P1

**Given**: An initialized SDK instance (no session yet)
**When**: Developer calls `sdk.solve("How do I add a user?")`
**Then**:
- Session is automatically created
- Chat request is sent
- Response is returned
- Developer did not need to manage session manually

**Given**: A solve() call fails with retryable error
**When**: The error is network-related with 503 status
**Then**:
- Request is automatically retried up to 3 times
- Exponential backoff is applied between retries
- Success response is returned if retry succeeds

### AC-SDK-005: Context Builder Helpers

**Priority**: P2

**Given**: A developer has an Error object
**When**: They call `buildErrorContext(error, "src/lib/api.ts", 42)`
**Then**:
- ErrorDetails object is returned
- Message, stack, file, and line are populated correctly

**Given**: A developer wants to build AgentContext
**When**: They call `buildAgentContext("Request text", { ... })`
**Then**:
- Complete AgentContext object is returned
- All optional fields are properly typed
- Type inference works correctly

### AC-SDK-006: Error Handling

**Priority**: P1

**Given**: Any SDK method call
**When**: Network error occurs (no internet)
**Then**:
- `SupportBotSDKError` is thrown
- Error code is `NETWORK_ERROR`
- Error is retryable

**Given**: A chat request
**When**: Rate limit is exceeded
**Then**:
- `SupportBotSDKError` is thrown
- Error code is `RATE_LIMIT_EXCEEDED`
- `retryAfter` date is included
- Error is retryable after the specified time

**Given**: Invalid license key is used
**When**: Any SDK method is called
**Then**:
- `SupportBotSDKError` is thrown
- Error code is `INVALID_LICENSE`
- Error is not retryable

### AC-SDK-007: TypeScript Type Safety

**Priority**: P1

**Given**: The SDK is imported in TypeScript
**When**: Developer uses any SDK method
**Then**:
- All parameters are type-checked
- Autocomplete shows all available options
- No `any` types are exposed in public API
- Return types are correctly inferred

**Given**: A developer builds AgentContext
**When**: They miss required field `human_request`
**Then**:
- TypeScript compiler shows error
- Error message indicates missing required field

### AC-SDK-008: JSON Schema Validation

**Priority**: P2

**Given**: JSON Schema files exist in `schemas/` directory
**When**: Validation is run against schemas
**Then**:
- All schemas are valid JSON Schema Draft 7
- Schemas match the API contracts from SPEC-SUPPORT-AGENT-001
- No validation errors occur

**Given**: A request body
**When**: It is validated against the JSON schema
**Then**:
- Valid requests pass validation
- Invalid requests fail with clear error messages

### AC-SDK-009: Test Coverage

**Priority**: P1

**Given**: The test suite is run
**When**: Coverage report is generated
**Then**:
- Overall coverage is >= 85%
- All critical paths are covered
- Edge cases are tested

**Given**: A bug is found
**When**: Regression test is added
**Then**:
- Test reproduces the bug
- Test fails before fix
- Test passes after fix

### AC-SDK-010: Documentation

**Priority**: P2

**Given**: A new developer wants to use the SDK
**When**: They read the README.md
**Then**:
- Installation instructions are clear
- Quick start example works
- All public methods are documented
- TypeScript types are visible in IDE

## Phase 2: SSE Streaming Acceptance Criteria

### AC-SDK-011: SSE Endpoint

**Priority**: P2

**Given**: Cloudflare Workers deployment
**When**: GET request is made to `/support/chat/stream`
**Then**:
- Response has `Content-Type: text/event-stream`
- Response has `Cache-Control: no-cache`
- Response has `Connection: keep-alive`

**Given**: Valid SSE stream request
**When**: Stream is established
**Then**:
- First event arrives within 2 seconds
- Events contain `data:` prefix
- Each event is valid JSON

### AC-SDK-012: Streaming Chat

**Priority**: P2

**Given**: An active session exists
**When**: Developer calls `sdk.streamChat()` with AgentContext
**Then**:
- AsyncGenerator is returned immediately
- First chunk arrives within 2 seconds
- Chunks contain partial response content

**Given**: A streaming chat in progress
**When**: Tokens are being streamed
**Then**:
- Multiple chunks arrive over time
- Each chunk has `content` and `done` fields
- Final chunk has `done: true`
- Final chunk includes `reasoning` field

**Given**: Streaming chat in browser
**When**: `streamChat()` is called
**Then**:
- Native EventSource is used (if available)
- Works in Chrome, Firefox, Safari, Edge

**Given**: Streaming chat in Node.js
**When**: `streamChat()` is called
**Then**:
- Fetch with stream handling is used
- Works in Node.js 18+

### AC-SDK-013: Stream Interruption Handling

**Priority**: P2

**Given**: A streaming chat in progress
**When**: Network connection is lost
**Then**:
- Generator throws network error
- Error includes details about failure
- Cleanup is performed

**Given**: A streaming chat in progress
**When**: Server closes stream unexpectedly
**Then**:
- Generator ends gracefully
- No unhandled errors

### AC-SDK-014: Streaming Performance

**Priority**: P2

**Given**: A 1000-token response
**When**: Streaming via SSE
**Then**:
- First token appears within 1 second
- Average token latency < 200ms
- Total streaming time < 5 seconds

## Phase 3: WebSocket Acceptance Criteria

### AC-SDK-015: WebSocket Server Deployment

**Priority**: P3

**Given**: Railway/Fly.io deployment
**When**: Server starts
**Then**:
- WebSocket server listens on wss:// URL
- Health check endpoint returns 200
- Authentication is required

**Given**: Valid JWT token
**When**: Client connects with authentication
**Then**:
- Connection is accepted
- `connected` event is emitted
- Session ID is associated with connection

### AC-SDK-016: WebSocket Client

**Priority**: P3

**Given**: An initialized SDK
**When**: Developer calls `sdk.connectWebSocket(handler)`
**Then**:
- WebSocketConnection object is returned
- Connection is established
- Handler receives `connected` event

**Given**: Active WebSocket connection
**When**: Server sends notification
**Then**:
- Handler receives `notification` event
- Event contains title, message, timestamp
- Data is correctly parsed

**Given**: Active WebSocket connection
**When**: Network connection is lost
**Then**:
- `disconnected` event is emitted
- Automatic reconnection is attempted
- Exponential backoff is applied

### AC-SDK-017: WebSocket Reconnection

**Priority**: P3

**Given**: WebSocket connection lost
**When**: Reconnection is triggered
**Then**:
- First retry is after 1 second
- Subsequent retries double the delay (max 30 seconds)
- Authentication is re-sent on reconnect

**Given**: Server is permanently down
**When**: Multiple reconnection attempts fail
**Then**:
- Reconnection stops after 10 attempts
- `error` event is emitted
- Connection cleanup is performed

### AC-SDK-018: Bidirectional Communication

**Priority**: P3

**Given**: Active WebSocket connection
**When**: Client sends message via `connection.send()`
**Then**:
- Message is delivered to server
- Server acknowledges receipt

**Given**: Client subscribes to session channel
**When**: New activity occurs on that session
**Then**:
- Client receives real-time notification
- Notification includes relevant data

### AC-SDK-019: WebSocket Browser Compatibility

**Priority**: P3

**Given**: Modern browser with WebSocket support
**When**: `connectWebSocket()` is called
**Then**:
- Native WebSocket API is used
- Works in Chrome, Firefox, Safari, Edge

**Given**: Node.js environment
**When**: `connectWebSocket()` is called
**Then**:
- ws library is used
- Connection is established

## Quality Gates

### General Quality Criteria

**Given**: Pull request is created
**When**: CI checks run
**Then**:
- All tests pass
- TypeScript compilation succeeds
- Linting passes (no errors)
- Coverage is >= 85%

**Given**: Production deployment
**When**: New version is released
**Then**:
- Semver version is updated correctly
- CHANGELOG.md is updated
- Release notes include breaking changes

### Performance Criteria

**Given**: SDK operations
**When**: Performance is measured
**Then**:
- Session creation: P95 < 200ms
- Chat request: P95 < 10s
- Streaming first token: P95 < 1s
- WebSocket connection: P95 < 500ms

### Security Criteria

**Given**: SDK usage
**When**: Security is reviewed
**Then**:
- License keys are never logged
- Session tokens are stored in memory only
- HTTPS is always used
- No secrets in error messages

### Backward Compatibility Criteria

**Given**: Existing SDK users
**When**: New minor version is released
**Then**:
- All existing APIs continue to work
- No breaking changes without major version bump
- Deprecation warnings are shown for removed features

## Test Scenarios

### Scenario 1: First-Time User Setup

**Given**: New developer installing SDK
**When**: They follow the quick start guide
**Then**:
- Installation succeeds
- First API call succeeds
- Result matches expected output

### Scenario 2: Multi-Turn Conversation

**Given**: Active session
**When**: Developer sends multiple chat messages
**Then**:
- Session ID remains the same
- Conversation history is maintained
- Each response references previous context

### Scenario 3: Error Recovery

**Given**: SDK in use
**When**: Network temporarily fails
**Then**:
- Request is retried automatically
- Success is returned to user
- User is unaware of the failure

### Scenario 4: Session Expiry

**Given**: Session close to expiry
**When**: Developer makes API call
**Then**:
- Session is auto-renewed if enabled
- Or clear expiry error is shown
- Developer can create new session

### Scenario 5: Streaming Long Response

**Given**: Long AI response (1000+ tokens)
**When**: Using `streamChat()`
**Then**:
- First token appears quickly
- Stream continues steadily
- Complete response is received
- Memory usage remains stable

### Scenario 6: WebSocket Reconnection

**Given**: Active WebSocket connection
**When**: Server restarts
**Then**:
- Client detects disconnection
- Reconnection is attempted
- Connection is restored
- Missed notifications are requested

## Definition of Done

A phase is considered complete when:

1. All acceptance criteria for the phase pass
2. Test coverage is >= 85%
3. Documentation is complete (README + API docs)
4. No critical bugs remain
5. Code review is approved
6. CI/CD pipeline passes
7. Performance benchmarks are met
8. Security review is complete (for P1 features)

## Verification Methods

- **Automated Testing**: Unit tests, integration tests, E2E tests
- **Manual Testing**: Developer experience walkthrough
- **Performance Testing**: Load testing, latency measurement
- **Security Testing**: Static analysis, dependency scanning
- **Compatibility Testing**: Browser matrix, Node.js versions
- **Documentation Review**: Technical writing review

## Rollback Verification

For each rollback scenario, verify:

1. Data integrity is maintained
2. No orphaned resources exist
3. Users receive clear error messages
4. System remains functional for unaffected features
5. Monitoring shows stable state after rollback

## Tag Mapping

| Acceptance Criterion | Related Tags |
|---------------------|--------------|
| AC-SDK-001 | sdk:install, sdk:init |
| AC-SDK-002 | sdk:session:manage |
| AC-SDK-003 | sdk:chat:rest |
| AC-SDK-004 | sdk:solve:api |
| AC-SDK-005 | sdk:context:builder |
| AC-SDK-006 | sdk:error:handling |
| AC-SDK-007 | sdk:type:safety |
| AC-SDK-008 | sdk:schema:validation |
| AC-SDK-009 | sdk:coverage |
| AC-SDK-010 | sdk:docs |
| AC-SDK-011 | sdk:sse:server |
| AC-SDK-012 | sdk:sse:client |
| AC-SDK-013 | sdk:sse:interrupt |
| AC-SDK-014 | sdk:sse:performance |
| AC-SDK-015 | sdk:websocket:server |
| AC-SDK-016 | sdk:websocket:client |
| AC-SDK-017 | sdk:websocket:reconnect |
| AC-SDK-018 | sdk:websocket:bidirectional |
| AC-SDK-019 | sdk:websocket:compatibility |
