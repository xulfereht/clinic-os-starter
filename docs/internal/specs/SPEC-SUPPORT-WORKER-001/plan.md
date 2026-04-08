# Implementation Plan: Agent-Agnostic Support Worker

**SPEC ID**: SPEC-SUPPORT-WORKER-001
**Version**: 1.0.0
**Created**: 2026-02-09
**Status**: Draft

---

## Milestones by Priority

### Primary Goals (P0)

These milestones are essential for the core functionality:

#### Milestone P0-1: Core API Implementation
Complete the HTTP REST API with all endpoints.

**Tasks**:
- Implement GET /v1/status endpoint
- Implement POST /v1/session endpoint
- Implement POST /v1/chat endpoint with message history
- Implement GET /v1/stream SSE endpoint
- Add error handling middleware

**Acceptance**: All HTTP endpoints return proper JSON responses

#### Milestone P0-2: WebSocket Support
Implement bidirectional WebSocket communication.

**Tasks**:
- Set up WebSocket server on /v1/ws path
- Implement connection handling with session creation
- Implement message routing to chat processing logic
- Add connection close handling

**Acceptance**: WebSocket clients can send/receive messages

#### Milestone P0-3: Support Bot Integration
Connect to remote Support Bot API (SPEC-AGENT-COMM-001).

**Tasks**:
- Create Support Bot API client
- Implement conversation mode integration
- Forward messages with full context
- Handle API errors gracefully

**Acceptance**: Chat responses are proxied from Support Bot

### Secondary Goals (P1)

These milestones improve robustness and maintainability:

#### Milestone P1-1: Agent Detection Enhancement
Improve agent type detection with patterns.

**Tasks**:
- Extract agent detection to separate module
- Add detection for more agent types
- Log detected agents for analytics
- Add tests for detection patterns

**Acceptance**: All supported agents are correctly detected

#### Milestone P1-2: Session Management
Implement session persistence and lifecycle.

**Tasks**:
- Implement session TTL (30 minutes default)
- Add session cleanup task
- Implement message history storage
- Add session count monitoring

**Acceptance**: Sessions persist correctly and expire properly

#### Milestone P1-3: Testing Infrastructure
Achieve 85%+ test coverage.

**Tasks**:
- Set up Vitest test framework
- Write unit tests for each module
- Write integration tests for API endpoints
- Write WebSocket connection tests

**Acceptance**: Test coverage >= 85%, all tests passing

### Final Goals (P2)

These milestones provide production readiness:

#### Milestone P2-1: Documentation
Complete documentation for all supported agents.

**Tasks**:
- Write comprehensive README
- Create agent-specific examples directory
- Add TypeScript types documentation
- Create troubleshooting guide

**Acceptance**: All agents have working examples

#### Milestone P2-2: Configuration & Environment
Add configuration options and environment variable support.

**Tasks**:
- Support PORT environment variable
- Support LOG_LEVEL environment variable
- Add configuration validation
- Document all environment variables

**Acceptance**: Worker can be configured via environment

### Optional Goals (P3)

These milestones are nice-to-have enhancements:

#### Milestone P3-1: Database Persistence
Replace in-memory storage with database.

**Tasks**:
- Design database schema for sessions
- Implement SQLite integration
- Add database migration scripts
- Update session manager to use database

#### Milestone P3-2: Structured Logging
Add production-grade logging.

**Tasks**:
- Integrate winston or pino logger
- Add log level configuration
- Implement request/response logging
- Add error stack trace logging

#### Milestone P3-3: Health Monitoring
Add metrics and health checks.

**Tasks**:
- Implement /health endpoint for uptime monitoring
- Add prometheus metrics export
- Track request/response metrics
- Add session lifecycle metrics

---

## Technical Approach

### Architecture Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    Support Worker Server                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ HTTP Routes  │  │   WebSocket  │  │     SSE      │          │
│  │              │  │   Handler    │  │   Stream     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                    │
│         └─────────────────┼──────────────────┘                    │
│                           │                                       │
│                    ┌──────▼──────┐                                │
│                    │   Request   │                                │
│                    │   Router    │                                │
│                    └──────┬──────┘                                │
│                           │                                       │
│         ┌─────────────────┼─────────────────┐                     │
│         │                 │                 │                     │
│  ┌──────▼───────┐  ┌─────▼──────┐  ┌──────▼──────┐             │
│  │   Agent      │  │  Session   │  │   Support   │             │
│  │  Detector    │  │  Manager   │  │   Bot       │             │
│  │              │  │            │  │   Client    │             │
│  └──────────────┘  └────────────┘  └──────┬──────┘             │
│                                             │                     │
│                                      ┌──────▼──────┐             │
│                                      │  Response   │             │
│                                      │  Formatter  │             │
│                                      └─────────────┘             │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
         │                                   │
         ▼                                   ▼
