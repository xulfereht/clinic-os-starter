---
id: SPEC-SUPPORT-AGENT-001
version: "1.0.0"
status: draft
created: "2026-02-04"
updated: "2026-02-04"
author: "Claude"
priority: P1
tags: [ai, support, agent-to-agent, troubleshooting, rag, vectorize]
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-04 | Claude | Initial version created |

---

# SPEC-SUPPORT-AGENT-001: Support Agent - Agent-to-Agent Collaboration System

## 1. Overview

### 1.1 Background

Clinic-OS clients run local LLM agents (such as Gemini) for day-to-day troubleshooting and assistance. However, these local agents have limited knowledge about the Clinic-OS codebase and cannot resolve complex technical issues. Currently, users must manually submit bug reports or search documentation, creating friction and delays in problem resolution.

**Problem Statement:**
- Local LLMs lack codebase context for Clinic-OS-specific issues
- No automated escalation path for complex problems
- Bug reports are often incomplete due to missing context
- Support burden falls entirely on human operators

### 1.2 Solution Summary

The Support Agent system enables seamless Agent-to-Agent collaboration where local LLMs can programmatically request help from an HQ-hosted Support Agent. The Support Agent has comprehensive codebase knowledge via Cloudflare Vectorize (RAG) and can engage in multi-turn conversations to diagnose and resolve issues.

### 1.3 Goals

- Enable local LLMs to escalate complex issues to HQ Support Agent
- Provide codebase-aware troubleshooting through semantic search (Vectorize RAG)
- Support both fast (Workers AI) and deep analysis (Claude API) modes
- Log all support sessions for pattern analysis and bug detection
- Reduce manual support burden by 50%+ through automated first-line support

### 1.4 Non-Goals

- Replacing human support entirely (escalation path to humans preserved)
- Real-time voice/video support
- Automatic code fixes or deployments to client systems
- Training or fine-tuning the LLM models
- Supporting non-Clinic-OS related queries

---

## 2. Requirements (EARS Format)

### 2.1 Ubiquitous Requirements (Always Active)

**REQ-SA-001: License Key Validation**

> The system shall **always** validate the license key on every API request before processing.

- License key must exist in the HQ `clients` table
- Client status must be `approved` and `is_active = 1`
- Expired licenses (`expires_at < current_date`) shall be rejected
- Invalid requests return 401 Unauthorized with error code `INVALID_LICENSE`

**REQ-SA-002: Session Timeout Enforcement**

> The system shall **always** enforce a 30-minute session timeout for all support sessions.

- Sessions inactive for 30 minutes shall be automatically terminated
- Terminated sessions cannot accept new messages
- Session expiration is tracked via `expires_at` timestamp in D1

**REQ-SA-003: Sensitive Data Masking**

> The system shall **always** mask sensitive data in logged conversations.

- Patient names, phone numbers, and email addresses shall be masked
- Database credentials and API keys shall be removed
- IP addresses shall be anonymized in logs
- Pattern-based masking applied before storage

**REQ-SA-004: Audit Logging**

> The system shall **always** log all support interactions for audit purposes.

- Session start/end timestamps
- Message count and modes used
- Resolution status
- Client and license information (anonymized for analytics)

### 2.2 Event-Driven Requirements (Trigger-Response)

**REQ-SA-005: Session Initialization**

> **WHEN** a valid license key calls `POST /support/session/start` **THEN** the system shall create a new support session and return a session ID.

Request:
```json
{
  "license_key": "string",
  "client_info": {
    "version": "1.2.2",
    "clinic_name": "string",
    "local_llm": "gemini-1.5-flash",
    "os": "macOS 14.0",
    "error_context": "string (optional)"
  }
}
```

Response:
```json
{
  "session_id": "uuid",
  "expires_at": "ISO8601 timestamp",
  "rate_limit": {
    "messages_remaining": 20,
    "sessions_remaining_today": 9
  }
}
```

**REQ-SA-006: Chat Message Processing**

> **WHEN** a valid session sends a message via `POST /support/chat` **THEN** the system shall process the message and return an AI-generated response.

Request:
```json
{
  "session_id": "uuid",
  "message": {
    "type": "question|follow_up|clarification",
    "human_request": "Original user question",
    "attempted_solution": "What was tried",
    "error_details": "Error messages/stack traces",
    "local_context": {
      "relevant_code": "code snippet",
      "file_path": "src/lib/example.ts",
      "recent_changes": "description"
    }
  }
}
```

Response:
```json
{
  "response": "AI response text",
  "suggestions": ["suggestion 1", "suggestion 2"],
  "need_more_info": false,
  "mode_used": "basic|deep",
  "relevant_docs": [
    {"title": "Doc Title", "path": "docs/example.md", "relevance": 0.92}
  ],
  "code_references": [
    {"file": "src/lib/example.ts", "lines": "45-67", "relevance": 0.88}
  ]
}
```

