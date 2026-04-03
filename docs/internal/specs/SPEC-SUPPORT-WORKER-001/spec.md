---
id: SPEC-SUPPORT-WORKER-001
version: 1.0.0
status: draft
created: 2026-02-09
author: moai
priority: P1
lifecycle_level: spec-anchored
tags: support-worker, agent-agnostic, http, websocket, integration
---

# Agent-Agnostic Support Worker

## Overview

The Agent-Agnostic Support Worker is a local HTTP/WebSocket server that enables universal compatibility between AI coding agents and the remote Support Bot service. This SPEC documents the production-ready implementation that extends the existing proof of concept.

### Core Problem

Different AI coding agents (Claude Code, Gemini CLI, Aider, Cursor, etc.) have varying capabilities and interfaces for making external HTTP requests. There is no universal way for these agents to communicate with support services.

### Solution

A local HTTP/WebSocket server that:
1. Accepts simple HTTP requests from any agent
2. Auto-detects the agent type via User-Agent header
3. Manages conversation sessions across multiple turns
4. Bridges to the remote Support Bot API
5. Provides both request/response and real-time WebSocket interfaces

## Environment

### Current State

- **Proof of Concept**: `support-worker/` directory with basic implementation
- **Technology**: Node.js with Express and ws (WebSocket)
- **Support Bot**: `https://support-agent.workers.dev` (SPEC-AGENT-COMM-001)
- **Supported Agents**: Claude Code, Gemini CLI, Aider, Cursor

### Target State

- Production-ready local server with persistence
- Full integration with Support Bot conversation mode
- Comprehensive test coverage (85%+)
- Complete documentation for all supported agents

### Constraints

- Must remain compatible with all HTTP-capable AI coding agents
- Must maintain backward compatibility with existing PoC API
- Node.js version >= 18.0.0 required
- Local execution only (no cloud deployment)

## Assumptions

### Technical Assumptions

- **Assumption**: All AI coding agents can execute shell commands or make HTTP requests
  - **Confidence**: High
  - **Evidence**: Claude Code (Bash tool), Gemini CLI (shell), Aider (/bin/bash), Cursor (Python requests)
  - **Risk if Wrong**: Some agents cannot make HTTP requests, limiting compatibility
  - **Validation Method**: Verified against major AI coding agent documentation

- **Assumption**: Local server on localhost:3000 is accessible by all agents
  - **Confidence**: High
  - **Evidence**: Standard practice for local development servers
  - **Risk if Wrong**: Firewall or permission issues may block access
  - **Validation Method**: Test across different operating systems and agent configurations

- **Assumption**: Support Bot API at `https://support-agent.workers.dev` remains stable
  - **Confidence**: Medium
  - **Evidence**: Based on SPEC-AGENT-COMM-001 implementation
  - **Risk if Wrong**: Breaking changes in Support Bot API could cause integration failures
  - **Validation Method**: Version negotiation and graceful degradation

### Business Assumptions

- **Assumption**: Developers will run the support worker as a background service
  - **Confidence**: Medium
  - **Evidence**: Common pattern for development tools
  - **Risk if Wrong**: Low adoption if manual startup required
  - **Validation Method**: User testing and feedback collection

## EARS Requirements

### Ubiquitous Requirements

#### REQ-SW-001: Agent Detection
**THE system SHALL** detect the AI agent type from User-Agent header for all incoming requests.

#### REQ-SW-002: Session Management
**THE system SHALL** maintain conversation session state across multiple message exchanges.

#### REQ-SW-003: JSON Response Format
**THE system SHALL** return all responses in JSON format with consistent structure.

#### REQ-SW-004: Error Handling
**THE system SHALL** return appropriate HTTP status codes (200, 400, 500) with error messages for all failure scenarios.

#### REQ-SW-005: CORS Headers
**THE system SHALL** include CORS headers for browser-based agent compatibility.

### Event-Driven Requirements

#### REQ-SW-101: Status Health Check
**WHEN** a client sends GET /v1/status, **THE system SHALL** return worker health information including version, uptime, session count, and detected agent.

#### REQ-SW-102: Session Creation
**WHEN** a client sends POST /v1/session, **THE system SHALL** create a new session with unique ID, agent type, and creation timestamp.

