# Support Agent API Reference

## Base URL

```
https://clinic-os-support-agent.yeonseung-choe.workers.dev
```

## Authentication

All authenticated endpoints require the `X-License-Key` header:

```bash
curl -H "X-License-Key: your-license-key" ...
```

---

## Endpoints

### 1. Health Check

Check if the Support Agent service is available.

**Request:**
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-05T10:00:00Z"
}
```

---

### 2. Start Session

Create a new support session.

**Request:**
```http
POST /support/session/start
X-License-Key: your-license-key
```

**Response (Success):**
```json
{
  "session_id": "sas_abc123xyz789",
  "expires_at": "2026-02-05T10:30:00Z",
  "tier": "basic",
  "messages_limit": 50
}
```

**Response (Error - Rate Limit):**
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 3600,
  "message": "Daily session limit reached. Try again in 1 hour or upgrade your tier."
}
```

---

### 3. Send Message

Send a question to the Support Agent.

**Request:**
```http
POST /support/chat
Content-Type: application/json
X-License-Key: your-license-key

{
  "session_id": "sas_abc123xyz789",
  "message": {
    "type": "troubleshoot_request",
    "human_request": "How do I add a custom field to patient form?"
  },
  "mode": "basic"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session_id` | string | Yes | Session ID from `/support/session/start` |
| `message.type` | string | Yes | Message type (`troubleshoot_request`, `question`, `feedback`) |
| `message.human_request` | string | Yes | Your question or issue description |
| `mode` | string | No | `basic` (default) or `deep` for Claude-powered analysis |

**Response (Basic Mode):**
```json
{
  "response": "To add a custom field to the patient form, follow these steps...",
  "sources": [
    {"title": "Patient Form Customization", "url": "/guide/forms"}
  ],
  "session_id": "sas_abc123xyz789"
}
```

**Response (Deep Mode):**
```json
{
  "response": "Let me analyze this issue in detail...",
  "diagnosis": "The patient form uses a dynamic schema defined in...",
  "root_cause": "Custom fields require schema migration in D1.",
  "solution_steps": [
    "Create migration file in migrations/",
    "Add field definition to schema",
    "Run npm run db:migrate"
  ],
  "code_suggestion": "// In migrations/0001_add_custom_field.sql\nALTER TABLE patients ADD COLUMN custom_field TEXT;",
  "prevention_tips": ["Use schema versioning", "Test migrations locally first"],
  "sources": [
    {"title": "D1 Migrations Guide", "url": "/guide/database"}
  ],
  "session_id": "sas_abc123xyz789"
}
```

---

### 4. Check Rate Limits

Get current rate limit status.

**Request:**
```http
GET /support/rate-limit
X-License-Key: your-license-key
```

**Response:**
```json
{
  "tier": "basic",
  "sessions_today": 5,
  "sessions_limit": 50,
  "sessions_remaining": 45,
  "messages_this_session": 10,
  "messages_limit": 50,
  "deep_mode_today": 2,
  "deep_mode_limit": 5,
  "resets_at": "2026-02-06T00:00:00Z"
}
```

---

### 5. End Session

Explicitly end a support session.

**Request:**
```http
POST /support/session/end
Content-Type: application/json
X-License-Key: your-license-key

{
  "session_id": "sas_abc123xyz789"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Session ended"
}
```

---

## Rate Limits by Tier

| Tier | Sessions/Day | Messages/Session | Deep Mode/Day |
|------|--------------|------------------|---------------|
| Free | 10 | 20 | Not available |
| Basic | 50 | 50 | 5 |
| Pro | Unlimited | Unlimited | Unlimited |

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_LICENSE` | 401 | License key is invalid or expired |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit reached for your tier |
| `SESSION_EXPIRED` | 400 | Session has expired, start a new one |
| `SESSION_NOT_FOUND` | 404 | Session ID is invalid |
| `DEEP_MODE_UNAVAILABLE` | 403 | Deep mode not available for your tier |
| `SERVICE_UNAVAILABLE` | 503 | Support Agent temporarily unavailable |

---

## Example: Complete Flow

```bash
# 1. Start a session
SESSION=$(curl -s -X POST \
  -H "X-License-Key: $LICENSE_KEY" \
  "https://clinic-os-support-agent.yeonseung-choe.workers.dev/support/session/start" \
  | jq -r '.session_id')

# 2. Ask a question
curl -s -X POST \
  -H "X-License-Key: $LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION\",
    \"message\": {
      \"type\": \"troubleshoot_request\",
      \"human_request\": \"How do I configure Google OAuth?\"
    },
    \"mode\": \"basic\"
  }" \
  "https://clinic-os-support-agent.yeonseung-choe.workers.dev/support/chat"

# 3. Check rate limits
curl -s -H "X-License-Key: $LICENSE_KEY" \
  "https://clinic-os-support-agent.yeonseung-choe.workers.dev/support/rate-limit"
```

---

## CLI Tool

For convenience, use the built-in CLI tool:

```bash
# Quick question
pnpm support "How do I add a custom field?"

# Deep analysis
pnpm support --deep "Complex D1 migration issue"

# Interactive session
pnpm support --session
```

See [README.md](../README.md) for more details.
