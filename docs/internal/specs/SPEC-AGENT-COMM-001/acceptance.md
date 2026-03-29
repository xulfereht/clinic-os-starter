# Acceptance Criteria - SPEC-AGENT-COMM-001

## AC-AGM-001: 풍부한 맥락 전달

### Scenario: 코딩 에이전트가 문제 분석 후 전송

**Given**:
- 코딩 에이전트가 API 라우터 오류를 분석
- 3가지 해결책을 시도했으나 모두 실패
- 문제 맥락: 로컬에서는 되지만 배포 후 실패

**When**:
- 서포트 에이전트에 요청을 보낼 때

**Then**:
```typescript
AgentContext {
  analysis_process: {
    problem_identification: "API 라우터가 배포 후 작동하지 않음",
    hypothesis_formed: [
      "Cloudflare Pages 라우팅 설정 문제",
      "함수 경로 문제",
      "환경 변수 누락"
    ],
    investigation_steps: [
      "로컬에서 페이지 배포 테스트",
      "함수 경로 확인",
      "환경 변수 확인"
    ]
  },
  attempts_made: [
    {
      description: "Cloudflare Pages 라우팅 설정 변경",
      code_changes: ["astro.config.mjs"],
      outcome: "부분 성공",
      lessons_learned: ["레드아이렉트 필요"]
    },
    {
      description: "함수 경로 수정",
      code_changes: ["src/pages/api/index.ts"],
      outcome: "실패",
      lessons_learned: ["다른 문제일 수 있음"]
    }
  ],
  session_context: {
    current_goal: "배포 후 API 라우터 작동하게 만들기",
    blocked_on: "원인 불명"
  }
}
```

---

## AC-AGM-002: GLM 4.7 깊은 분석

### Scenario: 맥락을 받아서 GLM 4.7이 분석

**Given**:
- 위와 같은 맥락 정보가 전달됨

**When**:
- 서포트 에이전트가 GLM 4.7을 호출할 때

**Then**:
```typescript
GLM4Response {
  content: "배포 후 API 라우터 문제입니다...",
  reasoning: "코딩 에이전트가 3가지를 시도했고, astro.config.mjs 변경으로 부분 성공했으나 여전히 문제가 있습니다. 배포 후 환경이 로컬과 다를 수 있습니다. Cloudflare Pages의 라우팅 규칙을 확인하고, 함수 경로를 절대 경로로 변경해야 할 수 있습니다.",
  confidence: 0.85,
  suggested_actions: [
    {
      type: "investigate",
      description: "Cloudflare Pages 함수 경로 확인",
      priority: "high",
      file_path: "astro.config.mjs"
    },
    {
      type: "verify",
      description: "배포 후 환경 변수 확인",
      priority: "high"
    }
  ],
  follow_up_questions: [
    "로컬 테스트 시 정상 작동하나요?",
    "Cloudflare Pages 배포 로그를 확인해봤씨니까?"
  ]
}
```

---

## AC-AGM-003: 대화형 문제 해결

### Scenario: 복잡한 문제를 대화로 해결

**Given**:
- 초기 요청: "API가 작동하지 않아"
- 코딩 에이전트가 맥락을 파악해서 전달

**When**:
- 대화 모드로 진행할 때

**Then**:
1. 서포트 에이전트: "무엇을 하려고 하시나요? 어떤� 에러가 발생하나요?"
2. 코딩 에이전트: "POST /api/submit 호출 시 404가 떠요"
3. 서포트 에이전트: "파일 경로가 어떻게 되어 있나요?"
4. 코딩 에이전트: "src/pages/api/submit.ts에 있습니다."
5. 서포트 에이전트: "함수 이름이 무엇인가요?"
6. 코딩 에이전트: "export default async function POST()입니다."
7. 서포트 에이전트: "Cloudflare Pages에서는 named export가 필요할 수 있습니다. export async function POST()로 변경해보세요."

---

## AC-AGM-004: 기존 호환성 유지

### Scenario: 기존 클라이언트가 단발 요청

**Given**:
- 기존 클라이언트가 conversation_mode 없이 요청

**When**:
- POST /chat 호출

**Then**:
- 기존 방식대로 처리됨
- 응답 형식이 호환됨
- 추가 정보 없어도 작동

---

## Performance Acceptance Criteria

### PERF-AGM-001: 맥락 전달 지연

**Requirement**: 코딩 에이전트의 맥락 분석 정보 전달

**Test**:
1. 코딩 에이전트가 AgentContext 생성
2. 서포트 에이전트에 전송
3. 전송 시간 측정

**Acceptable**: < 100ms

---

### PERF-AGM-002: GLM 4.7 응답 시간

**Requirement**: GLM 4.7 깊은 분석 응답

**Test**:
1. 맥락 정보와 함께 GLM 4.7 호출
2. 응답 시간 측정

**Acceptable**: < 10초

---

## Integration Test Scenarios

### Scenario 1: 완전한 대화형 트러블 슈팅

**Given**:
- 코딩 에이전트와 서포트 에이전트가 대화 모드로 통신

**When**:
- 복잡한 문제가 발생하고 해결 과정을 거칠 때

**Then**:
1. 맥락 정보가 전달됨
2. GLM 4.7가 깊게 분석
3. Follow-up 질문으로 맥락 파악
4. 점진적으로 문제 해결

### Scenario 2: 단발 모드 호환성

**Given**:
- 기존 클라이언트가 단발 요청

**When**:
- conversation_mode 없이 POST /chat 호출

**Then**:
- 기존 방식대로 작동
- 에러 없이 응답 반환

---

## Quality Gates

### TRUST 5 Validation

- **Tested**: 85%+ 테스트 커버리지
- **Readable**: 명확한 명명, 문서화
- **Unified**: 일관된 스타일
- **Secured**: 입력 검증, API 키 보안
- **Trackable**: 대화 기록 추적

### LSP Quality Gates

- Zero TypeScript errors
- Zero type errors
- Zero lint errors
