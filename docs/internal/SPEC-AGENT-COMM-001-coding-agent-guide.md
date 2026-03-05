# Coding Agent Integration Guide
## SPEC-AGENT-COMM-001: Conversational Troubleshooting

이 가이드는 코딩 에이전트가 서포트 에이전트와 대화형 통신을 통해 문제를 해결하는 방법을 설명합니다.

---

## Overview

### Architecture

```
┌─────────────┐         ┌─────────────────┐         ┌──────────────┐
│             │         │                 │         │              │
│  Coding     │────────>│  Support        │────────>│   GLM 4.7    │
│  Agent      │         │  Agent          │         │   (Z.ai)     │
│  (Local)    │         │  (Cloudflare)   │         │              │
│             │         │                 │         │              │
└─────────────┘         └─────────────────┘         └──────────────┘
      │                          │
      │                          │
      v                          v
  Human/User              D1 Database
```

### Key Concepts

1. **풍부한 맥락 전달**: 코딩 에이전트가 파악한 분석 과정, 시도 내역, 문제 맥락을 상세히 전달
2. **GLM 4.7 깊은 분석**: Workers AI 대신 GLM 4.7을 사용하여 깊은 통찰 제공
3. **대화형 문제 해결**: 단발 Q&A가 아니라 대화를 통해 점진적 문제 해결
4. **Follow-up 질문**: 맥락이 불충분하면 추가 정보 질문

---

## API Usage

### Endpoint

```
POST /support/chat
```

### Headers

```typescript
{
  "X-License-Key": "<your-license-key>",
  "Content-Type": "application/json"
}
```

### Request Body (Conversational Mode)

```typescript
interface ChatRequestConversational {
  session_id: string;                    // Existing support session ID
  conversation_mode: true;               // Enable conversational mode
  agent_context: AgentContext;           // Rich context from coding agent
}

interface AgentContext {
  // Basic request info
  human_request: string;                 // Original human request
  attempted_solution?: string;           // What the coding agent tried
  error_details?: ErrorDetails;          // Error information
  local_context?: LocalContext;          // Local file context

  // Rich context (NEW for SPEC-AGENT-COMM-001)
  analysis_process?: AnalysisProcess;    // How the coding agent analyzed
  attempts_made?: AttemptMade[];         // What solutions were tried
  session_context?: SessionContext;      // Current session state
}

interface AnalysisProcess {
  problem_identification: string;        // What the problem is
  hypothesis_formed: string[];           // Hypotheses generated
  root_cause_analysis?: string;          // Root cause analysis
  investigation_steps: string[];         // Steps taken to investigate
}

interface AttemptMade {
  description: string;                   // What was attempted
  code_changes?: string[];               // Files modified
  config_changes?: string[];             // Config changes made
  outcome: 'success' | 'failed' | 'partial_success';  // Result
  lessons_learned: string[];             // What was learned
}

interface SessionContext {
  conversation_history: ConversationTurn[];  // Previous turns
  current_goal: string;                  // What we're trying to achieve
  blocked_on: string;                    // What's blocking progress
}

interface ErrorDetails {
  message: string;                       // Error message
  stack?: string;                        // Stack trace
  file?: string;                         // File where error occurred
  line?: number;                         // Line number
}

interface LocalContext {
  modified_files?: string[];             // Files that were modified
  related_files?: string[];              // Related files to check
  relevant_code?: string;                // Relevant code snippet
  file_path?: string;                    // Current file path
  recent_changes?: string;               // Recent changes made
}
```

### Response (Conversational Mode)

```typescript
interface ChatResponseConversational {
  response: string;                      // Main response text
  reasoning?: string;                    // Deep analysis reasoning
  confidence: number;                    // Response confidence (0-1)
  suggested_actions?: SuggestedAction[]; // Actions to take
  follow_up_questions?: string[];        // Questions to answer
  conversation_state?: {
    phase: string;                       // Current phase
    verified_facts: string[];            // Confirmed facts
    remaining_questions: string[];       // Questions remaining
  };
  mode_used: 'conversational';
}

interface SuggestedAction {
  type: 'investigate' | 'modify' | 'configure' | 'verify';
  description: string;                   // What to do
  priority: 'high' | 'medium' | 'low';
  file_path?: string;                    // File to work on
  code_snippet?: string;                 // Code example
}
```

