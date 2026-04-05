---
spec_id: SPEC-SUPPORT-AGENT-001
version: "1.0.0"
created: "2026-02-04"
updated: "2026-02-04"
---

# SPEC-SUPPORT-AGENT-001 Implementation Plan: Support Agent System

## 1. Milestone Overview

### Phase 1: Core Infrastructure (Priority: High)

Establish the foundation for the Support Agent system including session management, rate limiting, and basic API endpoints.

### Phase 2: Chat Engine & LLM Integration (Priority: High)

Implement the core chat functionality with Workers AI integration and session management.

### Phase 3: Vectorize RAG Integration (Priority: High)

Set up Cloudflare Vectorize for codebase semantic search and context injection.

### Phase 4: Deep Mode & Claude API (Priority: Medium)

Add Claude API integration for complex queries and implement mode selection logic.

### Phase 5: HQ Dashboard Integration (Priority: Medium)

Build the administrative dashboard for monitoring and managing support sessions.

### Phase 6: Bug Report & Issue Tracking (Priority: Low)

Implement automated bug report generation and GitHub integration.

---

## 2. Detailed Implementation Plan

### Phase 1: Core Infrastructure

**M1-T1: License Validation Module**

- Directory: `support-agent-worker/src/lib/auth.ts`
- Content:
  - `validateLicenseKey(key)`: Verify against HQ `clients` table
  - `checkSubscriptionTier(clientId)`: Get tier for rate limiting
  - `isLicenseExpired(client)`: Check expiration date
- Dependencies: HQ D1 database connection
- Related Requirements: REQ-SA-001

**M1-T2: Session Manager**

- Directory: `support-agent-worker/src/lib/session.ts`
- Content:
  - `createSession(clientId, clientInfo)`: Initialize new session
  - `getSession(sessionId)`: Retrieve session by ID
  - `updateSessionActivity(sessionId)`: Update last_activity_at
  - `expireSession(sessionId)`: Mark session as expired
  - Session timeout: 30 minutes of inactivity
- Database: `support_sessions` table in D1
- Related Requirements: REQ-SA-002, REQ-SA-005

**M1-T3: Data Sanitizer**

- Directory: `support-agent-worker/src/lib/sanitizer.ts`
- Content:
  - `maskSensitiveData(text)`: Regex-based PII masking
  - Patterns: email, phone, IP, API keys, credentials
  - `sanitizeCodeSnippet(code)`: Remove embedded secrets
  - `prepareForStorage(message)`: Full sanitization pipeline
- Related Requirements: REQ-SA-003, REQ-SA-012

**M1-T4: Audit Logger**

- Directory: `support-agent-worker/src/lib/logger.ts`
- Content:
  - `logSessionStart(session)`: Record session creation
  - `logMessage(sessionId, message)`: Record chat messages
  - `logSessionEnd(session, resolved)`: Record session completion
  - Log format: JSON structured for analytics
- Storage: D1 for real-time, R2 for archives
- Related Requirements: REQ-SA-004

**M1-T5: Session Start Endpoint**

- File: `support-agent-worker/src/routes/session-start.ts`
- Endpoint: `POST /support/session/start`
- Flow:
  1. Validate license key
  2. Check rate limits
  3. Create session record
  4. Return session_id and rate_limit info
- Related Requirements: REQ-SA-005

**M1-T6: Rate Limiter**

- Directory: `support-agent-worker/src/lib/rate-limit.ts`
- Content:
  - `checkRateLimit(clientId, tier)`: Verify limits not exceeded
  - `incrementSessionCount(clientId)`: Track daily sessions
  - `incrementMessageCount(sessionId)`: Track per-session messages
  - `resetDailyLimits()`: Scheduled reset (cron)
- Tier limits:
  - free: 10 sessions/day, 20 messages/session
  - basic: 50 sessions/day, 50 messages/session
  - pro: unlimited
- Related Requirements: REQ-SA-009

**M1-T7: Session Isolation**

- Implementation across all modules
- Ensure queries always include `session_id` or `client_id` filter
- No cross-client data in responses
- Separate logging streams per client
- Related Requirements: REQ-SA-013

### Phase 2: Chat Engine & LLM Integration

**M2-T1: Chat Endpoint**

- File: `support-agent-worker/src/routes/chat.ts`
- Endpoint: `POST /support/chat`
- Flow:
  1. Validate session
  2. Check message rate limit
  3. Process message through RAG
  4. Select LLM mode
  5. Generate response
  6. Log and return
- Related Requirements: REQ-SA-006

**M2-T2: Session End Endpoint**

