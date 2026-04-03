# Acceptance Criteria - SPEC-AGENT-COMM-002

## AC-HQ-001: 대화형 모드 기본 활성화

### Scenario: 사용자가 질문을 보낼 때 conversation_mode가 활성화됨

**Given**:
- 사용자가 support 페이지에 접속
- 세션이 시작됨

**When**:
- 사용자가 "API가 작동하지 않아요"라고 질문 입력

**Then**:
```javascript
// API 요청
{
  session_id: "sas_abc123...",
  conversation_mode: true,  // ← conversational mode 활성화
  agent_context: {
    human_request: "API가 작동하지 않아요"
  }
}

// API 응답
{
  response: "배포 후 API 라우터 문제입니다...",
  reasoning: "코딩 에이전트와 달리 사용자는 맥락 정보가 부족합니다...",
  confidence: 0.75,
  follow_up_questions: [
    "어떤 API에서 문제가 발생하나요?",
    "로컬에서는 작동하나요?"
  ],
  suggested_actions: [
    {
      type: "investigate",
      description: "API 파일 확인",
      priority: "high"
    }
  ],
  mode_used: "conversational"
}
```

---

## AC-HQ-002: 맥락 정보 수집

### Scenario: 모호한 질문 시 맥락 정보 요청

**Given**:
- 사용자가 처음으로 질문
- 질문이 20자 미만: "안 돼아"

**When**:
- 사용자가 전송 버튼 클릭

**Then**:
```html
<!-- 맥락 정보 수집 모달 표시 -->
<div class="context-modal show">
  <h3>추가 정보를 입력해주세요</h3>
  <p>질문이 모호하여 정확한 답변을 드리기 어렵습니다.</p>

  <div class="form-group">
    <label>문제 유형</label>
    <select>
      <option value="error">에러 발생</option>
      <option value="how-to">사용 방법</option>
      <option value="troubleshooting">트러블슈팅</option>
    </select>
  </div>

  <div class="form-actions">
    <button class="btn btn-primary">입력 완료</button>
    <button class="btn btn-ghost">건너뛰기</button>
  </div>
</div>
```

### Scenario: 에러 유형 선택 시 에러 정보 폼 표시

**Given**:
- 맥락 정보 모달이 열림
- 사용자가 "에러 발생" 선택

**When**:
- 선택이 변경됨

**Then**:
```html
<!-- 에러 정보 입력 필드 추가 표시 -->
<div class="form-group show">
  <label>에러 메시지</label>
  <textarea placeholder="에러 메시지를 붙여넣어주세요"></textarea>

  <label>관련 파일</label>
  <input type="text" placeholder="예: src/pages/api/index.ts" />
</div>
```

### Scenario: 건너뛰기 선택 시 기존 방식으로 진행

**Given**:
- 맥락 정보 모달이 열림
- 사용자가 "건너뛰기" 클릭

**When**:
- 버튼 클릭

**Then**:
- 맥락 정보 없이 conversational mode로 질문 전송
- 모달 닫힘

---

## AC-HQ-003: Follow-up 질문 UI

### Scenario: AI가 follow_up_questions를 반환

**Given**:
- 사용자가 질문 전송
- AI 응답에 follow_up_questions 포함

**When**:
- 응답이 수신됨

**Then**:
```html
<!-- Follow-up 질문 컨테이너 -->
<div class="follow-up-questions">
  <div class="question-card">
    <div class="question-icon">❓</div>
    <div class="question-content">
      <p>어떤 API에서 문제가 발생하나요?</p>
      <div class="quick-replies">
        <button class="btn-reply" onclick="quickReply(0, 'POST /api/submit')">
          POST /api/submit
        </button>
        <button class="btn-reply" onclick="quickReply(0, 'GET /api/data')">
          GET /api/data
        </button>
        <button class="btn-reply btn-outline" onclick="customReply(0)">
          직접 입력
        </button>
      </div>
    </div>
  </div>

  <div class="question-card">
    <div class="question-icon">❓</div>
    <div class="question-content">
      <p>로컬에서는 작동하나요?</p>
      <div class="quick-replies">
        <button class="btn-reply" onclick="quickReply(1, '예, 작동합니다')">
          예
        </button>
        <button class="btn-reply" onclick="quickReply(1, '아니오, 안 됩니다')">
          아니오
        </button>
        <button class="btn-reply btn-outline" onclick="customReply(1)">
          직접 입력
        </button>
      </div>
    </div>
  </div>
</div>
```

### Scenario: 빠른 답변 버튼 클릭 시 자동 전송

**Given**:
- Follow-up 질문이 표시됨
- 사용자가 "POST /api/submit" 버튼 클릭

**When**:
- 버튼 클릭

**Then**:
- 답변이 입력창에 자동 입력
- 자동으로 메시지 전송
- 다음 follow-up 질문이 있으면 표시

---

## AC-HQ-004: 진행 상태 시각화

### Scenario: 대화 단계별 진행 상태 표시

**Given**:
- 대화가 진행 중
- conversation_state.phase가 "investigating"임