---

## Usage Examples

### Example 1: Basic Conversational Request

```typescript
const response = await fetch('https://clinic-os-support-agent.yeonseung-choe.workers.dev/chat', {
  method: 'POST',
  headers: {
    'X-License-Key': 'your-license-key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    session_id: 'sas_abc123...',
    conversation_mode: true,
    agent_context: {
      human_request: 'API가 작동하지 않아요',
      error_details: {
        message: '404 Not Found',
        file: 'src/pages/api/submit.ts',
        stack: 'Error: Cannot find module',
      },
      analysis_process: {
        problem_identification: 'Cloudflare Pages에서 API 라우터를 찾지 못함',
        hypothesis_formed: [
          '함수 export 형식이 잘못됨',
          '파일 경로가 잘못됨',
          'Cloudflare Pages 설정 문제',
        ],
        investigation_steps: [
          '로컬에서는 작동 확인',
          '배포 후 404 발생',
          'wrangler.toml 설정 확인',
        ],
      },
    },
  }),
});

const data = await response.json();
console.log(data.response);      // Main response
console.log(data.reasoning);     // Deep analysis
console.log(data.suggested_actions); // Actions to take
```

### Example 2: With Attempts Made

```typescript
const response = await fetch('https://clinic-os-support-agent.yeonseung-choe.workers.dev/chat', {
  method: 'POST',
  headers: {
    'X-License-Key': 'your-license-key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    session_id: 'sas_abc123...',
    conversation_mode: true,
    agent_context: {
      human_request: '배포 후 라우팅이 작동하지 않아요',
      error_details: {
        message: '404 on POST /api/submit',
      },
      local_context: {
        modified_files: ['src/pages/api/submit.ts', 'astro.config.mjs'],
        related_files: ['wrangler.toml'],
      },
      analysis_process: {
        problem_identification: 'Cloudflare Pages Functions 라우팅 문제',
        hypothesis_formed: [
          'Named export 필요',
          '파일 위치 문제',
          'Functions 설정 누락',
        ],
        investigation_steps: [
          'Astro config 확인',
          'export 형식 변경',
          'wrangler.toml functions 설정 추가',
        ],
      },
      attempts_made: [
        {
          description: 'export default를 export async function으로 변경',
          code_changes: ['src/pages/api/submit.ts'],
          outcome: 'partial_success',
          lessons_learned: ['Named export는 여전히 안 됨', '다른 문제일 수 있음'],
        },
        {
          description: 'astro.config.mjs에 output: "server" 추가',
          code_changes: ['astro.config.mjs'],
          outcome: 'failed',
          lessons_learned: ['별 차이 없음', '원인 불명'],
        },
      ],
      session_context: {
        conversation_history: [
          { role: 'support_agent', content: '함수 export 형식을 확인해보세요', timestamp: 1234567890 },
        ],
        current_goal: 'Cloudflare Pages에서 POST /api/submit 작동하게 만들기',
        blocked_on: '원인 불명 - 여러 시도 실패',
      },
    },
  }),
});
```

### Example 3: Multi-turn Conversation

```typescript
// First turn - Initial problem
let response = await fetch('/support/chat', {
  method: 'POST',
  headers: { 'X-License-Key': key, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: sessionId,
    conversation_mode: true,
    agent_context: {
      human_request: '타입스크립트 빌드 에러',
      error_details: { message: 'Type error in src/components/Button.astro' },
    },
  }),
});

let data = await response.json();

// Second turn - Answer follow-up question
if (data.follow_up_questions && data.follow_up_questions.length > 0) {
  console.log('Support agent asks:', data.follow_up_questions[0]);
  console.log('Suggested files to check:', data.suggested_actions);

  // Get more context from the file
  const fileContent = await readFile('src/components/Button.astro');

  response = await fetch('/support/chat', {
    method: 'POST',
    headers: { 'X-License-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      conversation_mode: true,
      agent_context: {
        human_request: '파일 내용을 확인했어요',
        local_context: {
          file_path: 'src/components/Button.astro',
          relevant_code: fileContent,
        },
      },
    }),
  });

  data = await response.json();
}

console.log('Final response:', data.response);
console.log('Verified facts:', data.conversation_state.verified_facts);
```

