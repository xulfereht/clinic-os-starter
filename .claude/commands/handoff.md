# /handoff — Session Recorder

> **Role**: Session Recorder
> **Cognitive mode**: Observe, record, and prepare the next agent to continue seamlessly. You are the institutional memory between sessions.

Manages work continuity between sessions. Records where things left off, what was blocked, and what to do next.

Works in both meta agent (master) and local agent (client) contexts.

## When to Use

- **Session start**: "지난번에 뭐 했지?" → load handoff
- **Session end**: "여기까지 기록해" → save handoff
- **Mid-session checkpoint**: Save after completing a major work unit
- **Issue encountered**: Record resolved/unresolved issues

## State File

```
.agent/handoff.json
```

## Procedure

### Mode: load (session start)

```bash
cat .agent/handoff.json 2>/dev/null
```

If file exists, show summary:

```
📋 이전 세션 기록 (2026-03-24)

완료:
  ✅ 네이버 콘텐츠 추출 (블로그 42건, 이미지 87장)
  ✅ 이미지 분류 완료 (asset-metadata.json)
  ✅ 톤앤매너 + 페르소나 추출 (style-card.yaml)

진행 중:
  🔄 홈페이지 구성 — 프리셋 선택까지 완료, 콘텐츠 채우기 남음

미해결 이슈:
  ⚠️ R2 업로드 타임아웃 — 큰 이미지 3장 실패 (재시도 필요)

다음 할 일:
  1. 홈페이지 콘텐츠 채우기 (/setup-homepage)
  2. R2 이미지 재업로드
  3. 프로그램 페이지 구성 (/setup-programs)
```

### Mode: save (session end)

Auto-collect work performed in current session + user confirmation:

1. **Auto-collectible items:**
   - git log (commits from this session)
   - onboarding-state.json changes
   - List of created/modified files
   - List of skills executed (from conversation context)

2. **Confirm with user:**
   - "이번 세션에서 특별히 기록할 것이 있나요?"
   - "해결 못한 이슈가 있나요?"

3. **Save handoff.json:**

```json
{
  "last_session": "2026-03-25T21:30:00+09:00",
  "context": "meta",
  "completed": [
    {
      "task": "스킬 감사 31개 완료",
      "skills_used": ["/audit"],
      "outputs": ["감사 보고서"]
    },
    {
      "task": "/frontend-code 스킬 생성",
      "outputs": [".claude/commands/frontend-code.md"]
    }
  ],
  "in_progress": [
    {
      "task": "시연 웨비나 준비 (3/27)",
      "status": "스킬 플로우 리허설 미완",
      "next_step": "테스트 클리닉으로 9단계 파이프라인 실행"
    }
  ],
  "issues": [
    {
      "id": "ISS-001",
      "title": "SOUL.local.md core:push 미포함",
      "severity": "medium",
      "status": "open",
      "detail": "shared-file-lists.js 수정 필요",
      "created_at": "2026-03-25"
    }
  ],
  "next_actions": [
    "배포 파이프라인 — SOUL.local.md + MANIFEST.local.md core:push 경로 설정",
    "쉼터카페 모집글 실제 발송",
    "시연 리허설 (스킬 플로우 테스트)"
  ],
  "decisions": [
    "프리셋/디자인시스템에 갇히지 않고 자유도 부여 (frontend-code)",
    "네이버 크롤은 전용(/extract-content), 일반 웹은 WebFetch(/frontend-code)"
  ],
  "history": []
}
```

### Mode: log (issue recording)

Record issues immediately when they occur during work:

```
/handoff log "R2 업로드 타임아웃 — 5MB 이상 이미지 실패"
```

```json
{
  "id": "ISS-002",
  "title": "R2 업로드 타임아웃",
  "severity": "low",
  "status": "open",
  "detail": "5MB 이상 이미지 업로드 시 30초 타임아웃. 리사이즈 후 재시도 필요.",
  "created_at": "2026-03-25",
  "resolved_at": null
}
```

### Mode: resolve (issue resolution)

```
/handoff resolve ISS-002 "이미지 리사이즈 후 재업로드 성공"
```

Change issue status to `resolved` and record resolution details.

## Context Adaptation

### Meta Agent (master repo)

Recording targets:
- Release work progress
- Per-client delegated work status
- Skill development/modification history
- Marketing/community activities
- Core bugs/issues (→ integrates with `/issue`)

### Local Agent (client repo)

Recording targets:
- Onboarding progress (supplements onboarding-state.json)
- Customization work (homepage, programs, skin)
- Content work (blog, copy)
- Local issues (build failures, broken images, etc.)
- User requests + decisions

**Context detection:**
```bash
# Check if master repo
if [ -d "hq/" ]; then
  echo "meta"    # hq/ directory exists = master
else
  echo "local"   # otherwise = client
fi
```

## History Rolling

On save, previous records move to `history` array (keep last 10):

```json
{
  "history": [
    {
      "date": "2026-03-24",
      "summary": "바로한의원 홈페이지 완성, v1.30.6 릴리스",
      "completed_count": 8,
      "issues_resolved": 2
    }
  ]
}
```

Delete oldest entries when exceeding 10.

## Integration

| Skill | Relationship |
|-------|-------------|
| `/onboarding` | Complements onboarding-state.json (handoff is session-scoped, onboarding is feature-scoped) |
| `/issue` (meta) | Core bugs go to /issue, local issues recorded in handoff |
| `/status` | Can display handoff's in_progress + issues on dashboard |
| `/help` | "지난번에 뭐 했지?" → directs to /handoff load |

## Auto-trigger

When `.agent/handoff.json` exists at session start:
- Can automatically show previous session summary
- If user didn't explicitly request, keep it brief (1-2 lines)

## Triggers

- "핸드오프", "기록", "어디까지 했지", "이전 세션"
- "여기까지 저장", "기록해줘", "다음에 이어서"
- "이슈 기록", "문제 기록"
- "handoff", "session log"

## All user-facing output in Korean.