**REQ-SA-007: Session Termination**

> **WHEN** `POST /support/session/end` is called **THEN** the system shall close the session and archive the conversation log.

Request:
```json
{
  "session_id": "uuid",
  "resolved": true,
  "summary": "Issue description and resolution"
}
```

Response:
```json
{
  "logged": true,
  "issue_id": "ISSUE-2026-02-001",
  "feedback_url": "https://hq.clinic-os.com/feedback/ISSUE-2026-02-001"
}
```

**REQ-SA-008: Bug Report Generation**

> **WHEN** `POST /support/report-bug` is called **THEN** the system shall create a structured bug report and optionally create a GitHub issue.

Request:
```json
{
  "license_key": "string",
  "bug_description": "string",
  "steps_to_reproduce": ["step1", "step2"],
  "code_snippet": "optional code",
  "session_id": "optional - link to support session"
}
```

Response:
```json
{
  "github_issue_url": "https://github.com/org/clinic-os/issues/123",
  "internal_id": "BUG-2026-02-001"
}
```

### 2.3 State-Driven Requirements (Conditional)

**REQ-SA-009: Rate Limiting by Tier**

> **IF** a client's subscription tier is "free" **THEN** the system shall limit to 10 sessions/day and 20 messages/session.
> **IF** a client's subscription tier is "basic" **THEN** the system shall limit to 50 sessions/day and 50 messages/session.
> **IF** a client's subscription tier is "pro" **THEN** the system shall allow unlimited sessions and messages.

| Tier | Sessions/Day | Messages/Session | Deep Mode Access |
|------|--------------|------------------|------------------|
| free | 10 | 20 | No |
| basic | 50 | 50 | Limited (5/day) |
| pro | Unlimited | Unlimited | Unlimited |

**REQ-SA-010: LLM Mode Selection**

> **IF** the query is simple (< 200 tokens, common patterns) **THEN** use Workers AI (Llama 3.1 8B).
> **IF** the query is complex (code analysis, multi-file issues) **AND** client has deep mode access **THEN** use Claude API.

Mode selection criteria:
- **Basic Mode (Workers AI)**: FAQ-type questions, simple configuration issues, documentation lookups
- **Deep Mode (Claude API)**: Code debugging, architecture questions, multi-file analysis, complex integrations

**REQ-SA-011: Vectorize RAG Integration**

> **IF** a support query is received **THEN** the system shall search Cloudflare Vectorize for relevant codebase context before generating a response.

- Semantic search with top-k=5 results
- Relevance threshold: 0.7 minimum score
- Context injection into LLM prompt
- Source attribution in responses

### 2.4 Unwanted Requirements (Prohibitions)

**REQ-SA-012: No Raw Code Storage**

> The system shall **not** store raw code snippets from client queries beyond the session lifetime.

- Code snippets processed in memory only
- Session logs contain only masked/summarized versions
- R2 archives contain anonymized conversation logs only

**REQ-SA-013: No Cross-Client Data Leakage**

> The system shall **not** include any data from other clients in responses.

- Session isolation enforced at database level
- RAG search limited to public codebase (not client-specific data)
- No response caching across different clients

**REQ-SA-014: No Direct System Access**

> The system shall **not** execute commands or access client systems directly.

- Responses are advisory only
- No SSH, API calls, or remote execution capabilities
- All actions require human or local LLM execution

**REQ-SA-015: Prompt Injection Prevention**

> The system shall **not** allow user input to modify system prompts or bypass safety measures.

- Input sanitization before LLM processing
- System prompt protected from injection
- Output filtering for harmful content

### 2.5 Optional Requirements (Nice-to-Have)

**REQ-SA-016: Auto Bug Report Suggestion**

> **Where possible**, the system shall suggest creating a bug report when detecting recurring issues across sessions.

**REQ-SA-017: Knowledge Base Self-Learning**

> **Where possible**, the system shall track frequently asked questions to improve documentation.

---

## 3. Technical Specification

### 3.1 Architecture Overview