---

## Best Practices

### 1. Provide Rich Context

Always include `analysis_process` when available:

```typescript
agent_context: {
  human_request: '...',
  analysis_process: {
    problem_identification: 'Clear problem statement',
    hypothesis_formed: ['Hypothesis 1', 'Hypothesis 2'],
    investigation_steps: ['Step 1', 'Step 2'],
  },
}
```

### 2. Document Attempts

Include all attempts made with outcomes:

```typescript
attempts_made: [
  {
    description: 'What you tried',
    code_changes: ['file1.ts', 'file2.ts'],
    outcome: 'failed',  // or 'success', 'partial_success'
    lessons_learned: ['What you learned'],
  },
]
```

### 3. Track Session State

Update session_context across multiple turns:

```typescript
session_context: {
  conversation_history: [...previousTurns],
  current_goal: 'What you want to achieve',
  blocked_on: 'What is blocking you',
}
```

### 4. Handle Follow-up Questions

When support agent asks follow-up questions:

```typescript
if (data.follow_up_questions?.length > 0) {
  // Gather requested information
  // Send next turn with answers
}
```

### 5. Use Suggested Actions

Act on suggested_actions from response:

```typescript
data.suggested_actions?.forEach(action => {
  switch (action.type) {
    case 'investigate':
      // Check the file or investigate the issue
      break;
    case 'modify':
      // Make code changes
      break;
    case 'verify':
      // Verify configuration or setup
      break;
  }
});
```

---

## Error Handling

### Common Errors

```typescript
// 400 Bad Request - Invalid agent_context
{
  "error": "agent_context.human_request is required in conversational mode"
}

// 401 Unauthorized - Invalid license
{
  "error": "Invalid license key",
  "code": "INVALID_LICENSE"
}

// 500 Internal Error - GLM not configured
{
  "error": "Conversational mode not available - GLM API key not configured"
}
```

### Fallback to Legacy Mode

If conversational mode fails, you can fallback to legacy mode:

```typescript
try {
  response = await fetch('/support/chat', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      conversation_mode: true,
      agent_context: {...},
    }),
  });
} catch (error) {
  // Fallback to legacy mode
  response = await fetch('/support/chat', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      message: {
        type: 'question',
        human_request: 'Fallback request',
      },
    }),
  });
}
```

---

## Integration Example

Complete example for a coding agent:

```typescript
class SupportAgentClient {
  constructor(
    private licenseKey: string,
    private baseUrl = 'https://clinic-os-support-agent.yeonseung-choe.workers.dev'
  ) {}

  async conversationalChat(
    sessionId: string,
    humanRequest: string,
    context: {
      error?: Error;
      analysis?: AnalysisProcess;
      attempts?: AttemptMade[];
      files?: string[];
    }
  ): Promise<ChatResponseConversational> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'X-License-Key': this.licenseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        conversation_mode: true,
        agent_context: {
          human_request: humanRequest,
          error_details: context.error ? {
            message: context.error.message,
            stack: context.error.stack,
          } : undefined,
          analysis_process: context.analysis,
          attempts_made: context.attempts,
          local_context: context.files ? {
            modified_files: context.files,
          } : undefined,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Support agent error: ${response.status}`);
    }

    return await response.json();
  }

  async solveProblem(
    sessionId: string,
    problem: string,
    context: ProblemContext
  ): Promise<Solution> {
    let turnCount = 0;
    const maxTurns = 5;

    while (turnCount < maxTurns) {
      const response = await this.conversationalChat(
        sessionId,
        problem,
        context
      );

      // Check if we have enough information
      if (response.confidence > 0.8 && !response.next_actions.need_more_info) {
        return {
          solution: response.response,
          reasoning: response.reasoning,
          actions: response.suggested_actions,
        };
      }

      // Need more information - answer follow-up questions
      if (response.follow_up_questions?.length > 0) {
        const answers = await this.gatherContext(response.follow_up_questions);
        context = { ...context, ...answers };
      }

      // Try suggested actions
      if (response.suggested_actions?.length > 0) {
        const results = await this.executeActions(response.suggested_actions);
        context.attempts = [
          ...(context.attempts || []),
          ...results,
        ];
      }

      turnCount++;
    }

    throw new Error('Could not solve problem within max turns');
  }

  private async gatherContext(questions: string[]): Promise<Partial<ProblemContext>> {
    // Implement context gathering based on questions
    return {};
  }

  private async executeActions(actions: SuggestedAction[]): Promise<AttemptMade[]> {
    // Implement action execution
    return [];
  }
}

// Usage
const client = new SupportAgentClient(process.env.SUPPORT_AGENT_LICENSE_KEY);

const solution = await client.solveProblem(
  'session-123',
  'API returns 404 in production',
  {
    error: new Error('404 Not Found'),
    files: ['src/pages/api/submit.ts'],
    analysis: {
      problem_identification: 'API routing issue',
      hypothesis_formed: ['Wrong export format'],
      investigation_steps: ['Checked locally', 'Works in dev'],
    },
    attempts: [
      {
        description: 'Changed export format',
        code_changes: ['src/pages/api/submit.ts'],
        outcome: 'failed',
        lessons_learned: ['Not the export format'],
      },
    ],
  }
);

console.log('Solution:', solution.solution);
console.log('Actions:', solution.actions);
```

---

## Testing

### Test with Mock Server

```typescript
// Mock support agent for testing
const mockSupportAgent = {
  async chat(request: ChatRequestConversational) {
    return {
      response: 'Test response',
      reasoning: 'Test reasoning',
      confidence: 0.8,
      suggested_actions: [
        {
          type: 'investigate',
          description: 'Check the file',
          file_path: 'test.ts',
          priority: 'high',
        },
      ],
      follow_up_questions: ['What is the error?'],
      conversation_state: {
        phase: 'investigating',
        verified_facts: [],
        remaining_questions: ['What is the error?'],
      },
      mode_used: 'conversational',
    };
  },
};
```

---

## Migration from Legacy Mode

### Before (Legacy Mode)

```typescript
const response = await fetch('/support/chat', {
  method: 'POST',
  body: JSON.stringify({
    session_id: sessionId,
    message: {
      type: 'question',
      human_request: 'API not working',
      error_details: { message: '404' },
    },
    mode: 'basic',
  }),
});
```

### After (Conversational Mode)

```typescript
const response = await fetch('/support/chat', {
  method: 'POST',
  body: JSON.stringify({
    session_id: sessionId,
    conversation_mode: true,
    agent_context: {
      human_request: 'API not working',
      error_details: { message: '404', file: 'src/api/index.ts' },
      analysis_process: {
        problem_identification: 'API routing issue',
        hypothesis_formed: ['Export format issue'],
        investigation_steps: ['Checked logs', 'Verified file exists'],
      },
      attempts_made: [
        {
          description: 'Changed export format',
          code_changes: ['src/api/index.ts'],
          outcome: 'failed',
          lessons_learned: ['Not the export format'],
        },
      ],
    },
  }),
});
```

---

## Support

For issues or questions about the conversational mode integration:

1. Check the [SPEC-AGENT-COMM-001](../.moai/specs/SPEC-AGENT-COMM-001/) documentation
2. Review test cases in `tests/support-agent/test-conversation.ts`
3. Check implementation in `src/lib/conversation.ts` and `src/routes/chat.ts`
