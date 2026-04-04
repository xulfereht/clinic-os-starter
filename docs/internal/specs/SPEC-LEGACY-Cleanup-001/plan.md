# Implementation Plan - SPEC-LEGACY-Cleanup-001

## Phase Overview

본 문서는 Support Agent Worker에서 레거시 모드를 제거하고 대화형 모드로 완전히 전환하는 구현 계획입니다.

## Phase 1: 타입 정의 수정 (PRIORITY: P0)

**Duration**: 30분
**Files**: `src/types.ts`

### Implementation Steps

1. `CLAUDE_API_KEY` 제거
2. `LlmMode` 타입 제거
3. 레거시 요청 타입 제거
4. `ChatRequest` 단순화

### Code Changes

```typescript
// BEFORE
export interface Env {
  DB: D1Database;
  ARCHIVE: R2Bucket;
  AI: Ai;
  VECTORIZE: VectorizeIndex;

  // Environment variables
  ENVIRONMENT: string;
  SESSION_TIMEOUT_MINUTES: string;
  DEFAULT_LLM_MODE: string;

  // Secrets
  CLAUDE_API_KEY?: string;  // ← 제거
  INTERNAL_API_KEY?: string;
  GLM_API_KEY?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  JWT_PUBLIC_KEY?: string;
  GITHUB_TOKEN?: string;
}

export type LlmMode = 'basic' | 'deep';  // ← 제거

export interface ChatRequest {
  conversation_mode?: boolean;  // ← true로 고정
  agent_context?: AgentContext;

  // Legacy fields - 제거
  message?: ChatMessageLegacy;
  mode?: LlmMode;
}

export interface ChatMessageLegacy {
  type: 'question' | 'follow_up' | 'clarification';
  human_request: string;
  attempted_solution?: string;
  error_details?: ErrorDetails;
  local_context?: LocalContext;
}

// AFTER
export interface Env {
  DB: D1Database;
  ARCHIVE: R2Bucket;
  AI: Ai;
  VECTORIZE: VectorizeIndex;

  // Environment variables
  ENVIRONMENT: string;
  SESSION_TIMEOUT_MINUTES: string;

  // Secrets
  INTERNAL_API_KEY?: string;
  GLM_API_KEY?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  JWT_PUBLIC_KEY?: string;
  GITHUB_TOKEN?: string;
  // CLAUDE_API_KEY 제거됨
}

export interface ChatRequest {
  conversation_mode: true;  // 필수
  agent_context: AgentContext;
  // legacy fields 제거됨
}
```

### Success Criteria

- TypeScript 컴파일 에러 없음
- `CLAUDE_API_KEY` 참조 없음
- `LlmMode` 참조 없음

---

## Phase 2: 레거시 핸들러 제거 (PRIORITY: P0)

**Duration**: 1시간
**Files**: `src/routes/chat.ts`

### Implementation Steps

1. `handleLegacyMode` 함수 제거
2. 레거시 모드 import 제거
3. 단일 경로 라우팅으로 변경
4. 타입 캐스팅 제거

### Code Changes

```typescript
// BEFORE - src/routes/chat.ts
import { isClaudeAvailable } from '../lib/claude';  // ← 제거

chat.post('/', async (c) => {
  const body = await c.req.json() as Partial<ChatRequest>;

  // Route based on mode
  if (body.conversation_mode) {
    return handleConversationalMode(c, body as ChatRequestConversational);
  } else {
    return handleLegacyMode(c, body as ChatRequestLegacy);  // ← 제거
  }
});

async function handleLegacyMode(c, body) {  // ← 전체 제거 (lines 200-400)
  // ... 200줄의 레거시 모드 처리 코드
}

// AFTER
chat.post('/', async (c) => {
  const body = await c.req.json() as ChatRequestConversational;

  // Always use conversational mode
  return handleConversationalMode(c, body);
});
```

### Lines to Remove

- Line 48: `import { isClaudeAvailable } from '../lib/claude';`
- Lines 200-444: `async function handleLegacyMode(...)` 함수 전체
- Lines 406-443: deep mode 체크 로직
- Lines 556-803: 레거시 핸들러 (중복되는 두 번째 핸들러)

### Success Criteria

- 레거시 핸들러 함수 제거됨
- 단일 경로 라우팅만 존재
- conversation_mode만 처리

---

## Phase 3: Claude API 코드 제거 (PRIORITY: P1)

**Duration**: 30분
**Files**:
- `src/lib/claude.ts` (파일 삭제)
- `src/lib/ai.ts` (수정)

### Implementation Steps

1. `src/lib/claude.ts` 파일 전체 삭제
2. `src/lib/ai.ts`에서 Claude 관련 import 제거
3. `src/routes/chat.ts`에서 Claude 관련 import 제거

### Commands

```bash
# Delete claude.ts
rm src/lib/claude.ts

# Remove from imports
```

### Success Criteria

- `src/lib/claude.ts` 파일 존재하지 않음
- 컴파일 에러 없음
- Claude 관련 import 없음

---

## Phase 4: Health Check 업데이트 (PRIORITY: P2)

**Duration**: 15분
**Files**: `src/routes/health.ts`

### Implementation Steps

1. Claude API 체크 제거
2. GLM API 체크로 변경

### Code Changes

