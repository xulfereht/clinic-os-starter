# Acceptance Criteria: Agent-Agnostic Support Worker

**SPEC ID**: SPEC-SUPPORT-WORKER-001
**Version**: 1.0.0
**Created**: 2026-02-09

---

## Overview

This document defines the acceptance criteria for the Agent-Agnostic Support Worker implementation. All scenarios use the Given-When-Then format for clarity and testability.

## Core API Acceptance Criteria

### AC-SW-001: Status Health Check

**Feature**: GET /v1/status endpoint returns worker health information

**Given**: The support worker server is running on localhost:3000
**When**: A client sends GET /v1/status
**Then**:
- The response has status code 200
- The response body contains:
  - `status` field with value "healthy"
  - `version` field with semantic version
  - `timestamp` field in ISO 8601 format
  - `detectedAgent` field with detected agent type
  - `sessions` field with current session count (number)
  - `uptime` field with server uptime in seconds

### AC-SW-002: Session Creation

**Feature**: POST /v1/session creates a new conversation session

**Given**: The support worker server is running
**When**: A client sends POST /v1/session with User-Agent header
**Then**:
- The response has status code 201
- The response body contains:
  - `sessionId` field with valid UUID v4 format
  - `agent` field with detected agent type
  - `createdAt` field in ISO 8601 format
- A new session is stored in the session manager

### AC-SW-003: Chat Message Processing

**Feature**: POST /v1/chat processes messages and returns responses

**Scenario 3.1: Message with existing session**

**Given**: A valid session exists with ID "session-123"
**When**: A client sends POST /v1/chat with:
  - `sessionId`: "session-123"
  - `message`: "Help me debug auth error"
**Then**:
- The response has status code 200
- The response body contains:
  - `sessionId` field matching "session-123"
  - `agent` field with detected agent type
  - `response` object with `type`, `content`, and optional `suggestions`
  - `messageCount` field incremented from previous value
- The message is stored in session history

**Scenario 3.2: Message without session creates new session**

**Given**: No session exists
**When**: A client sends POST /v1/chat with:
  - `message`: "Help me debug"
  - No `sessionId` field
**Then**:
- The response has status code 200
- The response body contains a new `sessionId`
- A new session is created automatically
- The message is stored in the new session's history

**Scenario 3.3: Invalid request (missing message)**

**Given**: The support worker server is running
**When**: A client sends POST /v1/chat without `message` field
**Then**:
- The response has status code 400
- The response body contains:
  - `error` field with message "Message is required"
  - `field` field with value "message"

### AC-SW-004: Agent Detection

**Feature**: Agent type is correctly detected from User-Agent header

**Scenario 4.1: Claude Code detection**

**Given**: The support worker server is running
**When**: A request arrives with User-Agent containing "claude" or "anthropic"
**Then**: The agent is detected as "claude-code"

**Scenario 4.2: Gemini CLI detection**

**Given**: The support worker server is running
**When**: A request arrives with User-Agent containing "gemini" or "google"
**Then**: The agent is detected as "gemini-cli"

**Scenario 4.3: Aider detection**

**Given**: The support worker server is running
**When**: A request arrives with User-Agent containing "aider"
**Then**: The agent is detected as "aider"

**Scenario 4.4: Cursor detection**

**Given**: The support worker server is running
**When**: A request arrives with User-Agent containing "cursor"
**Then**: The agent is detected as "cursor"

**Scenario 4.5: Unknown agent**

**Given**: The support worker server is running
**When**: A request arrives with User-Agent "unknown-agent/1.0"
**Then**: The agent is detected as "unknown"

### AC-SW-005: Session Context Retention

**Feature**: Session history is maintained across multiple messages

**Given**: A session exists with 2 previous messages
**When**: A client sends a third message with the session ID
**Then**:
- The response includes `messageCount: 3`
- All three messages are stored in session history
- Each message has a timestamp in ISO 8601 format
- Messages have `role` field ("user" or "assistant")

