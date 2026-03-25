---
id: SPEC-SUPPORT-SDK-001
version: 1.0.0
status: draft
created: 2026-02-09
author: moai
priority: P1
lifecycle_level: spec-anchored
tags: [sdk, typescript, rest, sse, websocket, client]
---

# Support Bot SDK - TypeScript Client SDK

## Overview

This SPEC defines a comprehensive TypeScript SDK for the Support Bot system, enabling seamless integration between local coding agents and the Clinic-OS Support Agent. The SDK provides a unified, type-safe interface for all communication protocols (REST, SSE, WebSocket) and abstracts away the complexity of session management, streaming responses, and real-time notifications.

### Problem Statement

Current issues with local client integration:
- API endpoints are documented but scattered across multiple Markdown files
- AI coding agents struggle to discover and use the correct endpoints
- No unified client SDK for easy integration
- Manual session management required for multi-turn conversations
- No built-in support for streaming responses
- WebSocket notifications require separate implementation

### Solution Summary

Create a comprehensive TypeScript SDK package `@clinic-os/support-bot-sdk` that provides:
- Single entry point for all Support Bot APIs
- Automatic session management with `solve()` high-level API
- Full TypeScript type safety with exported interfaces
- JSON Schema as single source of truth for API contracts
- Progressive enhancement: REST (Phase 1) -> SSE (Phase 2) -> WebSocket (Phase 3)
- Backward compatible with existing Cloudflare Workers deployment

### Goals

- **Phase 1 (Foundation)**: REST + Session Management SDK
- **Phase 2 (Real-time)**: SSE Streaming support
- **Phase 3 (Bidirectional)**: WebSocket server + client
- 85%+ test coverage
- Full TypeScript type definitions
- AI agent-friendly API surface (IDE autocomplete)

### Non-Goals

- Python SDK (deferred to future SPEC)
- Support for other transport protocols (gRPC, GraphQL)
- Direct database access or bypassing API layer
- Offline mode or local caching

## Environment

### Current System

- **Support Agent Worker**: Cloudflare Workers (serverless)
- **Existing APIs**: REST endpoints for session, chat, bug-report
- **Deployment**: Cloudflare Workers with D1 database
- **Authentication**: License key via X-License-Key header

### Dependencies

- **Existing SPECs**:
  - SPEC-SUPPORT-AGENT-001: Support Agent architecture
  - SPEC-AGENT-COMM-001: Conversational chat API
- **Client Environments**: Node.js, Browser (with CORS support)

### Constraints

- Must remain backward compatible with existing REST API
- SDK must work in both Node.js and browser environments
- WebSocket server requires separate deployment (Railway/Fly.io)

## EARS Requirements

### Ubiquitous Requirements (Always Active)

**REQ-SDK-001: Type Safety**
> The SDK shall **always** provide TypeScript type definitions for all APIs.

- All public APIs must have exported TypeScript interfaces
- Generic types must be properly constrained
- No `any` types in public API surface

**REQ-SDK-002: Error Handling**
> The SDK shall **always** propagate errors with structured error information.

- Errors include error code, message, and retryable flag
- Network errors are distinguished from API errors
- Rate limit errors include retry-after timestamp

**REQ-SDK-003: License Key Validation**
> The SDK shall **always** validate license key presence before initialization.

**REQ-SDK-004: Backward Compatibility**
> The SDK shall **always** maintain compatibility with existing REST API contracts.

### Event-Driven Requirements (Trigger-Response)

**REQ-SDK-005: Session Initialization**
> **WHEN** `SupportBotSDK.initialize()` is called **THEN** the system shall validate the license key and create a session.

**REQ-SDK-006: Chat Request (Phase 1)**
> **WHEN** `sdk.chat()` is called **THEN** the system shall send a conversational chat request and return the response.

**REQ-SDK-007: Streaming Chat (Phase 2)**
> **WHEN** `sdk.streamChat()` is called **THEN** the system shall establish SSE connection and yield tokens as they arrive.