#### REQ-SW-103: Chat Message Processing
**WHEN** a client sends POST /v1/chat, **THE system SHALL** process the message, forward to Support Bot if enabled, and return a response.

#### REQ-SW-104: Message History Storage
**WHEN** a client sends a chat message, **THE system SHALL** store the message in session history with timestamp and role.

#### REQ-SW-105: WebSocket Connection
**WHEN** a client connects via WebSocket to /v1/ws, **THE system SHALL** establish bidirectional communication with session management.

#### REQ-SW-106: SSE Stream
**WHEN** a client requests GET /v1/stream, **THE system SHALL** establish Server-Sent Events stream with real-time updates.

### State-Driven Requirements

#### REQ-SW-201: Session Context Retention
**IF** a session exists, **THE system SHALL** maintain conversation history across multiple message exchanges.

#### REQ-SW-202: Auto-Session Creation
**IF** a chat request arrives without a session ID, **THE system SHALL** automatically create a new session.

#### REQ-SW-203: WebSocket Message Routing
**IF** a WebSocket client sends a message, **THE system SHALL** route it through the same processing logic as HTTP chat endpoint.

### Optional Requirements

#### REQ-SW-301: Database Persistence (Optional)
**WHERE POSSIBLE**, **THE system SHALL** provide database persistence for sessions instead of in-memory storage.

#### REQ-SW-302: API Authentication (Optional)
**WHERE POSSIBLE**, **THE system SHALL** provide API key authentication for production security.

#### REQ-SW-303: Rate Limiting (Optional)
**WHERE POSSIBLE**, **THE system SHALL** implement rate limiting to prevent abuse.

#### REQ-SW-304: Structured Logging (Optional)
**WHERE POSSIBLE**, **THE system SHALL** provide structured logging for monitoring and debugging.

### Unwanted Behavior Requirements

#### REQ-SW-401: No Session Data Loss
**THE system SHALL NOT** lose session data during normal operation without explicit session deletion.

#### REQ-SW-402: No Blocking Operations
**THE system SHALL NOT** block the event loop during Support Bot API calls.

#### REQ-SW-403: No Plaintext Secrets
**THE system SHALL NOT** log or expose API keys or sensitive session data.

## Specifications

### SP-SW-001: HTTP API Endpoints

#### GET /v1/status

Health check endpoint returning worker status.

```typescript
interface StatusResponse {
  status: 'healthy' | 'degraded';
  version: string;
  timestamp: string; // ISO 8601
  detectedAgent: AgentType;
  sessions: number;
  uptime: number; // seconds
}
```

#### POST /v1/session

Create a new conversation session.

```typescript
interface SessionCreateResponse {
  sessionId: string; // UUID v4
  agent: AgentType;
  createdAt: string; // ISO 8601
}
```

#### POST /v1/chat

Send a message and receive a response.

```typescript
interface ChatRequest {
  message: string;
  sessionId?: string;
  context?: {
    attemptedSolution?: string;
    errorDetails?: {
      message: string;
      stack?: string;
      file?: string;
      line?: number;
    };
    localContext?: {
      modifiedFiles?: string[];
      relatedFiles?: string[];
    };
  };
}

interface ChatResponse {
  sessionId: string;
  agent: AgentType;
  response: {
    type: 'solution' | 'guidance' | 'acknowledgment';
    content: string;
    suggestions?: string[];
  };
  messageCount: number;
}
```

### SP-SW-002: WebSocket Protocol

#### Connection

```typescript
// Client -> Server
interface WSMessage {
  message?: string;
  action?: 'close' | 'ping';
  sessionId?: string;
}

// Server -> Client
interface WSResponse {
  type: 'connected' | 'response' | 'error' | 'heartbeat';
  sessionId?: string;
  agent?: AgentType;
  response?: ChatResponse['response'];
  error?: string;
  timestamp: string;
}
```

### SP-SW-003: Agent Detection

```typescript
type AgentType =
  | 'claude-code'
  | 'gemini-cli'
  | 'aider'
  | 'cursor'
  | 'unknown';

function detectAgent(userAgent: string | undefined): AgentType;
```

Detection patterns:
- Claude Code: `user-agent` includes `claude` or `anthropic`
- Gemini CLI: `user-agent` includes `gemini` or `google`
- Aider: `user-agent` includes `aider`
- Cursor: `user-agent` includes `cursor`

