# Clinic-OS Support Agent - OpenClaw 연동 구조

## 채널별 인증 및 세션 관리

| 채널 | 엔드포인트 | 인증 방식 | 세션 ID 생성 | Agent ID |
|------|-----------|----------|-------------|----------|
| **Telegram** | `/webhook/telegram` | `X-Telegram-Bot-Api-Secret-Token` | `tg:${chatId}` | `OPENCLAW_AGENT_ID_PUBLIC` |
| **HQ 웹UI** | `/support/chat` | `X-License-Key` + DB 검증 | 기존 세션 관리 | `OPENCLAW_AGENT_ID_LICENSED` |
| **A2A** | `/agent/ask` | `X-API-Key` (INTERNAL_API_KEY 또는 license_key) | 기존 세션 관리 | `OPENCLAW_AGENT_ID_LICENSED` |

## Telegram 특수 처리

### 1. 인증
- 봇 웹훅 시크릿 토큰으로만 검증
- license key 없음 (anonymous 사용자)
- 그룹챗에서는 @멘션/답장/커맨드만 응답

### 2. 메시지 처리
- 4096자 제한 → 분할 전송
- Markdown 파싱 실패 시 plain text 폴리백

### 3. 후처리 (HQ 웹/A2A에는 없음)
- 세션 만료 시 Vectorize 인덱싱
- FAQ 자동 생성 (질문+답변 200자 이상, 2턴 이상)
- GitHub 이슈 자동 생성 (bug + medium/high 심각도)

## OpenClaw 연동 시 필요한 환경변수

```bash
# OpenClaw Gateway
OPENCLAW_BASE_URL=https://your-gateway-url
OPENCLAW_API_KEY=optional

# Agent IDs
OPENCLAW_AGENT_ID_PUBLIC=telegram-agent-id
OPENCLAW_AGENT_ID_LICENSED=hq-web-agent-id
```

## Worker → OpenClaw 요청 형식

```typescript
{
  sessionId: string;      // 텔레그램: tg:${chatId}, HQ/A2A: 기존 세션 ID
  channel: 'telegram' | 'web' | 'a2a';
  agentId: string;        // channel에 따라 PUBLIC 또는 LICENSED
  messages: Array<{ role: string; content: string }>;
}
```

## OpenClaw 응답 형식 (GLM4Response)

```typescript
{
  id?: string;
  content: string;
  confidence: number;
  reasoning?: string;
  follow_up_questions?: string[];
  suggested_actions?: any[];
  model?: string;
}
```

## 수정 필요한 파일

1. `support-agent-worker/src/lib/openclaw/client.ts`
   - endpoint: `/glm4` → `/v1/support` (또는 원하는 경로)
   - 폴리백 로직 제거

2. `support-agent-worker/src/lib/openclaw/types.ts`
   - `Channel` 타입: 'telegram' | 'web' | 'a2a'

3. OpenClaw Gateway 설정
   - `/v1/support` 엔드포인트 추가
   - `sessions_spawn` 또는 `sessions_send` 호출
   - GLM4Response 형식으로 응답 변환