## WebSocket Acceptance Criteria

### AC-SW-006: WebSocket Connection

**Feature**: Clients can connect via WebSocket for bidirectional communication

**Scenario 6.1: Successful connection**

**Given**: The support worker server is running
**When**: A client connects to ws://localhost:3000/v1/ws
**Then**:
- The connection is established
- The server sends a "connected" message with:
  - `type`: "connected"
  - `sessionId`: valid UUID
  - `agent`: detected agent type
  - `timestamp`: ISO 8601 timestamp

**Scenario 6.2: Message exchange**

**Given**: A WebSocket client is connected
**When**: The client sends JSON: `{"message": "Help me test"}`
**Then**:
- The server processes the message
- The server sends a "response" message with:
  - `type`: "response"
  - `sessionId`: matching session ID
  - `response`: object with content
  - `timestamp`: ISO 8601 timestamp

**Scenario 6.3: Connection close**

**Given**: A WebSocket client is connected
**When**: The client sends JSON: `{"action": "close"}`
**Then**:
- The server closes the connection
- The session data is retained for potential reconnection

### AC-SW-007: SSE Streaming

**Feature**: Server-Sent Events stream provides real-time updates

**Given**: The support worker server is running
**When**: A client requests GET /v1/stream?sessionId=session-123
**Then**:
- The response has Content-Type: "text/event-stream"
- The response has Cache-Control: "no-cache"
- The client receives SSE events with:
  - Initial "connected" event
  - Periodic "heartbeat" events
  - Events have proper SSE format: `data: {...}\n\n`

## Support Bot Integration Acceptance Criteria

### AC-SW-008: Support Bot Message Forwarding

**Feature**: Messages are forwarded to Support Bot with full context

**Given**: The Support Bot API is available at https://support-agent.workers.dev
**When**: A client sends POST /v1/chat with:
  - `message`: "Complex error requiring analysis"
  - `context.attemptedSolution`: "Already tried restarting"
  - `context.errorDetails`: `{ message: "Auth failed", stack: "..." }`
**Then**:
- The request is forwarded to Support Bot with full context
- The Support Bot response is returned to the client
- The response includes Support Bot's analysis and suggestions

### AC-SW-009: Graceful Degradation

**Feature**: Local responses when Support Bot is unavailable

**Given**: The Support Bot API is unavailable (timeout or error)
**When**: A client sends POST /v1/chat
**Then**:
- The request does not fail
- A local pattern-matching response is returned
- The response indicates degraded mode
- The error is logged for monitoring

## Agent-Specific Acceptance Criteria

### AC-SW-010: Claude Code Compatibility

**Given**: Claude Code agent is running
**When**: Claude Code executes: `Bash("curl -X POST http://localhost:3000/v1/chat -H 'Content-Type: application/json' -d '{\"message\": \"Help me debug\"}'")`
**Then**:
- The command executes successfully
- A valid JSON response is returned
- The agent is detected as "claude-code"

### AC-SW-011: Gemini CLI Compatibility

**Given**: Gemini CLI agent is running
**When**: Gemini CLI executes: `curl -X POST http://localhost:3000/v1/chat -H "Content-Type: application/json" -d '{"message": "How do I write tests?"}'`
**Then**:
- The command executes successfully
- A valid JSON response is returned
- The agent is detected as "gemini-cli"

### AC-SW-012: Aider Compatibility

**Given**: Aider agent is running
**When**: Aider executes: `!/bin/bash curl -X POST http://localhost:3000/v1/chat -H "Content-Type: application/json" -d '{"message": "Help me refactor"}'`
**Then**:
- The command executes successfully
- A valid JSON response is returned
- The agent is detected as "aider"

### AC-SW-013: Cursor Compatibility

**Given**: Cursor agent is running with Python
**When**: Cursor executes:
```python
import requests
response = requests.post('http://localhost:3000/v1/chat', json={'message': 'Help me understand'})
```
**Then**:
- The request executes successfully
- A valid JSON response is returned
- The agent is detected as "cursor"

