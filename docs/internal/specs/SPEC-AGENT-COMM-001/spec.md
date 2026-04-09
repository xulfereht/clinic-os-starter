---
id: SPEC-AGENT-COMM-001
version: 1.0.0
status: draft
created: 2026-02-09
author: moai
priority: P1
lifecycle_level: spec-anchored
---

# 코딩 에이전트-서포트 에이전트 간 대화형 트러블 슈팅 고도화

## Overview

본 SPEC은 로컬 코딩 에이전트와 서포트 에이전트 간의 통신 프로토콜을 고도화하여, 풍부한 맥락 정보를 전달하고 GLM 4.7을 활용한 대화형 트러블 슈팅을 구현합니다.

### 핵심 문제

현재 코딩 에이전트와 서포트 에이전트 간의 통신에 다음과 같은 한계가 있습니다:

1. **맥락 정보 부족**: 코딩 에이전트가 파악한 분석 과정, 시도한 것들, 맥락이 충분히 전달되지 않음
2. **단발성 Q&A**: 대화형 문제 해결이 아니라 단일 질문/답변 구조
3. **LLM 제한**: Workers AI + Claude API 사용으로 GLM 4.7의 깊은 분석 능력 미활용
4. **프로토콜 미정의**: 대화형 통신을 위한 표준화된 프로토콜 부족

### 목표

- **풍부한 맥락 전달**: 코딩 에이전트의 분석 과정, 시도 내역, 문제 맥락을 상세히 전달
- **GLM 4.7 통합**: Workers AI 대신 GLM 4.7을 사용하여 깊은 분석 및 통찰 제공
- **대화형 인터페이스**: 단발 Q&A가 아니라 대화를 통해 문제를 점진적으로 해결
- **표준화된 프로토콜**: 대화형 통신을 위한 메시지 형식 정의

## Environment

### 현재 시스템

- **코딩 에이전트**: 로컬 환경에서 실행 (VS Code 확장 등)
- **서포트 에이전트**: Cloudflare Workers (support-agent-worker)
- **현재 통신**: POST /chat 엔드포인트 (단발성)
- **현재 LLM**: Workers AI (@cf/meta/llama-3.1-8b-instruct) + Claude API (claude-3-haiku)

### 제약 사항

- Cloudflare Workers 환경에서 실행되어야 함
- GLM 4.7 API 호출 가능해야 함
- 기존 POST /chat 엔드포인트와의 호환성 유지 필요

## EARS Requirements

### Requirements (이벤트 기반)

#### REQ-AGM-001: 풍부한 맥락 수집
**WHEN** 코딩 에이전트가 서포트 에이전트에 요청을 보낼 때, 시스템은 코딩 에이전트가 파악한 맥락 정보를 수집해야 한다.

#### REQ-AGM-002: 대화형 세션 관리
**WHEN** 코딩 에이전트와 서포트 에이전트가 대화할 때, 시스템은 대화 세션을 관리하고 문맥을 유지해야 한다.

#### REQ-AGM-003: GLM 4.7 통합
**WHEN** 서포트 에이전트가 분석이 필요할 때, 시스템은 GLM 4.7 API를 호출하여 깊은 통찰을 제공해야 한다.

#### REQ-AGM-004: 대화형 응답 생성
**WHEN** 서포트 에이전트가 응답을 생성할 때, 시스템은 단일 답변이 아니라 대화형으로 맥락을 파악하고 Follow-up 질문을 제공해야 한다.

### Behavior (상태 기반)

#### BEH-AGM-001: 맥락 분석 전달
**IF** 코딩 에이전트가 맥락을 파악했으면, 시스템은 그 분석 과정을 상세히 전달해야 한다.

#### BEH-AGM-002: 시도 내역 공유
**IF** 코딩 에이전트가 해결책을 시도했으면, 시스템은 시도한 것들과 결과를 공유해야 한다.

#### BEH-AGM-003: 맥락 기반 프롬프트
**IF** 맥락이 불충분하면, 시스템은 Follow-up 질문으로 맥락을 파악해야 한다.

### Data (시스템 데이터)

#### DAT-AGM-001: 맥락 정보 구조
**THE 시스템 SHALL** 코딩 에이전트가 파악한 맥락 정보를 구조화된 형식으로 전달해야 한다.

#### DAT-AGM-002: 대화 세션 데이터
**THE 시스템 SHALL** 대화 세션의 문맥을 저장하고 관리해야 한다.

