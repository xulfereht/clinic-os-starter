# Implementation Plan - SPEC-AGENT-COMM-002

## Phase Overview

본 문서는 HQ Support 페이지의 대화형 모드 고도화 구현 계획을 설명합니다.

## Phase 1: 대화형 모드 기본 활성화 (PRIORITY: P0)

**Duration**: 1-2 days
**Files**: `hq/src/index.js`

### Implementation Steps

1. `sendMessage()` 함수 수정
   - conversation_mode: true 추가
   - agent_context 구조로 변경
   - 응답 처리 로직 수정

2. 응답 표시 개선
   - reasoning 필드 표시
   - confidence 표시 (신뢰도 바)
   - suggested_actions 표시

### Code Changes

```javascript
// Before
body: JSON.stringify({
  session_id: currentSessionId,
  message: {
    type: 'question',
    human_request: content
  },
  mode: 'basic'
})

// After
body: JSON.stringify({
  session_id: currentSessionId,
  conversation_mode: true,
  agent_context: {
    human_request: content,
    error_details: capturedError,  // 수집된 경우
    local_context: {
      modified_files: capturedFiles
    }
  }
})
```

### Success Criteria

- 모든 요청이 conversation_mode로 전송
- GLM 4.7 응답의 reasoning이 표시됨
- confidence score가 시각화됨

## Phase 2: 맥락 정보 수집 UI (PRIORITY: P1)

**Duration**: 2-3 days
**Files**: `hq/src/index.js`

### Implementation Steps

1. 문제 유형 선택 UI 추가
2. 에러 정보 입력 폼 구현
3. 추가 맥락 입력 필드
4. 모호성 감지 로직

### UI Components

```javascript
// 맥락 정보 수집 모달
<div id="contextModal" class="modal">
  <div class="modal-content">
    <h3>추가 정보 입력</h3>

    <div class="form-group">
      <label>문제 유형</label>
      <select id="problemType">
        <option value="">선택해주세요</option>
        <option value="error">에러 발생</option>
        <option value="how-to">사용 방법</option>
        <option value="troubleshooting">트러블슈팅</option>
      </select>
    </div>

    <div class="form-group" id="errorFields" style="display:none">
      <label>에러 메시지</label>
      <textarea id="errorMsg"></textarea>

      <label>관련 파일</label>
      <input type="text" id="errorFile" />
    </div>

    <div class="form-group">
      <label>추가 설명</label>
      <textarea id="additionalContext"></textarea>
    </div>

    <div class="modal-actions">
      <button class="btn btn-primary" onclick="submitContext()">
        입력 완료
      </button>
      <button class="btn btn-ghost" onclick="skipContext()">
        건너뛰기
      </button>
    </div>
  </div>
</div>
```

### Success Criteria

- 사용자가 질문 전에 맥락 정보를 입력할 수 있음
- 문제 유형에 따라 동적으로 폼 필드 변경
- 건너뛰기로 기존 방식 사용 가능

## Phase 3: Follow-up 질문 UI (PRIORITY: P1)

**Duration**: 2-3 days
**Files**: `hq/src/index.js`

### Implementation Steps

1. follow_up_questions 렌더링
2. 질문 카드 UI 구현
3. 답변 입력 및 전송 로직

### UI Design

```javascript
// Follow-up 질문 컴포넌트
function renderFollowUpQuestions(questions) {
  const container = document.createElement('div');
  container.className = 'follow-up-questions';

  questions.forEach((question, index) => {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.innerHTML = `
      <div class="question-icon">❓</div>
      <div class="question-content">
        <p class="question-text">${question}</p>
        <div class="quick-replies">
          <button class="btn-reply" onclick="quickReply(${index}, '예')">
            예
          </button>
          <button class="btn-reply" onclick="quickReply(${index}, '아니오')">
            아니오
          </button>
          <button class="btn-reply btn-outline" onclick="customReply(${index})">
            직접 입력
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  return container;
}
```

### Success Criteria

- AI의 follow_up_questions가 UI에 표시됨
- 빠른 답변 버튼으로 즉시 응답 가능
- 직접 입력으로 상세 답변 가능

## Phase 4: 진행 상태 시각화 (PRIORITY: P2)

**Duration**: 2-3 days
**Files**: `hq/src/index.js`

### Implementation Steps

1. conversation_status 인디케이터 구현
2. 단계별 진행 표시
3. 신뢰도 바 애니메이션
4. suggested_actions 카드

### Status Phases

```javascript
const PHASES = {
  understanding: { label: '이해 중', icon: '🔍', color: '#3b82f6' },
  investigating: { label: '조사 중', icon: '🔬', color: '#f59e0b' },
  resolving: { label: '해결 중', icon: '⚙️', color: '#10b981' },
  verifying: { label: '검증 중', icon: '✅', color: '#8b5cf6' }
};