- File: `support-agent-worker/src/routes/session-end.ts`
- Endpoint: `POST /support/session/end`
- Flow:
  1. Validate session
  2. Mark session complete
  3. Generate issue ID
  4. Archive to R2
  5. Return confirmation
- Related Requirements: REQ-SA-007

**M2-T3: Bug Report Endpoint**

- File: `support-agent-worker/src/routes/bug-report.ts`
- Endpoint: `POST /support/report-bug`
- Flow:
  1. Validate license key
  2. Format bug report
  3. Create GitHub issue (optional)
  4. Store in D1
  5. Return URLs
- Related Requirements: REQ-SA-008

**M2-T4: LLM Mode Selector**

- Directory: `support-agent-worker/src/lib/llm-router.ts`
- Content:
  - `selectMode(query, context, tier)`: Determine basic vs deep
  - Criteria:
    - Query length (< 200 tokens = basic)
    - Pattern matching (FAQ = basic)
    - Code analysis required = deep
    - Multi-file context = deep
  - Tier restrictions: free = no deep mode
- Related Requirements: REQ-SA-010

**M2-T5: Response Validator**

- Directory: `support-agent-worker/src/lib/response-validator.ts`
- Content:
  - `validateResponse(response)`: Check for harmful content
  - `checkSystemAccess(response)`: No command execution
  - `filterSensitiveInfo(response)`: Remove any leaked data
- Related Requirements: REQ-SA-014

**M2-T6: Prompt Guard**

- Directory: `support-agent-worker/src/lib/prompt-guard.ts`
- Content:
  - `sanitizeUserInput(input)`: Remove injection attempts
  - `buildSecurePrompt(systemPrompt, context, userMessage)`: Safe assembly
  - `detectInjectionAttempt(text)`: Pattern matching for attacks
- Patterns to block:
  - "ignore previous instructions"
  - System prompt extraction attempts
  - Role/character changes
- Related Requirements: REQ-SA-015

**M2-T7: Workers AI Integration**

- Directory: `support-agent-worker/src/lib/llm/workers-ai.ts`
- Content:
  - `generateBasicResponse(context, messages)`: Call Workers AI
  - Model: `@cf/meta/llama-3.1-8b-instruct`
  - System prompt: Clinic-OS support context
  - Temperature: 0.7
  - Max tokens: 2048

### Phase 3: Vectorize RAG Integration

**M3-T1: Vectorize Setup**

- Configuration: `wrangler.toml` additions
- Index: `clinic-os-codebase`
- Dimensions: 1536 (OpenAI ada-002 compatible)
- Metric: cosine similarity
- Related Requirements: REQ-SA-011

**M3-T2: Embedding Pipeline**

- Directory: `support-agent-worker/src/lib/vectorize/embedder.ts`
- Content:
  - `generateEmbedding(text)`: Create vector from text
  - `chunkDocument(content)`: Split large files
  - `prepareMetadata(file)`: Extract file info
- Chunk size: 1000 tokens with 200 token overlap

**M3-T3: GitHub Webhook Handler**

- File: `support-agent-worker/src/routes/webhook-github.ts`
- Endpoint: `POST /webhook/github`
- Flow:
  1. Verify webhook signature
  2. Parse push event
  3. Get changed files
  4. Generate embeddings
  5. Upsert to Vectorize
- Triggers: Push to main branch

**M3-T4: Semantic Search**

- Directory: `support-agent-worker/src/lib/vectorize/search.ts`
- Content:
  - `searchCodebase(query, topK=5)`: Find relevant code
  - `searchDocs(query, topK=3)`: Find relevant docs
  - `combineResults(codeResults, docResults)`: Merge and rank
- Relevance threshold: 0.7 minimum score

**M3-T5: Context Builder**

- Directory: `support-agent-worker/src/lib/context-builder.ts`
- Content:
  - `buildRAGContext(query)`: Complete RAG pipeline
  - `formatCodeContext(results)`: Format code snippets
  - `formatDocContext(results)`: Format documentation
  - `truncateContext(context, maxTokens)`: Fit token limit

### Phase 4: Deep Mode & Claude API

**M4-T1: Claude API Integration**

- Directory: `support-agent-worker/src/lib/llm/claude.ts`
- Content:
  - `generateDeepResponse(context, messages)`: Call Claude API
  - Model: `claude-3-haiku-20240307`
  - System prompt: Extended Clinic-OS context
  - Temperature: 0.5
  - Max tokens: 4096

**M4-T2: Mode Escalation**

- Enhancement to `llm-router.ts`
- Content:
  - `shouldEscalate(query, basicResponse)`: Check if deep mode needed
  - Criteria:
    - Basic response confidence < 0.6
    - User explicitly requests deep analysis
    - Code debugging with stack traces
  - User confirmation before escalation (optional)

