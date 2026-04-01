# Implementation Plan - SPEC-AGENT-COMM-001

## Phase Overview

본 문서는 코딩 에이전트-서포트 에이전트 간 대화형 트러블 슈팅 고도화 구현 계획을 설명합니다.

## Phase 1: 맥락 정보 구조 확장 (PRIORITY: P1)

**Duration**: 1-2 days
**Files**: `support-agent-worker/src/types.ts`

### Implementation Steps

1. `AgentContext` 인터페이스 확장
2. `GLM4Request`, `GLM4Response` 인터페이스 정의
3. `ConversationalSession`, `TurnRequest`, `TurnResponse` 인터페이스 정의
4. 타입 검증 테스트 추가

### Integration Points

- `support-agent-worker/src/lib/ai.ts` - 확장된 타입 사용
- `support-agent-worker/src/lib/db.ts` - 대화 세션 저장

### Success Criteria

- 모든 새 인터페이스가 타입 안전성 검증 통과
- 기존 ChatRequest와 호환성 유지

## Phase 2: GLM 4.7 통합 (PRIORITY: P0)

**Duration**: 2-3 days
**Files**: `support-agent-worker/src/lib/glm4.ts` (신규)

### Implementation Steps

1. GLM 4.7 API 클라이언트 구현
2. 스트리밍 응답 지원
3. 에러 처리 및 재시도 로직
4. Z.ai API 키 관리

**기존 GLM 연동 참고**:
- `src/moai_adk/ai.py`의 GLM 연동 코드
- GLM_API_KEY, GLM_BASE_URL 환경 변수 활용

### Integration Points

- `support-agent-worker/src/lib/ai.ts` - GLM 4.7 호출
- Cloudflare Workers 환경 변수

### Success Criteria

- GLM 4.7 API 호출 성공
- 응답 시간 < 10초 (PERF-AGM-002)
- 스트리밍 지원

## Phase 3: 대화형 세션 관리 (PRIORITY: P1)

**Duration**: 2-3 days
**Files**: `support-agent-worker/src/lib/conversation.ts` (신규)

### Implementation Steps

1. 세션 상태 관리 (phase, hypotheses, verified_facts)
2. 대화 기록 D1 저장 및 검색
3. 맥락 요약 업데이트
4. Follow-up 질문 생성 로직

### D1 스키마 추가

```sql
CREATE TABLE IF NOT EXISTS conversation_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,  -- 'coding_agent' or 'support_agent'
  content TEXT NOT NULL,
  context_data TEXT,     -- JSON string for extended context
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES support_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_session
  ON conversation_turns(session_id, created_at);
```

### Integration Points

- `support-agent-worker/src/lib/db.ts` - 새로운 쿼리 함수
- `support-agent-worker/src/routes/chat.ts` - 세션 관리 통합

### Success Criteria

- 대화 세션이 정확히 저장되고 검색됨
- 맥락 요약이 자동으로 업데이트됨
- Follow-up 질문이 적절히 생성됨

## Phase 4: Chat 엔드포인트 확장 (PRIORITY: P1)

**Duration**: 1-2 days
**Files**: `support-agent-worker/src/routes/chat.ts`

### Implementation Steps

1. `conversation_mode` 파라미터 처리 추가
2. 대화형 요청시 새로운 흐름으로 라우팅
3. 기존 단발 모드와의 호환성 유지
4. 응답 형식 확장

### API 변경

```typescript
// 기존 요청 (호환성 유지)
interface ChatRequest {
  session_id: string;
  message: { ... };
  mode?: 'basic' | 'deep';
  conversation_mode?: boolean;  // 새로운 필드
}

// 대화형 모드 응답 (확장)
interface ChatResponseConversational {
  response: string;
  reasoning?: string;
  confidence: number;
  suggested_actions?: SuggestedAction[];
  follow_up_questions?: string[];
  conversation_state?: {
    phase: string;
    verified_facts: string[];
    remaining_questions: string[];
  };
}
```

### Success Criteria

- 기존 클라이언트와 호환성 유지
- 대화 모드에서 추가 정보 제공
- 라우팅이 올바르게 동작

## Phase 5: 코딩 에이전트 측 연동 (PRIORITY: P2)

**Duration**: 1-2 days

### Implementation Steps

1. 코딩 에이전트 사용 가이드 작성
2. 예제 코드 제공
3. 테스트 시나리오 작성

### Success Criteria

- 코딩 에이전트가 새로운 프로토콜을 사용할 수 있음
- 문서와 예제가 충분히 제공됨

## Testing Strategy

### Unit Tests

각 Phase별로:
- 타입 검증 테스트
- GLM 4.7 API 모의 테스트
- 세션 관리 로직 테스트

### Integration Tests

- end-to-end 대화형 통신 테스트
- 기존 클라이언트 호환성 테스트

### Performance Tests

- 맥락 전달 < 100ms (PERF-AGM-001)
- GLM 4.7 응답 < 10초 (PERF-AGM-002)

## Rollback Strategy

각 Phase는 독립적으로 롤백 가능:
- Phase 1: 타입 추가만으로 기존 기능 영향 없음
- Phase 2: GLM 4.7 통합은 선택적 사용 가능
- Phase 3: 세션 관리는 대화 모드에서만 사용
- Phase 4: conversation_mode 플래그로 기능 분리

## Dependencies

**Required**: None (새로운 기능)

**Optional Enhancements**:
- 대화 세션 메모리 캐싱
- GLM 4.7 응답 캐싱
- A/B 테스트 프레임워크
