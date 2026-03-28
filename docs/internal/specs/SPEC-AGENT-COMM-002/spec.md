---
id: SPEC-AGENT-COMM-002
version: 1.0.0
status: draft
created: 2026-02-09
author: moai
priority: P1
lifecycle_level: spec-anchored
---

# HQ Support 페이지 대화형 모드 고도화

## Overview

HQ 퍼블릭 페이지의 Support 채팅 UI를 대화형 모드로 고도화하여, 로컬 클라이언트(휴먼 사용자)가 더 정확한 정보를 제공하고 AI와의 대화를 통해 문제를 해결할 수 있도록 합니다.

### 핵심 문제

현재 HQ Support 페이지의 구현은 다음과 같은 한계가 있습니다:

1. **단발성 질문/답변**: conversation_mode를 사용하지 않고 legacy mode로만 작동
2. **맥락 정보 부족**: 사용자가 단순 텍스트만 입력하므로 맥락이 충분하지 않음
3. **Follow-up 질문 미지원**: AI가 추가 정보를 요청해도 사용자가 대응할 방법 없음
4. **UI/UX 부족**: 대화형 인터페이스에 필요한 피드백, 진행 상태 표시 등이 없음

### 목표

- **대화형 모드 기본 활성화**: conversation_mode를 기본값으로 사용
- **맥락 정보 수집 개선**: 모호한 질문 시 구조화된 정보 요청
- **Follow-up 질문 UI**: AI의 후속 질문을 사용자가 쉽게 답변할 수 있는 인터페이스
- **진행 상태 시각화**: 대화 단계(phase), 신뢰도 등을 표시

## Environment

### 현재 시스템

- **HQ Support 페이지**: `hq/src/index.js` (Cloudflare Pages 배포)
- **Support Agent Worker**: `support-agent-worker/` (별도 Worker)
- **현재 통신**: `/support/chat` 엔드포인트, legacy mode만 사용

### 제약 사항

- HQ는 JavaScript/HTML 단일 파일로 구성 (빌드 과정 없음)
- 기존 레거시 모드와의 호환성 유지 필요
- 사용자는 개발자가 아닌 일반 클리닉 운영자

## EARS Requirements

### Requirements (이벤트 기반)

#### REQ-HQ-001: 대화형 모드 기본 활성화
**WHEN** 사용자가 support 페이지에서 세션을 시작하고 질문을 보낼 때, 시스템은 conversation_mode를 기본으로 활성화해야 한다.

#### REQ-HQ-002: 맥락 정보 구조화 수집
**WHEN** 사용자의 질문이 모호하거나 맥락이 부족할 때, 시스템은 구조화된 형식으로 추가 정보를 요청해야 한다.

#### REQ-HQ-003: Follow-up 질문 UI 지원
**WHEN** AI가 follow_up_questions를 반환할 때, 시스템은 사용자가 쉽게 답변할 수 있는 UI를 제공해야 한다.

#### REQ-HQ-004: 진행 상태 시각화
**WHEN** 대화가 진행될 때, 시스템은 현재 단계(phase), 신뢰도(confidence) 등을 사용자에게 표시해야 한다.

### Behavior (상태 기반)

#### BEH-HQ-001: 모호성 검출
**IF** 사용자 질문이 특정 키워드를 포함하지 않거나 너무 짧으면, 시스템은 맥락 정보를 추가로 요청해야 한다.

#### BEH-HQ-002: 에러 정보 수집
**IF** 사용자가 에러를 언급하면, 시스템은 에러 메시지, 파일 경로, 스택 트레이스 등을 구조화하여 수집해야 한다.

#### BEH-HQ-003: 단계별 안내
**IF** 대화가 진행될 때, 시스템은 각 단계(understanding → investigating → resolving)의 진행 상황을 표시해야 한다.

### Data (시스템 데이터)

#### DAT-HQ-001: 사용자 입력 구조
**THE 시스템 SHALL** 사용자 입력을 단순 텍스트가 아니라 구조화된 형식으로 수집해야 한다.

#### DAT-HQ-002: 대화 상태 저장
**THE 시스템 SHALL** 대화의 각 턴과 상태를 로컬에 저장하여 세션 복구가 가능하게 해야 한다.

#### DAT-HQ-003: UI 컴포넌트 구조
**THE 시스템 SHALL** 대화형 UI를 위한 재사용 가능한 컴포넌트 구조를 정의해야 한다.

## Specifications

### SP-HQ-001: 대화형 모드 기본 활성화

현재 legacy mode 요청을 conversational mode로 변경:

```javascript
// 현재 (hq/src/index.js line 25835)
body: JSON.stringify({
  session_id: currentSessionId,
  message: {
    type: 'question',
    human_request: content
  },
  mode: 'basic'  // ← legacy mode
})

// 변경 후
body: JSON.stringify({
  session_id: currentSessionId,
  conversation_mode: true,  // ← conversational mode 활성화
  agent_context: {
    human_request: content,
    // 맥락 정보가 추가될 수 있음
  }
})
```