### SP-SW-004: Support Bot Integration

Integration with SPEC-AGENT-COMM-001 conversation mode.

```typescript
interface SupportBotRequest {
  session_id: string;
  message: {
    type: 'question' | 'follow_up' | 'clarification';
    human_request: string;
    attempted_solution?: string;
    error_details?: ErrorDetails;
    local_context?: LocalContext;
    analysis_process?: AnalysisProcess;
    attempts_made?: AttemptsMade;
    session_context?: SessionContext;
  };
  conversation_mode?: boolean;
}

interface SupportBotResponse {
  response: {
    content: string;
    reasoning?: string;
    confidence?: number;
    follow_up_questions?: string[];
    suggested_actions?: SuggestedAction[];
  };
}
```

### SP-SW-005: Session Management

```typescript
interface Session {
  sessionId: string;
  agent: AgentType;
  createdAt: string;
  messageCount: number;
  lastActivity: string;
}

interface MessageTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
```

## Traceability

### Tag Mapping

| Requirement ID | Tag | Component |
|----------------|-----|-----------|
| REQ-SW-001 | sw:agent:detection | server.js, agent-detector.ts |
| REQ-SW-002 | sw:session:manage | session-manager.ts |
| REQ-SW-003 | sw:response:format | api-response.ts |
| REQ-SW-004 | sw:error:handling | error-handler.ts |
| REQ-SW-101 | sw:api:status | routes/status.ts |
| REQ-SW-102 | sw:api:session | routes/session.ts |
| REQ-SW-103 | sw:api:chat | routes/chat.ts |
| REQ-SW-105 | sw:api:websocket | websocket-handler.ts |
| REQ-SW-106 | sw:api:stream | routes/stream.ts |
| REQ-SW-201 | sw:session:context | session-manager.ts |
| REQ-SW-204 | sw:supportbot:integration | support-bot-client.ts |

### Implementation Mapping

- `server.js` - Main server entry point (Express + HTTP server)
- `agent-detector.ts` - Agent type detection from User-Agent
- `session-manager.ts` - Session creation, retrieval, and persistence
- `routes/status.ts` - GET /v1/status endpoint
- `routes/session.ts` - POST /v1/session endpoint
- `routes/chat.ts` - POST /v1/chat endpoint
- `routes/stream.ts` - GET /v1/stream SSE endpoint
- `websocket-handler.ts` - WebSocket connection handler
- `support-bot-client.ts` - Support Bot API integration
- `api-response.ts` - Response formatting utilities
- `error-handler.ts` - Error handling middleware

## Dependencies

### Required Dependencies

- **Internal**: SPEC-AGENT-COMM-001 (Support Bot conversation mode)
- **External**:
  - `express@^4.18.2` - HTTP server framework
  - `ws@^8.14.2` - WebSocket implementation
  - `uuid@^9.0.1` - UUID generation

### Development Dependencies

- `@types/express@^4.17.21` - TypeScript definitions
- `@types/ws@^8.5.10` - TypeScript definitions
- `@types/uuid@^9.0.7` - TypeScript definitions
- `vitest@^1.0.0` - Testing framework
- `typescript@^5.0.0` - TypeScript compiler

### Optional Dependencies

- `sqlite3` or `better-sqlite3` - For database persistence
- `winston` or `pino` - For structured logging
- `express-rate-limit` - For rate limiting

## Risks

### Risk Factors

1. **Port Conflict**: Port 3000 may already be in use
   - **Mitigation**: Allow PORT environment variable configuration
   - **Fallback**: Auto-increment port number if conflict detected

2. **Session Memory Limit**: In-memory sessions may consume excessive memory
   - **Mitigation**: Implement session TTL and automatic cleanup
   - **Monitoring**: Track memory usage and session count

3. **Support Bot API Downtime**: Remote service may be unavailable
   - **Mitigation**: Graceful degradation to local responses
   - **Caching**: Cache common responses

4. **WebSocket Connection Limits**: Browser may limit concurrent connections
   - **Mitigation**: Document connection pooling best practices
   - **Alternative**: Provide HTTP fallback for all operations

## Non-Goals

Out of scope for this SPEC:

- Cloud deployment of the support worker
- Authentication/authorization mechanisms
- Multi-tenancy support
- Advanced analytics dashboard
- Plugin system architecture