```
                                    CLINIC-OS HQ
                    ┌────────────────────────────────────────────┐
                    │                                            │
                    │  ┌──────────────────────────────────────┐  │
                    │  │     support-agent-worker/            │  │
 Local LLM          │  │  ┌─────────┐    ┌──────────────┐    │  │
 (Gemini)           │  │  │ Router  │────│ Rate Limiter │    │  │
    │               │  │  └────┬────┘    └──────────────┘    │  │
    │ REST API      │  │       │                              │  │
    ▼               │  │  ┌────▼─────────────────────────┐   │  │
┌────────┐          │  │  │      Session Manager         │   │  │
│ Client │──────────┼──┼──│  ┌─────────┐ ┌───────────┐  │   │  │
│ Clinic │          │  │  │  │ D1 Store│ │ R2 Archive│  │   │  │
└────────┘          │  │  │  └─────────┘ └───────────┘  │   │  │
                    │  │  └────────────┬─────────────────┘   │  │
                    │  │               │                      │  │
                    │  │  ┌────────────▼────────────────┐    │  │
                    │  │  │      RAG Engine             │    │  │
                    │  │  │  ┌────────────────────┐    │    │  │
                    │  │  │  │ Cloudflare Vectorize│    │    │  │
                    │  │  │  │ (Codebase Index)   │    │    │  │
                    │  │  │  └────────────────────┘    │    │  │
                    │  │  └────────────┬───────────────┘    │  │
                    │  │               │                      │  │
                    │  │  ┌────────────▼───────────────────┐ │  │
                    │  │  │        LLM Router              │ │  │
                    │  │  │  ┌──────────┐ ┌─────────────┐ │ │  │
                    │  │  │  │Workers AI│ │ Claude API  │ │ │  │
                    │  │  │  │(Basic)   │ │ (Deep Mode) │ │ │  │
                    │  │  │  └──────────┘ └─────────────┘ │ │  │
                    │  │  └────────────────────────────────┘ │  │
                    │  └──────────────────────────────────────┘  │
                    │                                            │
                    │  ┌──────────────────────────────────────┐  │
                    │  │       GitHub Webhook                 │  │
                    │  │  (Code Sync → Vectorize Embeddings)  │  │
                    │  └──────────────────────────────────────┘  │
                    └────────────────────────────────────────────┘
```

### 3.2 Data Flow

```
1. Session Start
   Client ─────▶ /support/session/start ─────▶ Validate License
                                               │
                                               ▼
                                          Create Session (D1)
                                               │
                                               ▼
                                          Return session_id

2. Chat Flow
   Client ─────▶ /support/chat ─────▶ Validate Session
                                       │
                                       ▼
                                  Semantic Search (Vectorize)
                                       │
                                       ▼
                                  Build Context (RAG)
                                       │
                                       ▼
                                  Select LLM Mode
                                       │
                         ┌─────────────┴─────────────┐
                         ▼                           ▼
                   Workers AI                   Claude API
                   (Basic Mode)                (Deep Mode)
                         │                           │
                         └─────────────┬─────────────┘
                                       ▼
                                  Format Response
                                       │
                                       ▼
                                  Log Message (D1)
                                       │
                                       ▼
                                  Return Response

3. Session End
   Client ─────▶ /support/session/end ─────▶ Mark Session Complete
                                              │
                                              ▼
                                         Archive to R2
                                              │
                                              ▼
                                         Generate Issue ID
```

### 3.3 Database Schema (D1)

```sql
-- Support Sessions
CREATE TABLE support_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    client_id TEXT NOT NULL REFERENCES clients(id),
    license_key TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'expired', 'archived'
    client_info TEXT, -- JSON: version, clinic_name, local_llm, os
    message_count INTEGER DEFAULT 0,
    deep_mode_count INTEGER DEFAULT 0,
    resolved INTEGER DEFAULT 0,
    summary TEXT,
    issue_id TEXT,
    started_at INTEGER DEFAULT (unixepoch()),
    last_activity_at INTEGER DEFAULT (unixepoch()),
    expires_at INTEGER,
    ended_at INTEGER,
    archived_at INTEGER
);

CREATE INDEX idx_sessions_client ON support_sessions(client_id);
CREATE INDEX idx_sessions_status ON support_sessions(status);
CREATE INDEX idx_sessions_expires ON support_sessions(expires_at);

-- Support Messages
CREATE TABLE support_messages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id TEXT NOT NULL REFERENCES support_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user', 'assistant'
    content TEXT NOT NULL, -- Masked/sanitized
    message_type TEXT, -- 'question', 'follow_up', 'clarification'
    mode_used TEXT, -- 'basic', 'deep'
    relevant_docs TEXT, -- JSON array
    code_references TEXT, -- JSON array
    created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_messages_session ON support_messages(session_id);

-- Rate Limiting
CREATE TABLE support_rate_limits (
    client_id TEXT PRIMARY KEY REFERENCES clients(id),
    date TEXT NOT NULL, -- YYYY-MM-DD
    session_count INTEGER DEFAULT 0,
    deep_mode_count INTEGER DEFAULT 0,
    last_reset_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(client_id, date)
);

-- Issue Tracking
CREATE TABLE support_issues (
    id TEXT PRIMARY KEY, -- ISSUE-YYYY-MM-NNN format
    session_id TEXT REFERENCES support_sessions(id),
    client_id TEXT REFERENCES clients(id),
    type TEXT NOT NULL, -- 'bug', 'feature_request', 'question'
    title TEXT NOT NULL,
    description TEXT,
    github_issue_url TEXT,
    status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_issues_client ON support_issues(client_id);
CREATE INDEX idx_issues_status ON support_issues(status);
```