**REQ-SDK-008: WebSocket Connection (Phase 3)**
> **WHEN** `sdk.connectWebSocket()` is called **THEN** the system shall establish WebSocket connection and register event handlers.

**REQ-SDK-009: Session Expiration**
> **WHEN** a session expires **THEN** the system shall automatically attempt renewal or notify via callback.

**REQ-SDK-010: High-Level solve() API**
> **WHEN** `sdk.solve()` is called **THEN** the system shall automatically manage session lifecycle and return the final result.

### State-Driven Requirements (Conditional)

**REQ-SDK-011: Retry Logic**
> **IF** a request fails with a retryable error **THEN** the system shall automatically retry with exponential backoff.

**REQ-SDK-012: Rate Limit Handling**
> **IF** rate limit is exceeded **THEN** the system shall wait until retry-after time before retrying.

**REQ-SDK-013: Connection State Management**
> **IF** WebSocket connection is lost **THEN** the system shall attempt reconnection with backoff.

### Unwanted Requirements (Prohibitions)

**REQ-SDK-014: No Secrets in SDK**
> The SDK shall **not** store or log license keys or session tokens.

**REQ-SDK-015: No Automatic Session Creation**
> The SDK shall **not** create sessions without explicit user action (except via `solve()`).

**REQ-SDK-016: No Breaking API Changes**
> The SDK shall **not** introduce breaking changes without major version increment.

### Optional Requirements (Nice-to-Have)

**REQ-SDK-017: Request Logging**
> **Where possible**, the SDK shall support optional request/response logging for debugging.

**REQ-SDK-018: Custom Fetch Implementation**
> **Where possible**, the SDK shall allow custom fetch implementation (e.g., for proxy support).

## Specifications

### SP-SDK-001: SDK Package Structure

```
@clinic-os/support-bot-sdk/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # Main entry point
│   ├── client.ts          # SupportBotClient class
│   ├── session.ts         # Session management
│   ├── api/
│   │   ├── rest.ts        # REST API client (Phase 1)
│   │   ├── sse.ts         # SSE streaming (Phase 2)
│   │   └── websocket.ts   # WebSocket client (Phase 3)
│   ├── types.ts           # Exported TypeScript interfaces
│   ├── schemas.ts         # JSON Schema definitions
│   └── utils/
│       ├── context.ts     # Context builder helpers
│       ├── retry.ts       # Retry logic
│       └── errors.ts      # Error classes
├── schemas/
│   ├── session.json       # JSON Schema for session APIs
│   ├── chat.json          # JSON Schema for chat APIs
│   └── common.json        # Shared schemas
└── tests/
    ├── client.test.ts
    ├── session.test.ts
    └── schemas.test.ts
```

### SP-SDK-002: TypeScript API Surface