**M4-T3: Deep Mode Rate Tracking**

- Enhancement to `rate-limit.ts`
- Content:
  - `incrementDeepModeCount(clientId)`: Track daily deep mode usage
  - `checkDeepModeLimit(clientId, tier)`: Verify tier access
- Limits:
  - free: 0 deep mode calls
  - basic: 5 deep mode calls/day
  - pro: unlimited

### Phase 5: HQ Dashboard Integration

**M5-T1: Dashboard Overview API**

- File: `hq/src/index.js` additions
- Endpoints:
  - `GET /api/admin/support/stats`: Overall statistics
  - `GET /api/admin/support/sessions`: Session list
  - `GET /api/admin/support/sessions/:id`: Session detail
- Admin authentication required

**M5-T2: Dashboard UI Components**

- Directory: Inline in `hq/src/index.js` (matching existing pattern)
- Components:
  - Support Overview card
  - Sessions table with filters
  - Session detail modal
  - Issue list view

**M5-T3: Export Functionality**

- Endpoint: `GET /api/admin/support/export`
- Formats: CSV, JSON
- Filters: date range, client, status
- Masking: PII removed in exports

**M5-T4: Settings Management**

- Endpoint: `PUT /api/admin/support/settings`
- Configurable:
  - Default LLM mode
  - Rate limits by tier
  - Session timeout
  - GitHub integration toggle

### Phase 6: Bug Report & Issue Tracking

**M6-T1: Auto Bug Detection**

- Enhancement to chat processing
- Content:
  - `detectPotentialBug(conversation)`: Pattern analysis
  - `suggestBugReport(session)`: Generate suggestion
- Triggers:
  - Error patterns in 3+ sessions
  - Unresolved sessions with similar issues
- Related Requirements: REQ-SA-016

**M6-T2: Knowledge Base Analytics**

- Directory: `support-agent-worker/src/lib/analytics.ts`
- Content:
  - `trackFAQ(query, response)`: Log common questions
  - `generateFAQReport()`: Weekly summary
  - `suggestDocUpdates()`: Gap analysis
- Storage: D1 aggregation tables
- Related Requirements: REQ-SA-017

**M6-T3: GitHub Issue Integration**

- Directory: `support-agent-worker/src/lib/github.ts`
- Content:
  - `createIssue(bugReport)`: Create GitHub issue
  - `formatIssueBody(session, bugReport)`: Template
  - `linkSessionToIssue(sessionId, issueUrl)`: Update records
- Authentication: GitHub App token

---

## 3. Technical Approach

### 3.1 Architecture Design

```
support-agent-worker/
├── src/
│   ├── index.ts                 # Worker entry point
│   ├── routes/
│   │   ├── session-start.ts     # POST /support/session/start
│   │   ├── chat.ts              # POST /support/chat
│   │   ├── session-end.ts       # POST /support/session/end
│   │   ├── bug-report.ts        # POST /support/report-bug
│   │   ├── session-status.ts    # GET /support/session/:id
│   │   ├── rate-limit.ts        # GET /support/rate-limit
│   │   └── webhook-github.ts    # POST /webhook/github
│   ├── lib/
│   │   ├── auth.ts              # License validation
│   │   ├── session.ts           # Session management
│   │   ├── rate-limit.ts        # Rate limiting
│   │   ├── sanitizer.ts         # Data masking
│   │   ├── logger.ts            # Audit logging
│   │   ├── prompt-guard.ts      # Injection prevention
│   │   ├── response-validator.ts
│   │   ├── context-builder.ts   # RAG context assembly
│   │   ├── llm-router.ts        # Mode selection
│   │   ├── llm/
│   │   │   ├── workers-ai.ts    # Basic mode
│   │   │   └── claude.ts        # Deep mode
│   │   ├── vectorize/
│   │   │   ├── embedder.ts      # Embedding generation
│   │   │   └── search.ts        # Semantic search
│   │   ├── github.ts            # GitHub integration
│   │   └── analytics.ts         # Usage analytics
│   └── types.ts                 # TypeScript definitions
├── migrations/
│   └── 0001_support_agent.sql   # D1 schema
├── wrangler.toml                # Worker configuration
├── package.json
└── tsconfig.json
```

### 3.2 Wrangler Configuration

```toml
name = "clinic-os-support-agent"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "clinic-os-hq"
database_id = "xxx"

[[r2_buckets]]
binding = "ARCHIVE"
bucket_name = "clinic-os-support-archive"

[[vectorize]]
binding = "VECTORIZE"
index_name = "clinic-os-codebase"

[ai]
binding = "AI"

[vars]
ENVIRONMENT = "production"
SESSION_TIMEOUT_MINUTES = "30"
DEFAULT_LLM_MODE = "basic"
```

