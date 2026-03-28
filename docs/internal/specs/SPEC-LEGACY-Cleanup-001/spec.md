---
id: SPEC-LEGACY-Cleanup-001
version: 1.0.0
status: draft
created: 2026-02-09
author: moai
priority: P1
lifecycle_level: spec-anchored
---

# Support Agent 레거시 모드 제거

## Overview

Support Agent Worker에서 레거시 모드(mode: 'basic'/'deep')를 제거하고 대화형 모드(conversation_mode)로 완전히 전환합니다. HQ Support 페이지는 이미 대화형 모드만 사용하므로 불필요한 코드와 의존성을 정리합니다.

### 배경

- **SPEC-AGENT-COMM-001**: 코딩 에이전트-서포트 에이전트 대화형 통신 시스템 구현 완료
- **SPEC-AGENT-COMM-002**: HQ Support 페이지 대화형 모드 고도화 완료
- **결과**: HQ Support 페이지는 이제 conversation_mode만 사용, 레거시 모드 불필요

### 핵심 문제

1. **중복 코드 유지**: 두 가지 모드(legacy, conversational)를 위한 핸들러가 공존
2. **불필한 의존성**: CLAUDE_API_KEY가 대화형 모드에서는 사용되지 않음
3. **복잡성 증가**: 두 가지 코드 경로로 인한 유지보수 어려움

### 목표

- **단일 모드 지원**: conversation_mode만 지원
- **코드 정리**: 레거시 모드 관련 코드/타입/의존성 제거
- **GLM 전용**: GLM 4.7을 단일 LLM으로 사용

## Environment

### 현재 시스템

```
┌─────────────────────────────────────────────────────────────┐
│                    Support Agent Worker                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  POST /support/chat                                         │
│         │                                                  │
│         ├── conversation_mode: true ──→ handleConversationalMode │
│         │                              (GLM 4.7)           │
│         │                                                  │
│         └── mode: 'basic'/'deep' ────→ handleLegacyMode     │
│                                         │                    │
│                                         ├── basic: Workers AI │
│                                         └── deep: Claude API  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 제약 사항

- HQ Support 페이지는 이미 conversation_mode만 사용
- 기존 클라이언트(코딩 에이전트)도 대화형 모드 전환 완료
- CLAUDE_API_KEY는 deep mode에서만 사용되므로 불필요

## EARS Requirements

### Requirements (이벤트 기반)

#### REQ-LC-001: 레거시 모드 핸들러 제거
**WHEN** Support Agent가 `/support/chat` 엔드포인트를 처리할 때, 시스템은 conversation_mode만 지원해야 한다.

#### REQ-LC-002: Claude API 의존성 제거
**WHEN** CLAUDE_API_KEY 시크릿이 제거될 때, 시스템은 Claude API 호출 코드를 제거해야 한다.

#### REQ-LC-003: 타입 정리
**WHEN** 레거시 모드가 제거될 때, 시스템은 불필요한 타입 정의를 정리해야 한다.

### Behavior (상태 기반)

#### BEH-LC-001: 단일 경로 라우팅
**IF** conversation_mode 요청이 들어오면, 시스템은 항상 대화형 모드 핸들러로 라우팅해야 한다.

#### BEH-LC-002: 모드 파라미터 무시
**IF** legacy mode 파라미터(mode, message)가 포함되어도, 시스템은 이를 무시하고 conversation_mode 처리를 해야 한다.

### Data (시스템 데이터)

#### DAT-LC-001: 타입 단순화
**THE 시스템 SHALL** ChatRequest를 단순화하여 conversational mode 요청만 지원해야 한다.

#### DAT-LC-002: 환경 변수 정리
**THE 시스템 SHALL** CLAUDE_API_KEY를 Env 타입에서 제거해야 한다.

## Specifications

### SP-LC-001: 레거시 모드 핸들러 제거

**제거 대상 파일:**

1. **`src/routes/chat.ts`**
   - `handleLegacyMode` 함수 제거 (lines 200-400)
   - `mode` 파라미터 처리 로직 제거
   - `isClaudeAvailable` import 제거
   - `checkDeepModeAvailability` 호출 제거

**수정 후 구조:**
```typescript
// Before
chat.post('/', async (c) => {
  const body = await c.req.json();

  if (body.conversation_mode) {
    return handleConversationalMode(c, body);
  } else {
    return handleLegacyMode(c, body);  // ← 제거
  }
});

// After
chat.post('/', async (c) => {
  const body = await c.req.json();

  // Always use conversational mode
  return handleConversationalMode(c, body);
});
```

### SP-LC-002: Claude API 관련 코드 제거

**제거 대상 파일:**

1. **`src/lib/claude.ts`** - 파일 전체 제거
   - `callClaude` 함수
   - `isClaudeAvailable` 함수
   - Claude API 호출 로직

2. **`src/routes/chat.ts`**
   - `import { isClaudeAvailable } from '../lib/claude';` 제거

3. **`src/lib/ai.ts`**
   - Claude 관련 코드 제거

### SP-LC-003: 타입 정리

**제거/수정 대상:**

1. **`src/types.ts`**
   - `CLAUDE_API_KEY` 제거
   - `LlmMode` 타입 제거 ('basic' | 'deep')
   - `ChatRequestLegacy` 타입 제거
   - `ChatMessageLegacy` 타입 제거

**수정 후:**
```typescript
// Before
export interface Env {
  CLAUDE_API_KEY?: string;
  GLM_API_KEY?: string;
  // ...
}

