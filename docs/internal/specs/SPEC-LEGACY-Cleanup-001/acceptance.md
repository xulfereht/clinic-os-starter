# Acceptance Criteria - SPEC-LEGACY-Cleanup-001

## AC-LC-001: 레거시 모드 제거

### Scenario: 대화형 모드 전용 라우팅

**Given**:
- Support Agent Worker가 배포됨
- 레거시 모드 코드가 제거됨

**When**:
- legacy mode 요청 (`mode: 'basic'`)이 들어올 때

**Then**:
```typescript
// src/routes/chat.ts
chat.post('/', async (c) => {
  // Always route to conversational mode
  return handleConversationalMode(c, body);
});
```

**Expected Result**:
- 레거시 요청도 conversational mode로 처리
- 에러 없이 작동

---

### Scenario: 타입 단순화

**Given**:
- `src/types.ts`가 수정됨

**When**:
- 타입 검사 실행

**Then**:
```typescript
// CLAUDE_API_KEY 제거됨
export interface Env {
  // CLAUDE_API_KEY?: string; // ← 제거됨
  GLM_API_KEY?: string;
}

// ChatRequest 단순화됨
export interface ChatRequest {
  conversation_mode: true;  // 항상 true
  agent_context: AgentContext;
  // message, mode 제거됨
}
```

**Expected Result**:
- TypeScript 컴파일 에러 없음
- unused import 없음

---

## AC-LC-002: 대화형 모드 전용

### Scenario: HQ Support 페이지 테스트

**Given**:
- HQ Support 페이지가 대화형 모드만 사용
- 레거시 모드가 제거됨

**When**:
- 사용자가 HQ Support 페이지에서 질문 전송

**Then**:
```javascript
// HQ Support 페이지 요청
{
  session_id: 'sas_abc...',
  conversation_mode: true,
  agent_context: {
    human_request: 'API가 작동하지 않아요'
  }
}
```

**Expected Response**:
```json
{
  "response": "배포 후 API 라우터 문제입니다...",
  "reasoning": "코딩 에이전트와 달리...",
  "confidence": 0.75,
  "suggested_actions": [...],
  "follow_up_questions": [...],
  "conversation_state": {...},
  "mode_used": "conversational"
}
```

**Verification:**
- [ ] GLM 4.7 응답 수신
- [ ] reasoning 필드 표시
- [ ] confidence 표시
- [ ] suggested_actions 표시

---

## AC-LC-003: CLAUDE_API_KEY 제거

### Scenario: 시크릿 제거

**Given**:
- CLAUDE_API_KEY가 wrangler secret에서 제거됨

**When**:
- `wrangler secret list` 실행

**Then**:
```bash
$ wrangler secret list
🔓 Current Secrets:
Name          Value      Type
GLM_API_KEY   ********   text  # ✅ 유지
INTERNAL_API_KEY   ********   text  # ✅ 유지
GITHUB_TOKEN   ********   text  # ✅ 유지
# CLAUDE_API_KEY 없음  # ✅ 제거됨
```

**Verification:**
- [ ] CLAUDE_API_KEY가 목록에 없음
- [ ] 배포 후 에러 없음

---

## AC-LC-004: 코드 정리

### Scenario: 불필요 코드 제거 확인

**Given**:
- 레거시 모드 관련 코드가 제거됨

**When**:
- 코드베이스 검색

**Then**:
```bash
# handleLegacyMode 제거됨
$ grep -r "handleLegacyMode" src/
# 결과 없음

# claude.ts 제거됨
$ ls src/lib/claude.ts
# No such file or directory

# LlmMode 제거됨
$ grep -r "LlmMode" src/
# 결과 없음
```

**Expected Result:**
- [ ] `handleLegacyMode` 함수 없음
- [ ] `src/lib/claude.ts` 파일 없음
- [ ] `isClaudeAvailable` import 없음
- [ ] `LlmMode` 타입 참조 없음

---

## AC-LC-005: Health Check

### Scenario: GLM API만 확인

**Given**:
- Health check 엔드포인트가 업데이트됨

**When**:
- `GET /health` 호출

**Then**:
```json
{
  "status": "healthy",
  "checks": {
    "database": true,
    "workers_ai": true,
    "glm_api": true
  },
  "version": "1.0.0"
}
```

**Verification:**
- [ ] `claude_api` 필드 없음
- [ ] `glm_api` 필드 있음
- [ ] GLM_API_KEY 설정 시 `glm_api: true`

---

## Integration Test Scenarios

### Scenario 1: 완전한 대화형 트러블슈팅

**Given**:
- 코딩 에이전트가 Support Agent에 질문
- 대화형 모드로 질문

**When**:
1. 코딩 에이전트가 conversational mode로 질문 전송
2. Support Agent가 GLM 4.7로 분석
3. 응답 반환

**Then**:
```json
{
  "response": "해결책입니다...",
  "reasoning": "분석 과정...",
  "confidence": 0.85,
  "suggested_actions": [
    {
      "type": "modify",
      "description": "파일 수정",
      "file_path": "src/api/index.ts"
    }
  ],
  "follow_up_questions": [
    "수정 후 작동하나요?"
  ],
  "conversation_state": {
    "phase": "resolving",
    "verified_facts": ["API 라우터 문제 확인"],
    "remaining_questions": []
  },
  "mode_used": "conversational"
}
```

**Acceptance:**
- [ ] GLM 4.7 깊은 분석 제공
- [ ] reasoning 표시
- [ ] confidence 0.7 이상
- [ ] suggested_actions 유용
- [ ] follow_up_questions 생성

---

### Scenario 2: 레거시 요청 자동 변환 (안전장치)

**Given**:
- 기존 클라이언트가 실수로 legacy mode 요청

**When**:
```json
{
  "session_id": "sas_...",
  "message": {
    "type": "question",
    "human_request": "질문"
  },
  "mode": "basic"
}
```

**Then**:
- 자동으로 conversational mode로 변환
- 에러 없이 처리됨
- 정상 응답 반환

---

## Quality Gates

### TRUST 5 Validation

- **Tested**: 모든 시나리오 통과, 대화형 모드 작동 확인
- **Readable**: 명확한 주석, 깔끔한 코드 구조
- **Unified**: 일관된 스타일, ES 린터 통과
- **Secured**: 입력 검증 유지, SQL 인젝션 방지
- **Trackable**: git 커밋 메시지, 변경 로그

### LSP Quality Gates

- TypeScript 에러: 0
- unused import: 0
- lint 에러: 0

---

## Performance Acceptance Criteria

### PERF-LC-001: 응답 시간

**Requirement**: 대화형 모드 응답 시간

**Test**:
1. conversational mode 요청 전송
2. GLM 4.7 응답 시간 측정

**Acceptable**: < 10초 (SPEC-AGENT-COMM-001 기준 유지)

### PERF-LC-002: 메모리 사용

**Requirement**: 레거시 코드 제거 후 메모리

**Test**:
1. 번들 크기 측정
2. Workers 크기 제한 확인

**Acceptable**: 50MB 이하 (Cloudflare Workers 제한)

---

## Rollback Acceptance Criteria

### ROLL-LC-001: 브랜치 롤백

**Scenario**: 문제 발생 시 롤백

**Given**:
- feature 브랜치에서 작업
- 배포 후 문제 발생

**When**:
```bash
git checkout main
git branch -D feature/remove-legacy-mode
```

**Then**:
- [ ] 레거시 모드 복구됨
- [ ] 정상 작동 확인
- [ ] 데이터 손실 없음