```typescript
// src/types.ts

/**
 * Main SDK configuration
 */
export interface SupportBotSDKConfig {
  /**
   * Support Agent Worker base URL
   * @default "https://support-agent.clinic-os.com"
   */
  baseURL?: string;

  /**
   * Client license key (required)
   */
  licenseKey: string;

  /**
   * Client information for session creation
   */
  clientInfo: ClientInfo;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Custom fetch implementation (optional)
   */
  fetch?: typeof fetch;

  /**
   * Enable request logging
   * @default false
   */
  logging?: boolean;

  /**
   * Session auto-renewal
   * @default true
   */
  autoRenewSession?: boolean;

  /**
   * Retry configuration
   */
  retry?: RetryConfig;
}

/**
 * Client information (from SPEC-SUPPORT-AGENT-001)
 */
export interface ClientInfo {
  version: string;
  clinic_name: string;
  local_llm: string;
  os: string;
  error_context?: string;
}

/**
 * Session information
 */
export interface Session {
  session_id: string;
  expires_at: Date;
  rate_limit: RateLimitInfo;
}

/**
 * Rate limit information
 */
export interface RetryConfig {
  /**
   * Maximum number of retries
   * @default 3
   */
  maxRetries?: number;

  /**
   * Initial retry delay in milliseconds
   * @default 1000
   */
  initialDelay?: number;

  /**
   * Maximum retry delay in milliseconds
   * @default 10000
   */
  maxDelay?: number;

  /**
   * Backoff multiplier
   * @default 2
   */
  backoffMultiplier?: number;
}

/**
 * Agent context for conversational chat (from SPEC-AGENT-COMM-001)
 */
export interface AgentContext {
  human_request: string;
  attempted_solution?: string;
  error_details?: ErrorDetails;
  local_context?: LocalContext;
  analysis_process?: AnalysisProcess;
  attempts_made?: AttemptMade[];
  session_context?: SessionContext;
}

/**
 * Error details
 */
export interface ErrorDetails {
  message: string;
  stack?: string;
  file?: string;
  line?: number;
}

/**
 * Local context
 */
export interface LocalContext {
  modified_files?: string[];
  related_files?: string[];
  relevant_code?: string;
  file_path?: string;
  recent_changes?: string;
}

/**
 * Analysis process from coding agent
 */
export interface AnalysisProcess {
  problem_identification: string;
  hypothesis_formed: string[];
  root_cause_analysis?: string;
  investigation_steps: string[];
}

/**
 * Attempt made by coding agent
 */
export interface AttemptMade {
  description: string;
  code_changes?: string[];
  config_changes?: string[];
  outcome: 'success' | 'failed' | 'partial_success';
  lessons_learned: string[];
}

/**
 * Session context for conversational mode
 */
export interface SessionContext {
  conversation_history: ConversationTurn[];
  current_goal: string;
  blocked_on: string;
}

/**
 * Conversation turn
 */
export interface ConversationTurn {
  role: 'coding_agent' | 'support_agent';
  content: string;
  timestamp: number;
}

/**
 * Chat response (from SPEC-AGENT-COMM-001)
 */
export interface ChatResponse {
  response: string;
  reasoning?: string;
  confidence: number;
  suggested_actions?: SuggestedAction[];
  follow_up_questions?: string[];
  conversation_state?: ConversationState;
  mode_used: 'conversational';
  relevant_docs?: RelevantDoc[];
  code_references?: CodeReference[];
}

/**
 * Suggested action
 */
export interface SuggestedAction {
  type: 'investigate' | 'modify' | 'configure' | 'verify';
  description: string;
  priority: 'high' | 'medium' | 'low';
  file_path?: string;
  code_snippet?: string;
}

/**
 * Conversation state
 */
export interface ConversationState {
  phase: 'understanding' | 'investigating' | 'resolving' | 'verifying';
  verified_facts: string[];
  remaining_questions: string[];
}

/**
 * Relevant document
 */
export interface RelevantDoc {
  title: string;
  path: string;
  relevance: number;
}

/**
 * Code reference
 */
export interface CodeReference {
  file: string;
  lines: string;
  relevance: number;
}

/**
 * Streaming response (Phase 2)
 */
export interface StreamingChatResponse {
  content: string;
  done: boolean;
  reasoning?: string;
  confidence?: number;
}

/**
 * WebSocket event types (Phase 3)
 */
export type WebSocketEvent =
  | { type: 'connected' }
  | { type: 'disconnected'; code?: number; reason?: string }
  | { type: 'notification'; data: NotificationData }
  | { type: 'error'; error: string };

/**
 * Notification data
 */
export interface NotificationData {
  title: string;
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * SDK error
 */
export class SupportBotSDKError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public retryable: boolean = false,
    public retryAfter?: Date
  ) {
    super(message);
    this.name = 'SupportBotSDKError';
  }
}

/**
 * Error codes (from SPEC-SUPPORT-AGENT-001)
 */
export type ErrorCode =
  | 'INVALID_LICENSE'
  | 'LICENSE_EXPIRED'
  | 'LICENSE_INACTIVE'
  | 'INVALID_SESSION'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'DEEP_MODE_UNAVAILABLE'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT';
```

### SP-SDK-003: Main SDK Class

