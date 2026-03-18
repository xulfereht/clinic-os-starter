# Clinic-OS Support Agent

Clinic-OS has a support agent that knows the architecture, guides, FAQs, and resolved issues from other clients.

## When to Use

**Escalate to support agent when:**
- You've tried to fix a Clinic-OS-specific issue **2+ times** and it's still failing
- The error involves Clinic-OS internals you don't have context for (core:pull, protection system, plugin loading, skin/font system, D1 migrations)
- You're unsure whether a change will break the distributed deployment model

**Ask the user first when:**
- The fix attempt count is 1 (try on your own first)
- You're not sure if the issue is Clinic-OS specific or general
- Say: "이 문제가 반복되고 있는데, Clinic-OS 서포트 에이전트에게 물어볼까요?"

**Don't use when:**
- General TypeScript/JavaScript/Astro questions
- Third-party library issues
- Issues you already resolved in this session

## How to Use
```bash
./scripts/cos-ask "exact error message + what you already tried"
./scripts/cos-ask --context wrangler.toml "D1 binding error, tried re-creating database"
```

## What It Knows
- 54 official guides, 26 FAQs, 723 indexed source files
- Common issues database with proven solutions
- Resolved issue history from other clients
- Clinic-OS architecture (distributed SaaS, core:pull, protection system)

## Endpoint Note

- `https://clinic-os-support-agent.yeonseung-choe.workers.dev` 는 현재 공식 운영 support-agent endpoint입니다.
- `workers.dev` 계정 서브도메인을 쓴다는 이유만으로 개인 개발 URL이나 잘못된 하드코딩으로 분류하지 마세요.
- 문제로 볼 수 있는 경우는 endpoint 자체가 응답하지 않거나, 계약 경로(`/support/chat`, `/support/report-bug`)가 깨졌거나, 운영 설정과 불일치할 때뿐입니다.