#### DAT-AGM-003: GLM 4.7 응답 형식
**THE 시스템 SHALL** GLM 4.7의 응답을 구조화된 형식으로 제공해야 한다.

### Performance (성능)

#### PERF-AGM-001: 맥락 분석 지연
**THE 시스템 SHALL** 코딩 에이전트의 맥락 분석 정보가 100ms 이내에 전달되어야 한다.

#### PERF-AGM-002: GLM 4.7 응답 시간
**THE 시스템 SHALL** GLM 4.7 응답이 10초 이내에 제공되어야 한다.

## Specifications

### SP-AGM-001: 풍부한 맥락 전달 프로토콜

코딩 에이전트가 파악한 맥락 정보를 구조화하여 전달합니다.

```typescript
interface AgentContext {
  // 기존 정보 (호환성 유지)
  human_request: string;
  attempted_solution?: string;
  error_details?: {
    message: string;
    stack?: string;
    file?: string;
    line?: number;
  };
  local_context?: {
    modified_files?: string[];
    related_files?: string[];
  };

  // 새로운 풍부한 맥락 정보
  analysis_process?: {
    problem_identification: string;    // 문제 식별 과정
    hypothesis formed: string[];         // 형성된 가설
    root_cause_analysis?: string;       // 근본 원인 분석
    investigation_steps: string[];      // 조사 단계
  };
  attempts_made?: {
    description: string;                // 시도한 것 설명
    code_changes?: string[];           // 코드 변경 사항
    config_changes?: string[];         // 설정 변경 사항
    outcome: string;                   // 결과 (성공/실패/부분성공)
    lessons_learned: string[];         // 배운 점
  };
  session_context?: {
    conversation_history: ConversationTurn[];  // 이전 대화 기록
    current_goal: string;              // 현재 목표
    blocked_on: string;                // 막혀 있는 것
  };
}

interface ConversationTurn {
  role: 'coding_agent' | 'support_agent';
  content: string;
  timestamp: number;
}
```

### SP-AGM-002: GLM 4.7 통합

서포트 에이전트에서 GLM 4.7을 호출하여 깊은 분석을 수행합니다.

```typescript
interface GLM4Request {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface GLM4Response {
  content: string;
  reasoning?: string;        // 추론 과정
  confidence: number;         // 응답 신뢰도
  follow_up_questions?: string[];  // 후속 질문
  suggested_actions?: SuggestedAction[];
}

interface SuggestedAction {
  type: 'investigate' | 'modify' | 'configure' | 'verify';
  description: string;
  priority: 'high' | 'medium' | 'low';
  file_path?: string;
  code_snippet?: string;
}
```

### SP-AGM-003: 대화형 세션 관리

대화형 통신을 위한 세션 관리 기능입니다.

```typescript
interface ConversationalSession {
  session_id: string;
  turns: ConversationTurn[];
  current_state: {
    phase: 'understanding' | 'investigating' | 'resolving' | 'verifying';
    hypotheses: string[];
    verified_facts: string[];
    remaining_questions: string[];
  };
  context_summary: string;  // 대화 맥락 요약
}

interface TurnRequest {
  session_id: string;
  turn: {
    role: 'coding_agent';
    content: string;
    context?: AgentContext;
  };
}

interface TurnResponse {
  turn_id: string;
  response: {
    role: 'support_agent';
    content: string;
    reasoning?: string;
    confidence: number;
    suggested_actions?: SuggestedAction[];
  };
  next_actions?: {
    need_more_info: boolean;
    specific_questions: string[];
    suggested_files_to_check: string[];
  };
}
```

### SP-AGM-004: 기존 POST /chat 확장

기존 엔드포인트와의 호환성을 유지하면서 새로운 기능을 추가합니다.

```typescript
// 기존 요청 형식 (호환성 유지)
interface ChatRequestLegacy {
  session_id: string;
  message: {
    type: 'question' | 'follow_up' | 'clarification';
    human_request: string;
    attempted_solution?: string;
    error_details?: { message: string; stack?: string; file?: string; line?: number };
    local_context?: { modified_files?: string[]; related_files?: string[] };
  };
  mode?: 'basic' | 'deep';
  conversation_mode?: boolean;  // 새로운 필드: 대화 모드 활성화
}
```

## 구현 계획

### Phase 1: 맥락 정보 구조 확장 (PRIORITY: P1)

**파일**: `support-agent-worker/src/types.ts`

**작업**:
1. `AgentContext` 인터페이스 확장 (analysis_process, attempts_made, session_context 추가)
2. `GLM4Request`, `GLM4Response` 인터페이스 정의
3. `ConversationalSession`, `TurnRequest`, `TurnResponse` 인터페이스 정의