```typescript
// src/index.ts

export { SupportBotSDK, SupportBotClient } from './client';
export * from './types';
export * from './utils/context';

// Re-export schemas for validation
export * as schemas from './schemas';
```

```typescript
// src/client.ts

import type {
  SupportBotSDKConfig,
  Session,
  AgentContext,
  ChatResponse,
  StreamingChatResponse,
  WebSocketEvent,
  SupportBotSDKError,
} from './types';

/**
 * Main SDK class for Support Bot integration
 *
 * @example
 * ```typescript
 * import { SupportBotSDK } from '@clinic-os/support-bot-sdk';
 *
 * const sdk = SupportBotSDK.initialize({
 *   licenseKey: 'your-license-key',
 *   clientInfo: {
 *     version: '1.0.0',
 *     clinic_name: 'Sample Clinic',
 *     local_llm: 'gemini-1.5-flash',
 *     os: 'macOS 14.0',
 *   },
 * });
 * ```
 */
export class SupportBotSDK {
  private client: SupportBotClient;

  private constructor(config: SupportBotSDKConfig) {
    this.client = new SupportBotClient(config);
  }

  /**
   * Initialize the SDK with configuration
   */
  static initialize(config: SupportBotSDKConfig): SupportBotSDK {
    return new SupportBotSDK(config);
  }

  /**
   * Get current session (creates if not exists)
   */
  async getSession(): Promise<Session> {
    return this.client.getSession();
  }

  /**
   * Send a conversational chat message (Phase 1)
   */
  async chat(context: AgentContext): Promise<ChatResponse> {
    return this.client.chat(context);
  }

  /**
   * Stream chat response via SSE (Phase 2)
   */
  async *streamChat(context: AgentContext): AsyncGenerator<StreamingChatResponse> {
    yield* this.client.streamChat(context);
  }

  /**
   * Connect to WebSocket for real-time notifications (Phase 3)
   */
  connectWebSocket(
    onEvent: (event: WebSocketEvent) => void
  ): WebSocketConnection {
    return this.client.connectWebSocket(onEvent);
  }

  /**
   * High-level API: Automatic session management + chat
   */
  async solve(request: string, context?: Partial<AgentContext>): Promise<ChatResponse> {
    return this.client.solve(request, context);
  }

  /**
   * Close the SDK and cleanup resources
   */
  async close(): Promise<void> {
    return this.client.close();
  }

  /**
   * Get raw client for advanced usage
   */
  get rawClient(): SupportBotClient {
    return this.client;
  }
}

/**
 * Low-level client class
 */
export class SupportBotClient {
  // Implementation details...
}
```

### SP-SDK-004: High-Level solve() API

```typescript
/**
 * High-level API for automatic session management
 *
 * This method handles:
 * - Session creation if not exists
 * - Context building from request
 * - Automatic retries on recoverable errors
 * - Session cleanup on completion
 *
 * @example
 * ```typescript
 * const result = await sdk.solve(
 *   "How do I integrate the payment gateway?",
 *   {
 *     error_details: {
 *       message: "Payment integration failed",
 *       file: "src/lib/payment.ts",
 *     }
 *   }
 * );
 * ```
 */
async solve(
  request: string,
  context?: Partial<AgentContext>
): Promise<ChatResponse> {
  // Build full agent context
  const fullContext: AgentContext = {
    human_request: request,
    ...context,
  };

  // Get or create session
  await this.getSession();

  // Send chat with retry
  return this.retryChat(fullContext);
}
```

### SP-SDK-005: Context Builder Helpers