## Quality Acceptance Criteria

### AC-SW-014: Test Coverage

**Feature**: Code has comprehensive test coverage

**Given**: The implementation is complete
**When**: Test suite is executed with coverage reporting
**Then**:
- Overall coverage is >= 85%
- All critical paths (HTTP routes, WebSocket, session management) have >= 90% coverage
- Zero tests are skipped or marked as todo

### AC-SW-015: TypeScript Type Safety

**Feature**: Code passes TypeScript type checking

**Given**: The implementation is complete
**When**: TypeScript compiler is executed
**Then**:
- Zero type errors are reported
- All `any` types are justified or replaced
- All imports have proper type definitions

### AC-SW-016: Error Handling

**Feature**: All error scenarios are handled gracefully

**Scenario 16.1: Malformed JSON**

**Given**: The support worker server is running
**When**: A client sends POST /v1/chat with invalid JSON
**Then**:
- The response has status code 400
- The response contains a helpful error message

**Scenario 16.2: Invalid session ID**

**Given**: The support worker server is running
**When**: A client sends POST /v1/chat with non-existent sessionId
**Then**:
- A new session is created automatically
- The response succeeds with status code 200

**Scenario 16.3: Server error**

**Given**: An internal error occurs during request processing
**When**: The error is caught by error handler
**Then**:
- The response has status code 500
- The response contains error information (without sensitive data)
- The error is logged with stack trace

## Documentation Acceptance Criteria

### AC-SW-017: README Completeness

**Given**: The support-worker repository
**When**: A developer reads README.md
**Then**: The README includes:
- Project description and purpose
- Installation instructions
- API endpoint documentation with examples
- WebSocket usage examples
- Agent-specific examples for all supported agents
- Configuration options (PORT, etc.)
- Testing instructions
- Production deployment considerations

### AC-SW-018: Agent Examples

**Given**: The examples/ directory
**When**: A developer wants to use the worker with a specific agent
**Then**: Working examples exist for:
- Claude Code (TypeScript/JavaScript)
- Gemini CLI (shell script)
- Aider (shell script)
- Cursor (Python)
- Each example is executable and documented

## Performance Acceptance Criteria

### AC-SW-019: Response Time

**Given**: The support worker server is running
**When**: A client sends POST /v1/chat
**Then**:
- Local pattern-matching response time < 100ms
- Support Bot forwarded response time < 10s
- Status endpoint response time < 50ms

### AC-SW-020: Concurrent Connections

**Given**: The support worker server is running
**When**: 10 clients connect simultaneously (mix of HTTP and WebSocket)
**Then**:
- All connections are handled successfully
- No requests are dropped
- Response times remain within acceptable limits

## Security Acceptance Criteria

### AC-SW-021: CORS Headers

**Given**: A browser-based client makes a request
**When**: The request includes Origin header
**Then**:
- Response includes appropriate CORS headers
- OPTIONS requests are handled correctly

### AC-SW-022: Input Validation

**Given**: A client sends a request with potentially malicious input
**When**: The request is processed
**Then**:
- Malicious input is sanitized or rejected
- No code injection is possible
- Error messages don't leak sensitive information

---

## Quality Gate Checklist

Before marking this SPEC as complete, verify:

- [ ] All HTTP endpoints (status, session, chat, stream) work correctly
- [ ] WebSocket connections work for bidirectional communication
- [ ] All supported agents (Claude Code, Gemini CLI, Aider, Cursor) are compatible
- [ ] Agent detection works correctly for all agent types
- [ ] Session management maintains context across messages
- [ ] Support Bot integration forwards messages correctly
- [ ] Graceful degradation works when Support Bot is unavailable
- [ ] Test coverage >= 85%
- [ ] Zero TypeScript errors
- [ ] All examples in examples/ directory are executable
- [ ] README.md is comprehensive and accurate
- [ ] All acceptance criteria in this document are met