┌──────────────────┐              ┌──────────────────┐
│ AI Coding Agents │              │  Support Bot     │
│ (Clients)        │              │  (Cloudflare)    │
└──────────────────┘              └──────────────────┘
```

### Module Structure

```
support-worker/
├── server.js                 # Main server entry point
├── package.json
├── tsconfig.json
├── src/
│   ├── routes/
│   │   ├── status.ts        # GET /v1/status
│   │   ├── session.ts       # POST /v1/session
│   │   ├── chat.ts          # POST /v1/chat
│   │   └── stream.ts        # GET /v1/stream
│   ├── handlers/
│   │   ├── websocket.ts     # WebSocket connection handler
│   │   └── sse.ts           # SSE stream handler
│   ├── services/
│   │   ├── agent-detector.ts    # Agent type detection
│   │   ├── session-manager.ts   # Session CRUD operations
│   │   ├── support-bot-client.ts # Support Bot API client
│   │   └── response-formatter.ts # Response formatting
│   ├── middleware/
│   │   ├── cors.ts          # CORS configuration
│   │   ├── error-handler.ts # Error handling middleware
│   │   └── logger.ts        # Request logging
│   ├── types/
│   │   ├── api.ts           # API request/response types
│   │   ├── session.ts       # Session types
│   │   └── agent.ts         # Agent detection types
│   └── utils/
│       ├── uuid.ts          # UUID generation utilities
│       └── config.ts        # Configuration management
├── tests/
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── websocket/           # WebSocket tests
├── examples/
│   ├── claude-code.ts       # Claude Code examples
│   ├── gemini-cli.sh        # Gemini CLI examples
│   ├── aider.sh             # Aider examples
│   └── cursor.py            # Cursor examples
└── README.md
```

### Technology Stack Rationale

- **Node.js 18+**: Async/await, fetch API built-in
- **Express 4.18**: Mature HTTP server with middleware support
- **ws 8.14**: Fast WebSocket implementation with broad compatibility
- **TypeScript 5**: Type safety and better developer experience
- **Vitest**: Fast unit test framework with ESM support
- **UUID 9**: Standard UUID generation for session IDs

### API Design Principles

1. **HTTP-First**: All functionality available via HTTP, WebSocket is enhancement
2. **JSON-Only**: All requests and responses use JSON format
3. **Semantic Status Codes**: Proper HTTP status (200, 201, 400, 500)
4. **Consistent Error Format**: All errors return `{ error: string, field?: string }`
5. **Auto-Session Creation**: No explicit session creation required for simple use cases

### Support Bot Integration Strategy

1. **Lazy Forwarding**: Only forward to Support Bot when local patterns don't match
2. **Conversation Mode**: Use SPEC-AGENT-COMM-001 conversation mode for multi-turn dialog
3. **Graceful Degradation**: If Support Bot unavailable, fall back to local responses
4. **Context Preservation**: Forward all context (analysis, attempts, errors) to Support Bot

---

## Development Workflow

### Implementation Order

**Phase 1: Foundation (P0-1)**
1. Set up TypeScript project structure
2. Implement core HTTP routes
3. Add error handling middleware
4. Write basic tests

**Phase 2: WebSocket (P0-2)**
1. Implement WebSocket handler
2. Add session management for WebSocket
3. Test WebSocket connections

**Phase 3: Integration (P0-3, P1-1)**
1. Create Support Bot client
2. Implement agent detection
3. Connect chat endpoint to Support Bot

**Phase 4: Enhancement (P1-2, P1-3)**
1. Add session persistence
2. Implement TTL and cleanup
3. Increase test coverage to 85%

**Phase 5: Production Ready (P2)**
1. Complete documentation
2. Add configuration options
3. Create agent-specific examples

### Quality Gates

Each phase must pass:

- **LSP Clean**: Zero TypeScript errors
- **Tests Pass**: All tests in phase pass
- **Coverage**: New code has >= 85% coverage
- **Documentation**: New APIs have documentation

---

## Risk Response Plans

### Port Already in Use

**Detection**: EADDRINUSE error on server start

**Response**:
1. Log warning with suggested PORT value
2. Auto-increment PORT and retry
3. Log final PORT on successful start

### Memory Limit Exceeded

**Detection**: Monitor session count and memory usage

**Response**:
1. Implement session TTL (default 30 minutes)
2. Add cleanup task to remove expired sessions
3. Log warning when approaching limit

### Support Bot Unavailable

**Detection**: Network errors or 5xx from Support Bot

**Response**:
1. Fall back to local pattern-matching responses
2. Log error for monitoring
3. Return degraded response with error notice

---

## Migration from PoC

### Files to Migrate

From `support-worker/` PoC:
- `server.js` → Refactor into module structure
- `package.json` → Update dependencies, add dev dependencies
- `README.md` → Expand with comprehensive documentation

### Breaking Changes

None. PoC API will remain compatible.

---

## Definition of Done

A milestone is complete when:

- [ ] All tasks in milestone are implemented
- [ ] All acceptance criteria are met
- [ ] Tests pass with >= 85% coverage
- [ ] LSP shows zero errors
- [ ] Documentation is updated
- [ ] Code is committed to feature branch