### 3.4 API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /support/session/start | Initialize new support session | License Key |
| POST | /support/chat | Send message and receive response | Session ID |
| POST | /support/session/end | Close session and archive | Session ID |
| GET | /support/session/:id | Get session status and history | Session ID |
| POST | /support/report-bug | Create bug report | License Key |
| GET | /support/rate-limit | Check remaining rate limits | License Key |

### 3.5 Vectorize Configuration

```toml
# wrangler.toml addition
[[vectorize]]
binding = "VECTORIZE_INDEX"
index_name = "clinic-os-codebase"

# Index Configuration
# - Dimensions: 1536 (OpenAI ada-002 compatible)
# - Metric: cosine
# - Source: GitHub webhook → embedding pipeline
```

Indexed content:
- `src/**/*.ts` - All TypeScript source files
- `src/**/*.astro` - Astro components
- `docs/**/*.md` - Documentation files
- `migrations/**/*.sql` - Database schemas
- `CHANGELOG.md` - Version history

### 3.6 LLM Configuration

**Workers AI (Basic Mode):**
- Model: `@cf/meta/llama-3.1-8b-instruct`
- Max tokens: 2048
- Temperature: 0.7
- Use case: FAQ, simple config issues, doc lookups

**Claude API (Deep Mode):**
- Model: `claude-3-haiku-20240307`
- Max tokens: 4096
- Temperature: 0.5
- Use case: Code debugging, architecture, complex analysis

---

## 4. Constraints

### 4.1 Performance Requirements

- Session creation: P95 < 100ms
- Chat response (basic mode): P95 < 3s
- Chat response (deep mode): P95 < 10s
- Vectorize search: P95 < 200ms

### 4.2 Security Requirements

- All communication over HTTPS
- License key validation on every request
- Input sanitization for XSS/injection prevention
- Sensitive data masking before storage
- No PII in logs (GDPR compliance)
- Rate limiting to prevent abuse

### 4.3 Scalability Requirements

- Support 1000 concurrent sessions
- Handle 10,000 messages/hour peak load
- Vectorize index up to 100,000 documents

### 4.4 Cost Constraints

| Component | Estimated Monthly Cost |
|-----------|----------------------|
| Workers (requests) | $0-5 (free tier covers most) |
| D1 Storage | $0-5 (included in Workers) |
| R2 Storage | $0-5 (15GB free) |
| Vectorize | $0-10 (included in Workers) |
| Workers AI | $0 (free for Workers) |
| Claude API (Haiku) | $30-60 (moderate usage) |
| **Total** | **$30-85/month** |

---

## 5. HQ Dashboard Integration

### 5.1 Overview Tab

- Total sessions (today/week/month)
- Resolution rate percentage
- Average response time
- Active sessions count
- Common issue categories (pie chart)

### 5.2 Sessions Tab

- Filterable list: client, date range, status, resolution
- Session detail view with conversation log
- Export functionality (CSV)

### 5.3 Issues Tab

- Issue list with GitHub sync status
- Pattern detection: recurring issues
- Auto bug report generation suggestions
- Link to related support sessions

### 5.4 Settings Tab

- LLM model selection
- Rate limit configuration by tier
- GitHub webhook configuration
- Vectorize sync status

---

## 6. Traceability

| Requirement ID | plan.md Reference | acceptance.md Reference |
|----------------|-------------------|------------------------|
| REQ-SA-001 | M1-T1 | AC-SA-001 |
| REQ-SA-002 | M1-T2 | AC-SA-002 |
| REQ-SA-003 | M1-T3 | AC-SA-003 |
| REQ-SA-004 | M1-T4 | AC-SA-004 |
| REQ-SA-005 | M1-T5 | AC-SA-005 |
| REQ-SA-006 | M2-T1 | AC-SA-006 |
| REQ-SA-007 | M2-T2 | AC-SA-007 |
| REQ-SA-008 | M2-T3 | AC-SA-008 |
| REQ-SA-009 | M1-T6 | AC-SA-009 |
| REQ-SA-010 | M2-T4 | AC-SA-010 |
| REQ-SA-011 | M3-T1 | AC-SA-011 |
| REQ-SA-012 | M1-T3 | AC-SA-012 |
| REQ-SA-013 | M1-T7 | AC-SA-013 |
| REQ-SA-014 | M2-T5 | AC-SA-014 |
| REQ-SA-015 | M2-T6 | AC-SA-015 |
| REQ-SA-016 | M4-T1 | AC-SA-016 |
| REQ-SA-017 | M4-T2 | AC-SA-017 |