### 3.3 System Prompts

**Basic Mode System Prompt:**
```
You are the Clinic-OS Support Agent, helping users troubleshoot issues with their Clinic-OS installation.

Context about Clinic-OS:
- Full-stack healthcare management system for clinics
- Built with Astro 5, React 18, Cloudflare Workers, D1, R2
- Multi-tenant architecture with HQ server for central management

Guidelines:
1. Focus on practical solutions
2. Reference specific files and documentation when relevant
3. Ask clarifying questions if the issue is unclear
4. Suggest checking logs or specific configurations
5. Do not execute any commands - only provide guidance

Relevant codebase context will be provided for each query.
```

**Deep Mode System Prompt:**
```
You are an expert Clinic-OS developer providing in-depth technical support.

You have access to the full codebase context and can:
1. Analyze complex code interactions
2. Debug multi-file issues
3. Explain architecture decisions
4. Suggest code modifications with examples

Always:
- Cite specific file paths and line numbers
- Explain the reasoning behind suggestions
- Consider edge cases and error handling
- Maintain compatibility with the existing architecture

The user is a developer working with a local LLM that needs your expertise.
```

---

## 4. Risk Assessment and Mitigation

### 4.1 Technical Risks

**Risk 1: Vectorize Cold Start Latency**

- Description: First query after index update may be slow
- Impact: User experience degradation
- Mitigation: Pre-warm index with scheduled queries
- Alternative: Cache frequent search results

**Risk 2: Claude API Rate Limits**

- Description: High usage may hit Claude API limits
- Impact: Deep mode unavailable
- Mitigation: Implement queue with graceful degradation
- Alternative: Fall back to Workers AI with extended context

**Risk 3: Prompt Injection Attacks**

- Description: Users may try to manipulate LLM behavior
- Impact: Security/reputation damage
- Mitigation: Multi-layer input sanitization, output validation
- Monitoring: Log and alert on suspicious patterns

### 4.2 Business Risks

**Risk 4: Cost Overrun on Claude API**

- Description: Heavy deep mode usage exceeds budget
- Impact: Operating costs exceed $100/month
- Mitigation: Strict rate limiting by tier
- Monitoring: Daily cost alerts

**Risk 5: Low Adoption**

- Description: Local LLMs don't integrate the API
- Impact: Feature unused
- Mitigation: Provide integration guides, SDK
- Alternative: Web-based fallback interface

---

## 5. Verification Plan

### 5.1 Unit Tests

- License validation logic
- Session creation/expiration
- Rate limit calculations
- Data sanitization patterns
- LLM mode selection

### 5.2 Integration Tests

- Full session lifecycle: start -> chat -> end
- Vectorize search accuracy
- Rate limiting enforcement
- Cross-client isolation verification

### 5.3 Load Tests

- 100 concurrent sessions
- 1000 messages/minute
- Vectorize search under load
- Claude API fallback behavior

### 5.4 Security Tests

- Prompt injection attempts
- Cross-client data leakage
- Rate limit bypass attempts
- License validation edge cases

---

## 6. Traceability Matrix

| Task ID | Related Requirements | Verification Items |
|---------|---------------------|-------------------|
| M1-T1 | REQ-SA-001 | AC-SA-001 |
| M1-T2 | REQ-SA-002, REQ-SA-005 | AC-SA-002, AC-SA-005 |
| M1-T3 | REQ-SA-003, REQ-SA-012 | AC-SA-003, AC-SA-012 |
| M1-T4 | REQ-SA-004 | AC-SA-004 |
| M1-T5 | REQ-SA-005 | AC-SA-005 |
| M1-T6 | REQ-SA-009 | AC-SA-009 |
| M1-T7 | REQ-SA-013 | AC-SA-013 |
| M2-T1 | REQ-SA-006 | AC-SA-006 |
| M2-T2 | REQ-SA-007 | AC-SA-007 |
| M2-T3 | REQ-SA-008 | AC-SA-008 |
| M2-T4 | REQ-SA-010 | AC-SA-010 |
| M2-T5 | REQ-SA-014 | AC-SA-014 |
| M2-T6 | REQ-SA-015 | AC-SA-015 |
| M3-T1 | REQ-SA-011 | AC-SA-011 |
| M4-T1 | REQ-SA-010 | AC-SA-010 |
| M6-T1 | REQ-SA-016 | AC-SA-016 |
| M6-T2 | REQ-SA-017 | AC-SA-017 |