function updateConversationState(state) {
  const statusEl = document.getElementById('conversationStatus');

  // Phase update
  Object.values(PHASES).forEach((phase, index) => {
    const stepEl = document.querySelector(`[data-phase="${phase.key}"]`);
    if (state.phase === phase.key) {
      stepEl.classList.add('active');
    } else {
      stepEl.classList.remove('active');
    }
  });

  // Confidence update
  const confidenceBar = document.querySelector('.confidence-bar');
  confidenceBar.style.width = `${state.confidence * 100}%`;
}
```

### Success Criteria

- 현재 대화 단계가 시각화됨
- 신뢰도가 바 형태로 표시됨
- 제안된 액션(suggested_actions)이 카드로 표시됨

## Phase 5: 스타일링 개선 (PRIORITY: P2)

**Duration**: 1-2 days
**Files**: `hq/src/index.js`

### Implementation Steps

1. 대화형 UI CSS 추가
2. 애니메이션 효과
3. 반응형 레이아웃
4. 모바일 최적화

### CSS Components

```css
/* Follow-up Questions */
.follow-up-questions {
  margin: 1rem 0;
}

.question-card {
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 0.75rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Conversation Status */
.conversation-status {
  background: white;
  border-radius: 12px;
  padding: 1rem;
  margin: 1rem 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.status-phase {
  display: flex;
  gap: 0.5rem;
  margin: 0.75rem 0;
}

.phase-step {
  flex: 1;
  text-align: center;
  padding: 0.5rem;
  border-radius: 8px;
  background: #f1f5f9;
  opacity: 0.5;
  transition: all 0.3s ease;
}

.phase-step.active {
  opacity: 1;
  background: #dbeafe;
  font-weight: 600;
}

/* Confidence Bar */
.confidence-indicator {
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 0.5rem;
}

.confidence-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  transition: width 0.5s ease-out;
}

/* Suggested Actions */
.suggested-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 1rem 0;
}

.suggested-action {
  background: white;
  border-left: 4px solid #3b82f6;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.06);
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### Success Criteria

- 새로운 컴포넌트에 스타일 적용됨
- 애니메이션이 부드럽게 작동
- 모바일에서도 UI가 깨지지 않음

## Testing Strategy

### Manual Testing

각 Phase별로:
1. Phase 1: 대화형 모드로 질문하고 GLM 4.7 응답 확인
2. Phase 2: 맥락 정보 입력 후 질문
3. Phase 3: follow-up 질문에 답변
4. Phase 4: 상태 인디케이터 확인
5. Phase 5: UI/UX 전체 확인

### Edge Cases

- 매우 긴 질문 (>500자)
- 특수 문자, 코드 포함 질문
- 에러 메시지 붙여넣기
- 빠른 연속 질문
- 세션 만료 후 재시도

## Rollback Strategy

각 Phase는 독립적으로 롤백 가능:
- Phase 1: conversation_mode 플래그로 기존 방식으로 전환
- Phase 2-5: UI 컴포넌트로 분리되어 기존 UI에 영향 없음

## Deployment Plan

1. **개발 환경 테스트**: 로컬에서 모든 기능 검증
2. **staging 배포**: staging.pages.dev에 먼저 배포
3. **일부 사용자 테스트**: 10% 사용자에게만 노출
4. **전체 배포**: 문제 없으면 전체 적용
5. **모니터링**: 에러率, 사용자 피드백 확인

## Dependencies

**Required**:
- SPEC-AGENT-COMM-001 구현 완료 (완료됨)

**Optional Enhancements**:
- 사용자 피드백 수집 기능
- A/B 테스트 프레임워크
- 분석 및 로깅 강화