```typescript
// src/utils/context.ts

import type { AgentContext, ErrorDetails, LocalContext } from '../types';

/**
 * Build agent context from error
 */
export function buildErrorContext(
  error: Error,
  file?: string,
  line?: number
): ErrorDetails {
  return {
    message: error.message,
    stack: error.stack,
    file,
    line,
  };
}

/**
 * Build local context for code-related queries
 */
export function buildLocalContext(
  options: {
    modifiedFiles?: string[];
    relatedFiles?: string[];
    relevantCode?: string;
    filePath?: string;
    recentChanges?: string;
  }
): LocalContext {
  return {
    modified_files: options.modifiedFiles,
    related_files: options.relatedFiles,
    relevant_code: options.relevantCode,
    file_path: options.filePath,
    recent_changes: options.recentChanges,
  };
}

/**
 * Build complete agent context
 */
export function buildAgentContext(
  humanRequest: string,
  options?: {
    attemptedSolution?: string;
    errorDetails?: ErrorDetails;
    localContext?: LocalContext;
    analysisProcess?: {
      problemIdentification: string;
      hypothesisFormed: string[];
      investigationSteps: string[];
    };
    attemptsMade?: Array<{
      description: string;
      outcome: string;
      lessonsLearned: string[];
    }>;
  }
): AgentContext {
  return {
    human_request: humanRequest,
    attempted_solution: options?.attemptedSolution,
    error_details: options?.errorDetails,
    local_context: options?.localContext,
    analysis_process: options?.analysisProcess && {
      problem_identification: options.analysisProcess.problemIdentification,
      hypothesis_formed: options.analysisProcess.hypothesisFormed,
      investigation_steps: options.analysisProcess.investigationSteps,
    },
    attempts_made: options?.attemptsMade?.map(attempt => ({
      description: attempt.description,
      outcome: attempt.outcome as 'success' | 'failed' | 'partial_success',
      lessons_learned: attempt.lessonsLearned,
    })),
  };
}
```

### SP-SDK-006: JSON Schema Definitions

```json
// schemas/session.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://schemas.clinic-os.com/support-bot/session.json",
  "title": "Support Bot Session API",
  "description": "JSON Schema for session management APIs",
  "definitions": {
    "ClientInfo": {
      "type": "object",
      "required": ["version", "clinic_name", "local_llm", "os"],
      "properties": {
        "version": { "type": "string" },
        "clinic_name": { "type": "string" },
        "local_llm": { "type": "string" },
        "os": { "type": "string" },
        "error_context": { "type": "string" }
      }
    },
    "SessionStartRequest": {
      "type": "object",
      "required": ["client_info"],
      "properties": {
        "client_info": { "$ref": "#/definitions/ClientInfo" }
      }
    },
    "SessionStartResponse": {
      "type": "object",
      "required": ["session_id", "expires_at", "rate_limit"],
      "properties": {
        "session_id": { "type": "string" },
        "expires_at": { "type": "string", "format": "date-time" },
        "rate_limit": {
          "type": "object",
          "properties": {
            "messages_remaining": { "type": "integer" },
            "sessions_remaining_today": { "type": "integer" }
          }
        }
      }
    },
    "SessionEndRequest": {
      "type": "object",
      "required": ["session_id", "resolved"],
      "properties": {
        "session_id": { "type": "string" },
        "resolved": { "type": "boolean" },
        "summary": { "type": "string" }
      }
    }
  }
}
```