### SP-HQ-002: 맥락 정보 수집 UI

사용자가 질문을 입력하기 전/후에 맥락 정보를 수집하는 UI:

```html
<!-- 맥락 정보 수집 폼 -->
<div id="contextForm" class="context-form" style="display: none;">
  <div class="form-section">
    <label class="form-label">문제 유형</label>
    <select id="problemType" class="form-select">
      <option value="">선택해주세요</option>
      <option value="error">에러 발생</option>
      <option value="how-to">사용 방법</option>
      <option value="feature">기능 요청</option>
      <option value="troubleshooting">트러블슈팅</option>
      <option value="other">기타</option>
    </select>
  </div>

  <div class="form-section" id="errorSection" style="display: none;">
    <label class="form-label">에러 메시지</label>
    <textarea id="errorMessage" class="form-textarea"
              placeholder="에러 메시지를 붙여넣어주세요"></textarea>

    <label class="form-label">관련 파일 (선택)</label>
    <input type="text" id="errorFile" class="form-input"
           placeholder="예: src/pages/api/submit.ts">
  </div>

  <div class="form-section">
    <label class="form-label">추가 맥락 (선택)</label>
    <textarea id="additionalContext" class="form-textarea"
              placeholder="문제에 대해 더 자세히 설명해주세요"></textarea>
  </div>

  <button class="btn btn-secondary" onclick="submitWithContext()">
    맥락 포함하여 질문하기
  </button>
  <button class="btn btn-ghost" onclick="skipContext()">
    건너뛰기
  </button>
</div>
```

### SP-HQ-003: Follow-up 질문 UI

AI의 follow_up_questions를 표시하고 사용자가 쉽게 답변할 수 있는 UI:

```javascript
// Follow-up 질문 표시
function showFollowUpQuestions(questions) {
  const container = document.getElementById('followUpContainer');
  container.innerHTML = '';

  questions.forEach((question, index) => {
    const questionEl = document.createElement('div');
    questionEl.className = 'follow-up-question';
    questionEl.innerHTML = `
      <div class="question-text">${question}</div>
      <div class="question-actions">
        <button class="btn btn-sm btn-outline" onclick="answerFollowUp(${index}, '예')">
          예
        </button>
        <button class="btn btn-sm btn-outline" onclick="answerFollowUp(${index}, '아니오')">
          아니오
        </button>
        <button class="btn btn-sm btn-text" onclick="answerFollowUpCustom(${index})">
          직접 입력
        </button>
      </div>
    `;
    container.appendChild(questionEl);
  });

  container.style.display = 'block';
  // 스크롤하여 질문 표시
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
```

### SP-HQ-004: 진행 상태 시각화

대화 진행 상태를 표시하는 인디케이터:

```html
<!-- 대화 상태 인디케이터 -->
<div id="conversationStatus" class="conversation-status" style="display: none;">
  <div class="status-header">
    <span class="status-icon">🔄</span>
    <span class="status-text">AI 분석 중...</span>
    <span class="confidence-indicator" title="신뢰도">
      <span class="confidence-bar" style="width: 0%"></span>
    </span>
  </div>

  <div class="status-phase">
    <span class="phase-step" data-phase="understanding">
      <span class="step-icon">1</span>
      <span class="step-label">이해 중</span>
    </span>
    <span class="phase-step" data-phase="investigating">
      <span class="step-icon">2</span>
      <span class="step-label">조사 중</span>
    </span>
    <span class="phase-step" data-phase="resolving">
      <span class="step-icon">3</span>
      <span class="step-label">해결 중</span>
    </span>
  </div>

  <div class="suggested-actions" id="suggestedActions"></div>
</div>
```

### SP-HQ-005: Suggested Actions UI

AI가 제안한 해결책을 표시하고 실행하는 UI:

```javascript
function showSuggestedActions(actions) {
  const container = document.getElementById('suggestedActions');
  container.innerHTML = '';

  actions.forEach((action, index) => {
    const actionEl = document.createElement('div');
    actionEl.className = 'suggested-action';

    const priorityIcon = {
      'high': '🔴',
      'medium': '🟡',
      'low': '🟢'
    }[action.priority];

    actionEl.innerHTML = `
      <div class="action-header">
        <span class="action-priority">${priorityIcon[action.priority]}</span>
        <span class="action-type">${getActionTypeLabel(action.type)}</span>
      </div>
      <div class="action-description">${action.description}</div>
      ${action.file_path ? `
        <div class="action-file">
          <span class="file-icon">📄</span>
          <code>${action.file_path}</code>
        </div>
      ` : ''}
      <button class="btn btn-sm btn-primary" onclick="copyAction(${index})">
        복사
      </button>
    `;

    container.appendChild(actionEl);
  });
}

function getActionTypeLabel(type) {
  const labels = {
    'investigate': '조사 필요',
    'modify': '수정 제안',
    'configure': '설정 변경',
    'verify': '확인 필요'
  };
  return labels[type] || type;
}
```

