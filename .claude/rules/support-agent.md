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
