---
description: Skin pack workflow — manage site tone & manner via manifest + CSS + section overrides
category: dev
---

# Skin Pack Workflow

Skins control site-wide tone & manner as `manifest + CSS + section override` units.

## When to Use

- Changing entire site atmosphere (not just copy edits)
- Complex sections (Hero, MainHero) that shouldn't be hidden in a single page override
- Reusable/shareable clinic-specific design

## Basic Flow

1. Verify request is skin-related (not just a content edit)
2. Check current active skin + design settings
3. `npm run skin:create -- --id=<skin-id> --dry-run --json`
4. Design `src/skins/local/<skin-id>/manifest.json` (defaults/tokens/cssVars)
5. Add section overrides if needed (`sections/Hero.astro`, `sections/MainHero.astro`)
6. `npm run skin:check -- --json` — validate manifest, stylesheet, overrides, inheritance
7. Preview: `/admin/design` preview pack (전체/hero/cards/info/topic/faq/notice surfaces)
8. Verify: `/demo/design-system?skin=<skin-id>` + actual public pages
9. `npm run build` — final verification

## Share / Install

**Bundle for direct sharing**:
```bash
npm run skin:bundle -- --id=<skin-id> --source=local --dry-run --json
npm run skin:bundle -- --id=<skin-id> --source=local
# Receiver: npm run skin:install -- --file <zip-path> --dry-run --json
```

**HQ curated skins** (admin UI):
1. `/admin/skins/store` → browse HQ catalog
2. Install `HQ Curated` skins only
3. Restart dev server → `/admin/design` to select

**Submit to HQ community store**:
```bash
npm run skin:submit -- --id=<skin-id> --source=local --dry-run --json
npm run skin:submit -- --id=<skin-id> --source=local
# Check: HQ /admin/skins/review queue
```

## Agent Decision Rules

- Modifying local skin → `skin:create` / `skin:check` / `skin:bundle`
- Existing client skin request → check `theme_config.skinSystemVersion` or `skinActivatedAt` first
- Legacy client → legacy-safe mode until design save activates v2 templates
- Received .zip → `skin:install -- --dry-run --json` (never manual copy)
- Same ID exists in core/local → don't force store install
- After any install → `/admin/design` preview + `npm run build`
- HQ core presets → guide to `/skins`, `/skins/{skinId}`, `/guide#vibe-skins`
- Community sharing → consider `skin:submit` before manual .zip transfer

## Customization Priority

1. `manifest.json` defaults/tokens/sectionStyles
2. `skin.css` — surface styling/typography
3. `componentRecipes`
4. `pageTemplates`
5. Hero/MainHero section overrides
6. Page `_local/` adjustments (last resort)

## Commands

```bash
npm run skin:create -- --id <id> --dry-run --json
npm run skin:check -- --id <id> --json
npm run skin:install -- --id <id> --dry-run --json
npm run skin:install -- --id <id>
npm run skin:remove -- --id <id> --dry-run --json
npm run skin:bundle -- --id <id> --source local
npm run skin:submit -- --id <id> --source local
```

Rules: always `--dry-run --json` before actual execution. Core default skins → select in `/admin/design` (no install needed). Remove only from `store` source.

## NEVER

- Directly modify `src/components/sections/**`
- Put all style responsibility in a single homepage override plugin
- Change only color without updating spacing/radius/type/section rhythm

## Verification

- [ ] Skin visible in `/admin/design`
- [ ] Preview pack shows all surfaces correctly (전체/Hero/Card/Info/Topic/FAQ/Notice)
- [ ] `skin:check -- --json` has zero errors
- [ ] `/demo/design-system?skin=<id>` renders correctly
- [ ] 4-6 public pages verified (`/`, `/blog`, `/programs`, `/location`, `/topics/*`, `/notices/*`)
- [ ] Admin settings (clinic name, contact, hours) still consumed correctly
- [ ] `npm run build` passes