```json
// schemas/chat.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://schemas.clinic-os.com/support-bot/chat.json",
  "title": "Support Bot Chat API",
  "description": "JSON Schema for chat APIs (SPEC-AGENT-COMM-001)",
  "definitions": {
    "ErrorDetails": {
      "type": "object",
      "properties": {
        "message": { "type": "string" },
        "stack": { "type": "string" },
        "file": { "type": "string" },
        "line": { "type": "integer" }
      }
    },
    "LocalContext": {
      "type": "object",
      "properties": {
        "modified_files": { "type": "array", "items": { "type": "string" } },
        "related_files": { "type": "array", "items": { "type": "string" } },
        "relevant_code": { "type": "string" },
        "file_path": { "type": "string" },
        "recent_changes": { "type": "string" }
      }
    },
    "AgentContext": {
      "type": "object",
      "required": ["human_request"],
      "properties": {
        "human_request": { "type": "string" },
        "attempted_solution": { "type": "string" },
        "error_details": { "$ref": "#/definitions/ErrorDetails" },
        "local_context": { "$ref": "#/definitions/LocalContext" },
        "analysis_process": {
          "type": "object",
          "properties": {
            "problem_identification": { "type": "string" },
            "hypothesis_formed": { "type": "array", "items": { "type": "string" } },
            "root_cause_analysis": { "type": "string" },
            "investigation_steps": { "type": "array", "items": { "type": "string" } }
          }
        },
        "attempts_made": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "description": { "type": "string" },
              "code_changes": { "type": "array", "items": { "type": "string" } },
              "config_changes": { "type": "array", "items": { "type": "string" } },
              "outcome": { "type": "string", "enum": ["success", "failed", "partial_success"] },
              "lessons_learned": { "type": "array", "items": { "type": "string" } }
            }
          }
        },
        "session_context": {
          "type": "object",
          "properties": {
            "conversation_history": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "role": { "type": "string", "enum": ["coding_agent", "support_agent"] },
                  "content": { "type": "string" },
                  "timestamp": { "type": "integer" }
                }
              }
            },
            "current_goal": { "type": "string" },
            "blocked_on": { "type": "string" }
          }
        }
      }
    },
    "ChatRequest": {
      "type": "object",
      "required": ["session_id", "conversation_mode", "agent_context"],
      "properties": {
        "session_id": { "type": "string" },
        "conversation_mode": { "const": true },
        "agent_context": { "$ref": "#/definitions/AgentContext" }
      }
    },
    "ChatResponse": {
      "type": "object",
      "required": ["response", "mode_used"],
      "properties": {
        "response": { "type": "string" },
        "reasoning": { "type": "string" },
        "confidence": { "type": "number" },
        "suggested_actions": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "type": { "type": "string", "enum": ["investigate", "modify", "configure", "verify"] },
              "description": { "type": "string" },
              "priority": { "type": "string", "enum": ["high", "medium", "low"] },
              "file_path": { "type": "string" },
              "code_snippet": { "type": "string" }
            }
          }
        },
        "follow_up_questions": { "type": "array", "items": { "type": "string" } },
        "conversation_state": {
          "type": "object",
          "properties": {
            "phase": { "type": "string", "enum": ["understanding", "investigating", "resolving", "verifying"] },
            "verified_facts": { "type": "array", "items": { "type": "string" } },
            "remaining_questions": { "type": "array", "items": { "type": "string" } }
          }
        },
        "mode_used": { "const": "conversational" },
        "relevant_docs": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": { "type": "string" },
              "path": { "type": "string" },
              "relevance": { "type": "number" }
            }
          }
        },
        "code_references": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "file": { "type": "string" },
              "lines": { "type": "string" },
              "relevance": { "type": "number" }
            }
          }
        }
      }
    }
  }
}
```

## Dependencies

### External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ^5.9.0 | Type definitions |
| eventsource | ^2.0.0 | SSE polyfill for Node.js (Phase 2) |
| ws | ^8.18.0 | WebSocket client for Node.js (Phase 3) |
| ajv | ^8.17.0 | JSON Schema validation |

### Peer Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @cloudflare/workers-types | ^4.0.0 | Cloudflare Workers types (optional) |

### Internal Dependencies

- SPEC-SUPPORT-AGENT-001: Support Agent API contracts
- SPEC-AGENT-COMM-001: Conversational chat protocol

## Traceability

| Requirement ID | File | Tag |
|----------------|------|-----|
| REQ-SDK-001 | types.ts | sdk:type:safety |
| REQ-SDK-002 | utils/errors.ts | sdk:error:handling |
| REQ-SDK-005 | client.ts | sdk:session:init |
| REQ-SDK-006 | api/rest.ts | sdk:chat:rest |
| REQ-SDK-007 | api/sse.ts | sdk:chat:sse |
| REQ-SDK-008 | api/websocket.ts | sdk:websocket |
| REQ-SDK-010 | client.ts | sdk:solve:api |
| REQ-SDK-011 | utils/retry.ts | sdk:retry:logic |