**When**:
- 각 응답을 받을 때마다

**Then**:
```html
<!-- 대화 상태 인디케이터 -->
<div class="conversation-status">
  <div class="status-header">
    <span class="status-text">🔄 분석 중...</span>
    <div class="confidence-indicator" title="신뢰도: 75%">
      <div class="confidence-bar" style="width: 75%"></div>
    </div>
  </div>

  <div class="status-phase">
    <span class="phase-step" data-phase="understanding">
      <span class="step-icon">1</span>
      <span class="step-label">이해 중</span>
    </span>
    <span class="phase-step active" data-phase="investigating">
      <span class="step-icon">2</span>
      <span class="step-label">조사 중</span>
    </span>
    <span class="phase-step" data-phase="resolving">
      <span class="step-icon">3</span>
      <span class="step-label">해결 중</span>
    </span>
  </div>
</div>
```

### Scenario: Suggested Actions 카드 표시

**Given**:
- AI 응답에 suggested_actions 포함
- confidence > 0.5

**When**:
- 응답 표시 시

**Then**:
```html
<div class="suggested-actions">
  <div class="suggested-action priority-high">
    <div class="action-header">
      <span class="action-priority">🔴</span>
      <span class="action-type">조사 필요</span>
    </div>
    <div class="action-description">
      src/pages/api/submit.ts 파일을 확인하여 export 형식을 검토하세요
    </div>
    <div class="action-file">
      <span class="file-icon">📄</span>
      <code>src/pages/api/submit.ts</code>
    </div>
    <button class="btn btn-sm" onclick="copyToClipboard('src/pages/api/submit.ts')">
      📋 복사
    </button>
  </div>

  <div class="suggested-action priority-medium">
    <div class="action-header">
      <span class="action-priority">🟡</span>
      <span class="action-type">확인 필요</span>
    </div>
    <div class="action-description">
      배포 후 환경 변수가 설정되어 있는지 확인해주세요
    </div>
  </div>
</div>
```

---

## UI/UX Acceptance Criteria

### Ux-HQ-001: 사용자 친화적 인터페이스

**Given**:
- 일반 클리닉 운영자가 사용 (개발자 아님)

**When**:
- 첫 방문 시

**Then**:
- 기술 용어 최소화
- 한국어 중심 UI
- 명확한 안내 문구
- 빠른 학습 곡선

### Ux-HQ-002: 모바일 반응형

**Given**:
- 모바일 장치에서 접속

**When**:
- 화면 너비 < 768px

**Then**:
- 모달이 전체 화면으로 표시
- 입력 폼이 세로 모드로 정렬
- 버튼들이 충분히 큼게 터치 영역 확보
- 키보드가 입력창을 가리지 않음

### Ux-HQ-003: 접근성

**Given**:
- 시각/운동 장애 사용자

**When**:
- 화면 리더기 사용 시

**Then**:
- 충분한 색상 대비
- 키보드 네비게이션 지원
- 명확한 포커스 표시
- ARIA 라벨 포함

---

## Performance Acceptance Criteria

### PERF-HQ-001: 맥락 수집 지연

**Requirement**: 맥락 정보 모달 표시

**Test**:
1. 모호한 질문 입력
2. 전송 버튼 클릭
3. 모달 표시까지의 시간 측정

**Acceptable**: < 100ms

### PERF-HQ-002: Follow-up 질문 렌더링

**Requirement**: follow_up_questions 표시

**Test**:
1. API 응답 수신
2. follow_up_questions 파싱
3. UI 표시 완료까지의 시간 측정

**Acceptable**: < 200ms

---

## Integration Test Scenarios

### Scenario 1: 완전한 대화형 트러블슈팅

**Given**:
- 사용자가 API 라우터 문제로 고민
- 에러 메시지: "404 Not Found on POST /api/submit"

**When**:
1. 맥락 정보 수집: 에러 메시지, 파일 경로 입력
2. 첫 질문: "배포 후 API가 404를 반환해요"
3. Follow-up: "POST /api/submit" 버튼 클릭
4. AI 조사 후 suggested_actions 확인

**Then**:
- reasoning에 문제 분석 포함
- confidence > 0.7
- suggested_actions에 구체적 해결책 포함
- 최종 해결까지 3회 이내 대화

### Scenario 2: 기존 방식 호환성

**Given**:
- 기존 사용자가 "건너뛰기" 선택

**When**:
- 간단 질문 입력 후 전송

**Then**:
- conversational mode로 작동
- 맥락 정보 없이도 적절한 답변 제공
- follow-up 질문으로 맥락 파악

---

## Quality Gates

### TRUST 5 Validation

- **Tested**: 수동 테스트 시나리오 모두 통과
- **Readable**: 명확한 주석과 문서화
- **Unified**: 기존 UI와 일관된 스타일
- **Secured**: 입력 sanitization, XSS 방지
- **Trackable**: 사용자 행동 로깅

### LSP Quality Gates

- 자바스크립트 문법 오류: 0
- 콘솔 오류: 0
</content>
