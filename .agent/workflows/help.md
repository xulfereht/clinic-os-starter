---
description: Help agent — FAQ and command reference for non-technical users
category: dev
---

# Help

## FAQ

### Setup
| Question | Answer |
|----------|--------|
| 처음 시작 | `npm install && npm run setup:agent && npm run dev` |
| 이름/정보 변경 | `/admin/settings` or DB: `UPDATE site_settings SET value='새이름' WHERE key='name'` |

### Updates
| Question | Answer |
|----------|--------|
| 새 기능 받기 | `npm run core:pull` |
| Starter Kit 업데이트 | `npm run update:starter` |
| ZIP 패키지 적용 | `npm run upgrade` |
| 현재 버전 확인 | `package.json` or `.core/version` |

### Content
| Question | Answer |
|----------|--------|
| 홈페이지 수정 | `/admin/pages` or `src/content/pages/home.ko.md` |
| 프로그램 추가 | `/admin/programs` → 새 프로그램 |
| 블로그 작성 | `/admin/posts` → 글 작성 |

### Errors
| Question | Answer |
|----------|--------|
| "no such table" | `npm run db:init && npm run db:seed` |
| 화면 안 나옴 | `npm run dev` (dev server running?) |
| 로그인 안 됨 | Default: admin@sample-clinic.com / admin123 |
| npm 안 됨 | `node --version` (v18+ required) |

### Deploy
| Question | Answer |
|----------|--------|
| 배포 | `npm run deploy` |
| 배포 실패 | `npm run build && npm run preview` first |

## Troubleshooting Steps

1. `npm run health` — environment score (0-100)
2. `npm run doctor` — DB schema validation
3. `workflows/troubleshooting.md` — 13 recovery scenarios
4. 2+ failures → `./scripts/cos-ask "에러 메시지"` (support agent)

## Emergency Recovery

```bash
# DB reset
rm -rf .wrangler && npm run db:init && npm run db:seed

# Package reinstall
rm -rf node_modules && npm install

# Full reset
rm -rf node_modules .wrangler && npm install && npm run setup && npm run core:pull
```

## Command Reference

| Command | Purpose |
|---------|---------|
| `npm run setup:agent` | Auto install |
| `npm run dev` | Local dev server |
| `npm run core:pull` | App update |
| `npm run update:starter` | Infra update |
| `npm run deploy` | Production deploy |
| `npm run health` | Health check |
| `npm run doctor` | DB validation |
| `npm run db:init` | Schema init |
| `npm run db:seed` | Sample data |

## Related

| Need | Doc |
|------|-----|
| Detailed troubleshooting | `workflows/troubleshooting.md` |
| Core update procedure | `workflows/upgrade-version.md` |
| File safety rules | `.claude/rules/clinic-os-safety.md` |
| Full doc index | `.agent/README.md` |