## 구현 계획

### Phase 1: 대화형 모드 기본 활성화 (PRIORITY: P0)

**파일**: `hq/src/index.js`

**작업**:
1. `sendMessage()` 함수에서 conversation_mode 활성화
2. agent_context 구조로 변경
3. 응답 처리 로직 수정 (reasoning, confidence, suggested_actions 표시)

### Phase 2: 맥락 정보 수집 UI (PRIORITY: P1)

**파일**: `hq/src/index.js`

**작업**:
1. 문제 유형 선택 드롭다운 추가
2. 에러 정보 입력 폼 (에러 메시지, 파일 경로)
3. 추가 맥락 입력 필드
4. "건너뛰기" 옵션으로 기존 방식 유지

### Phase 3: Follow-up 질문 UI (PRIORITY: P1)

**파일**: `hq/src/index.js`

**작업**:
1. follow_up_questions 표시 컨테이너
2. 예/아니오/직접입력 버튼
3. 질문 답변을 다음 메시지로 전송

### Phase 4: 진행 상태 시각화 (PRIORITY: P2)

**파일**: `hq/src/index.js`

**작업**:
1. conversation_status 인디케이터 컴포넌트
2. 단계별 진행 표시 (understanding → investigating → resolving)
3. 신뢰도 바 표시
4. suggested_actions 카드 표시

### Phase 5: 스타일링 개선 (PRIORITY: P2)

**파일**: `hq/src/index.js` (CSS 부분)

**작업**:
1. 대화형 UI를 위한 스타일 추가
2. 애니메이션 효과 (typing, status transition)
3. 반응형 레이아웃
4. 모바일 최적화

## Acceptance Criteria

### AC-HQ-001: 대화형 모드 기본 활성화
- **Given**: 사용자가 support 페이지에 접속
- **When**: 질문을 보낼 때
- **Then**:
  - conversation_mode: true로 요청 전송
  - GLM 4.7 깊은 분석 결과 수신
  - reasoning, confidence 표시

### AC-HQ-002: 맥락 정보 수집
- **Given**: 사용자가 첫 질문을 입력
- **When**: 질문이 모호하거나 짧을 때 (< 20자)
- **Then**:
  - 맥락 정보 수집 폼 표시
  - 문제 유형, 에러 정보, 추가 맥락 수집 가능
  - 건너뛰기로 바로 질문 가능

### AC-HQ-003: Follow-up 질문 처리
- **Given**: AI가 follow_up_questions 반환
- **When**: 응답을 받았을 때
- **Then**:
  - 질문들이 카드 형태로 표시
  - 예/아니오 버튼으로 빠른 답변
  - 직접 입력으로 상세 답변 가능

### AC-HQ-004: 진행 상태 표시
- **Given**: 대화가 진행 중일 때
- **When**: 각 단계가 전환될 때
- **Then**:
  - 현재 단계 하이라이트 (1→2→3)
  - 신뢰도 바 표시 (0-100%)
  - suggested_actions 카드 표시

## Integration Points

- `hq/src/index.js`: 메인 구현 파일
- `support-agent-worker/src/routes/chat.ts`: API 엔드포인트 (이미 구현됨)
- `support-agent-worker/src/lib/conversation.ts`: 대화 세션 관리 (이미 구현됨)

## Rolling Back Plan

각 Phase는 독립적으로 롤백 가능:
- Phase 1: conversation_mode 플래그로 제어 가능
- Phase 2-4: UI 컴포넌트로 분리 가능
- 기존 legacy mode 코드를 백업으로 유지

## Dependencies

- **필요**: SPEC-AGENT-COMM-001 구현 완료 (이미 완료됨)
- **관련 문서**:
  - `docs/SPEC-AGENT-COMM-001-coding-agent-guide.md`
  - `.moai/specs/SPEC-AGENT-COMM-001/`

## Risks

### 위험 요소

1. **단일 파일 복잡도**: hq/src/index.js가 이미 26,000+ 줄로 복잡함
2. **UI 일관성**: 기존 디자인과의 통합 필요
3. **사용자 혼란**: 새로운 UI로 인한 사용자 학습 곡선

### 완화책

1. **점진적 롤아웃**: 각 Phase를 순차적으로 배포
2. **A/B 테스트**: 일부 사용자에게만 새 UI 먼저 적용
3. **사용자 가이드**: 새로운 기능에 대한 안내 추가
