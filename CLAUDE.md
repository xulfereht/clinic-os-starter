# Clinic-OS Development Instructions for Claude Code

> This file guides Claude Code agents in developing and troubleshooting Clinic-OS projects.

---

## Project Context

This is a Clinic-OS client installation. Key files:

- `.client/CONTEXT.md` - Environment-specific context (read this first if exists)
- `core/` - Application source code (managed by Git sync)
- `data/` - Configuration and local data
- `.docking/config.yaml` - HQ connection settings

---

## Support Agent Integration

When encountering Clinic-OS-specific issues that cannot be resolved locally, escalate to the Support Agent.

### When to Escalate

- D1 database errors (SQLITE_CONSTRAINT, schema issues)
- Cloudflare Workers deployment errors
- Clinic-OS API unexpected responses
- Complex business logic questions about Clinic-OS
- After 2+ failed local troubleshooting attempts

### Support Agent Tool

Use the CLI tool to interact with Support Agent:

```bash
# Quick question
pnpm support "your question here"

# Deep analysis (uses Claude for complex issues)
pnpm support --deep "complex issue description"

# Interactive session
pnpm support --session
```

### Tool Definition

When you need to recommend Support Agent to the user, suggest the appropriate command:

```
Name: clinic_os_support
Description: Escalate technical questions to Clinic-OS Support Agent for AI-powered assistance

Parameters:
  - question (required): The technical question or error description
  - context (optional): Relevant code context or error stack trace
  - mode (optional): "basic" for quick answers, "deep" for detailed analysis

Usage Pattern:
  pnpm support "<question>" [--deep]
```

### Usage Examples

**D1 Database Error:**
```bash
pnpm support "SQLITE_CONSTRAINT error when inserting patient record with duplicate email"
```

**Complex Architecture Question:**
```bash
pnpm support --deep "How should I structure custom plugins for multi-location clinics?"
```

**Worker Timeout:**
```bash
pnpm support --deep "Worker CPU timeout in handlePatientSearch function"
```

---

## Error Handling with Support Agent

When you encounter errors matching these patterns, suggest Support Agent escalation:

| Error Pattern | Suggested Action |
|---------------|------------------|
| `SQLITE_CONSTRAINT` | `pnpm support "D1 constraint error: [details]"` |
| `Worker exceeded CPU time limit` | `pnpm support --deep "Worker timeout: [function]"` |
| `D1_ERROR` | `pnpm support "D1 error: [message]"` |
| `KV namespace .* not found` | `pnpm support "KV namespace configuration"` |
| `clinic_setup.yaml` errors | `pnpm support "Configuration: [issue]"` |
| `Failed to fetch from HQ` | `pnpm support "HQ connectivity issue"` |

### Auto-Escalation Prompt

When local troubleshooting fails after 2 attempts, suggest:

> "I've tried [describe approaches]. Consider asking Support Agent for expert help:
> `pnpm support --deep \"[error description with context]\"`"

---

## Environment Variables

Required for Support Agent:

- `SUPPORT_AGENT_URL`: https://clinic-os-support-agent.yeonseung-choe.workers.dev
- `LICENSE_KEY`: Your Clinic-OS license key

These are automatically configured during `npm run setup`. If missing, add them to `.env`.

---

## Common Commands

| Command | Purpose |
|---------|---------|
| `npm run setup` | Initial setup and code sync |
| `npm run dev` | Start local development server |
| `npm run core:pull` | Update to latest core version |
| `npm run deploy` | Deploy to Cloudflare |
| `pnpm support "<question>"` | Ask Support Agent |

---

## Development Guidelines

### Safe Zones (Never Overwritten)

These directories are preserved during updates:
- `.env` - Environment variables
- `data/` - Local configuration
- `.client/` - Customizations
- `wrangler.toml` - Cloudflare config

### Core Files (Managed by Git)

Files in `core/` are managed by Git sync. Do not modify directly unless:
1. Testing a fix locally
2. Creating a pull request to upstream
3. Working in designated local override directories (`src/lib/local/`, `src/plugins/local/`)

### Customization Points

For custom code, use these designated directories:
- `src/lib/local/` - Local utility functions
- `src/plugins/local/` - Custom plugins
- `.client/customizations/` - Environment-specific overrides

---

## Rate Limits Reference

Support Agent rate limits by tier:

| Tier | Sessions/Day | Messages/Session | Deep Mode |
|------|--------------|------------------|-----------|
| Free | 10 | 20 | Not available |
| Basic | 50 | 50 | 5/day |
| Pro | Unlimited | Unlimited | Unlimited |

If rate limited, wait for reset or suggest tier upgrade to user.