```typescript
// BEFORE
export interface HealthCheckResult {
  status: 'healthy' | 'degraded';
  checks: {
    database: boolean;
    workers_ai: boolean;
    claude_api: boolean;  // ← 제거
    glm_api: boolean;    // ← 추가
  };
}

// Health check endpoint
checks.claude_api = !!(c.env.CLAUDE_API_KEY && c.env.CLAUDE_API_KEY.length > 0);
checks.glm_api = !!(c.env.GLM_API_KEY && c.env.GLM_API_KEY.length > 0);

// AFTER
export interface HealthCheckResult {
  status: 'healthy' | 'degraded';
  checks: {
    database: boolean;
    workers_ai: boolean;
    glm_api: boolean;  // Claude 대신 GLM
  };
}

// Only GLM check
checks.glm_api = !!(c.env.GLM_API_KEY && c.env.GLM_API_KEY.length > 0);
```

### Success Criteria

- Health check가 GLM API만 확인
- Claude API 참조 없음

---

## Phase 5: 워커 시크릿 정리 (PRIORITY: P2)

**Duration**: 10분
**Files**: `wrangler.toml`

### Implementation Steps

1. `wrangler secret delete CLAUDE_API_KEY` 실행
2. `wrangler.toml` 문서 업데이트

### Commands

```bash
# Delete secret
wrangler secret delete CLAUDE_API_KEY

# Verify
wrangler secret list
```

### Documentation Updates

```toml
# BEFORE (wrangler.toml line 85-87)
# =============================================================================
# Secrets (configure via wrangler secret put)
# =============================================================================
# CLAUDE_API_KEY        - Anthropic API key for Claude deep mode (Phase 4)

# AFTER
# =============================================================================
# Secrets (configure via wrangler secret put)
# =============================================================================
# GLM_API_KEY          - Z.ai GLM 4.7 API key for conversational mode
#                         Usage: wrangler secret put GLM_API_KEY
```

### Success Criteria

- `CLAUDE_API_KEY`가 시크릿 목록에 없음
- wrangler.toml 문서 업데이트됨

---

## Phase 6: 테스트 및 배포 (PRIORITY: P0)

**Duration**: 1시간

### Testing Strategy

#### 1. 로컬 테스트
```bash
# Start local development
cd support-agent-worker
npm run dev

# Test conversational mode
curl -X POST http://localhost:8787/support/chat \
  -H "Content-Type: application/json" \
  -H "X-License-Key: test-key" \
  -d '{
    "session_id": "test-session",
    "conversation_mode": true,
    "agent_context": {
      "human_request": "테스트 질문"
    }
  }'
```

#### 2. 배포 전 체크리스트
- [ ] TypeScript 컴파일 에러 없음
- [ ] unused import 제거됨
- [ ] 테스트 통과
- [ ] wrangler secret list 확인

#### 3. 배포
```bash
# Deploy to production
npm run deploy

# Or staging first
npm run deploy --env staging
```

#### 4. 배포 후 테스트
- [ ] Health check 통과: `GET /health`
- [ ] 대화형 모드 작동: HQ Support 페이지에서 질문 테스트
- [ ] GLM 4.7 응답 확인: reasoning, confidence 표시

### Rollback Strategy

**브랜치 전략:**
```bash
# Create feature branch
git checkout -b feature/remove-legacy-mode

# After changes
git add .
git commit -m "Remove legacy mode, use conversational mode only"

# If issues arise
git checkout main
git branch -D feature/remove-legacy-mode
```

### Success Criteria

- 모든 테스트 통과
- 대화형 모드 정상 작동
- 레거시 요청 에러 반환 (또는 자동 conversational mode로 변환)

---

## 종합 변경 사항

### 파일별 변경 요약

| 파일 | 작업 | 줄 수 |
|------|------|-------|
| `src/types.ts` | CLAUDE_API_KEY, LlmMode, legacy types 제거 | ~20줄 |
| `src/routes/chat.ts` | handleLegacyMode 제거, 단일 경로 라우팅 | ~300줄 |
| `src/lib/claude.ts` | 파일 전체 삭제 | ~400줄 |
| `src/lib/ai.ts` | Claude 관련 import 제거 | ~5줄 |
| `src/routes/health.ts` | Claude 체크 제거, GLM 체크 추가 | ~10줄 |
| `wrangler.toml` | 문서 업데이트 | ~5줄 |

**총 제거/수정**: 약 740줄

---

## Dependencies

**Required:**
- SPEC-AGENT-COMM-001 구현 완료
- SPEC-AGENT-COMM-002 구현 완료
- GLM_API_KEY 등록 완료

**Related Documents:**
- `docs/SPEC-AGENT-COMM-001-coding-agent-guide.md`
- `.moai/specs/SPEC-AGENT-COMM-001/`
- `.moai/specs/SPEC-AGENT-COMM-002/`

---

## Appendix

### 제거되는 함수 목록

**src/routes/chat.ts:**
- `handleLegacyMode` (legacy mode 핸들러)

**src/lib/claude.ts:**
- `callClaude`
- `isClaudeAvailable`
- `createClaudeMessage`

### 제거되는 타입 목록

**src/types.ts:**
- `LlmMode`
- `ChatRequestLegacy`
- `ChatMessageLegacy`

### 수정 전후 API 비교

**BEFORE:**
```typescript
// Legacy mode request
{
  "session_id": "sas_...",
  "message": {
    "type": "question",
    "human_request": "질문"
  },
  "mode": "basic"
}

// Conversational mode request
{
  "session_id": "sas_...",
  "conversation_mode": true,
  "agent_context": {
    "human_request": "질문"
  }
}
```

**AFTER:**
```typescript
// Only conversational mode supported
{
  "session_id": "sas_...",
  "conversation_mode": true,
  "agent_context": {
    "human_request": "질문"
  }
}
```