export type LlmMode = 'basic' | 'deep';

export interface ChatRequest {
  conversation_mode?: boolean;
  agent_context?: AgentContext;
  message?: ChatMessageLegacy;  // ← 제거
  mode?: LlmMode;  // ← 제거
}

// After
export interface Env {
  GLM_API_KEY?: string;
  // CLAUDE_API_KEY 제거
  // ...
}

export interface ChatRequest {
  conversation_mode: true;  // 필수로 변경
  agent_context: AgentContext;
  // message, mode 제거
}
```

### SP-LC-004: Health Check 정리

**`src/routes/health.ts` 수정:**
```typescript
// Before
checks.claude_api = !!(c.env.CLAUDE_API_KEY && c.env.CLAUDE_API_KEY.length > 0);

// After
checks.glm_api = !!(c.env.GLM_API_KEY && c.env.GLM_API_KEY.length > 0);
```

### SP-LC-005: 워커 시크릿 정리

**CLI 명령어:**
```bash
wrangler secret delete CLAUDE_API_KEY
```

**`wrangler.toml` 문서 업데이트:**
```toml
# Before
# CLAUDE_API_KEY        - Anthropic API key for Claude deep mode (Phase 4)

# After
# (CLAUDE_API_KEY 제거 - GLM 4.7만 사용)
```

## 구현 계획

### Phase 1: 타입 정의 수정 (PRIORITY: P0)

**파일**: `src/types.ts`

**작업**:
1. `CLAUDE_API_KEY` 제거
2. `LlmMode` 타입 제거
3. 레거시 요청 타입 제거
4. `ChatRequest` 단순화

### Phase 2: 레거시 핸들러 제거 (PRIORITY: P0)

**파일**: `src/routes/chat.ts`

**작업**:
1. `handleLegacyMode` 함수 제거
2. `isClaudeAvailable` import 제거
3. 레거시 모드 검사 로직 제거
4. 단일 경로 라우팅으로 변경

### Phase 3: Claude API 코드 제거 (PRIORITY: P1)

**파일**:
- `src/lib/claude.ts` (파일 전체 삭제)
- `src/lib/ai.ts` (Claude 관련 부분 제거)

### Phase 4: Health Check 업데이트 (PRIORITY: P2)

**파일**: `src/routes/health.ts`

**작업**:
1. Claude 체크 제거
2. GLM 체크로 변경

### Phase 5: 시크릿 삭제 (PRIORITY: P2)

**작업**:
1. `wrangler secret delete CLAUDE_API_KEY`
2. `wrangler.toml` 문서 업데이트

### Phase 6: 테스트 및 배포 (PRIORITY: P0)

**작업**:
1. 로컬 테스트
2. 배포 후 테스트
3. 롤백 계획 확인

## Acceptance Criteria

### AC-LC-001: 레거시 모드 제거
- **Given**: Support Agent가 배포됨
- **When**: legacy mode 요청을 보낼 때
- **Then**: conversational mode로 처리됨

### AC-LC-002: 대화형 모드 전용
- **Given**: HQ Support 페이지에서 질문을 보낼 때
- **When**: /support/chat 호출
- **Then**: conversation_mode로만 작동, GLM 4.7 응답

### AC-LC-003: CLAUDE_API_KEY 제거
- **Given**: CLAUDE_API_KEY가 제거됨
- **When**: 시스템 시작
- **Then**: 에러 없이 작동, health check 통과

### AC-LC-004: 코드 정리
- **Given**: 레거시 코드 제거됨
- **When**: 코드 리뷰
- **Then**:
  - handleLegacyMode 함수 없음
  - claude.ts 파일 없음
  - LlmMode 타입 없음
  - 컴파일 에러 없음

## Rolling Back Plan

**롤백 전략:**
- Git 브랜치로 작업 진행: `feature/remove-legacy-mode`
- 문제 발생 시 브랜치 삭제로 복구

**롤백 절차:**
```bash
# 롤백
git checkout main
git branch -D feature/remove-legacy-mode
```

## Dependencies

**필수 선행 조건:**
- SPEC-AGENT-COMM-001 구현 완료
- SPEC-AGENT-COMM-002 구현 완료
- GLM_API_KEY 등록 완료

## Risks

### 위험 요소

1. **기존 클라이언트 호환성**: 코딩 에이전트가 이미 대화형 모드를 사용하므로 낮음
2. **배포 중단가능성**: 브랜치 전략으로 완화

### 완화책

1. **브랜치 전략**: 기능 브랜치에서 작업 후 병합
2. **롤백 계획**: 문제 시 즉시 main으로 복귀
3. **테스트**: 배포 전 대화형 모드만으로 테스트 완료

---

## Appendix

### 관련 문서

- `docs/SPEC-AGENT-COMM-001-coding-agent-guide.md`
- `.moai/specs/SPEC-AGENT-COMM-001/`
- `.moai/specs/SPEC-AGENT-COMM-002/`

### 파일 변경 목록

**수정 파일:**
- `src/types.ts`
- `src/routes/chat.ts`
- `src/routes/health.ts`
- `src/lib/ai.ts`
- `wrangler.toml`

**삭제 파일:**
- `src/lib/claude.ts`

**시크릿 변경:**
- `CLAUDE_API_KEY` 삭제