### Phase 2: GLM 4.7 통합 (PRIORITY: P0)

**파일**: `support-agent-worker/src/lib/glm4.ts` (신규)

**작업**:
1. GLM 4.7 API 호출 함수 구현
2. Z.ai API와의 통합 (기존 GLM_API_KEY 사용)
3. 에러 처리 및 재시도 로직
4. 스트리밍 응답 지원

**의존성**: 기존 `src/moai_adk/ai.py`의 GLM 연동 경험 참고

### Phase 3: 대화형 세션 관리 (PRIORITY: P1)

**파일**: `support-agent-worker/src/lib/conversation.ts` (신규)

**작업**:
1. 세션 상태 관리 (phase, hypotheses, verified_facts)
2. 대화 기록 저장 및 검색
3. 맥락 요약 업데이트
4. Follow-up 질문 생성

### Phase 4: Chat 엔드포인트 확장 (PRIORITY: P1)

**파일**: `support-agent-worker/src/routes/chat.ts`

**작업**:
1. `conversation_mode` 파라미터 처리
2. 대화형 요청시 새로운 흐름으로 라우팅
3. 기존 단발 모드와의 호환성 유지

### Phase 5: 코딩 에이전트 측 연동 (PRIORITY: P2)

**작업**:
- 코딩 에이전트가 새로운 프로토콜을 사용하는 방법 문서화
- 예제 코드 제공

## Traceability

### 태그 매핑

| 요구사항 ID | 태그 | 관련 컴포넌트 |
|-------------|------|---------------|
| REQ-AGM-001 | agm:context:collect | types.ts |
| REQ-AGM-002 | agm:session:manage | conversation.ts |
| REQ-AGM-003 | agm:glm4:integrate | glm4.ts |
| REQ-AGM-004 | agm:conversational:response | chat.ts |

### 구현 매핑

- `support-agent-worker/src/types.ts` - 맥락 정보 구조 확장
- `support-agent-worker/src/lib/glm4.ts` - GLM 4.7 통합 (신규)
- `support-agent-worker/src/lib/conversation.ts` - 대화형 세션 관리 (신규)
- `support-agent-worker/src/routes/chat.ts` - Chat 엔드포인트 확장

### 통합 포인트

- `support-agent-worker/src/lib/ai.ts` - GLM 4.7 호출 통합
- `support-agent-worker/src/lib/db.ts` - 대화 세션 저장

## Rolling Back Plan

기존 작업(SPEC-CONTEXT-001)은 유지하되므로 롤백 없음. 새로운 기능은 추가되는 방식.

## Acceptance Criteria

### AC-AGM-001: 풍부한 맥락 전달
- **Given**: 코딩 에이전트가 문제를 분석하고 시도해봤음
- **When**: 서포트 에이전트에 요청을 보낼 때
- **Then**:
  - analysis_process가 전달됨
  - attempts_made가 전달됨
  - session_context가 전달됨

### AC-AGM-002: GLM 4.7 응답
- **Given**: 맥락 정보가 전달됨
- **When**: 서포트 에이전트가 GLM 4.7을 호출할 때
- **Then**:
  - 깊은 통찰이 포함된 응답 제공
  - reasoning 필드에 추론 과정 포함
  - confidence score 제공

### AC-AGM-003: 대화형 문제 해결
- **Given**: 문제가 복잡하여 단일 응답으로 해결 불가
- **When**: 대화 모드로 진행할 때
- **Then**:
  - Follow-up 질문 제공
  - 대화 세션 유지
  - 점진적 문제 해결

## Dependencies

- **필요 의존성**:
  - Z.ai GLM 4.7 API (기존 GLM_API_KEY 활용)
  - 기존 POST /chat 구조

- **관련 SPEC**:
  - SPEC-CONTEXT-001: 서포트 에이전트 내부 맥락 파악 (활용 가능)

## Risks

### 위험 요소

1. **GLM 4.7 API 비용**: 추가 API 호출로 비용 증가 가능
2. **세션 관리 복잡도**: 대화 상태 관리의 복잡성 증가
3. **호환성**: 기존 클라이언트와의 호환성 유지 필요

### 완화책

1. **API 캐싱**: 동일한 요청에 대한 캐싱으로 비용 절감
2. **세션 타임아웃**: 너무 긴 대화 방지를 위한 타임아웃 설정
3. **점진적 롤아웃**: conversation_mode 플래그로 점진적 활성화
