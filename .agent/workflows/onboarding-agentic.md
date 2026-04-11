---
description: Agent-First onboarding — agent drives, user reviews/confirms
category: dev
---

# Onboarding (Agent-First)

Agent drives 55-feature onboarding. User reviews, confirms, provides info. State tracked in `onboarding-state.json`.

## Preflight

Before starting any feature:

### A: Setup/DB Readiness
```bash
npm run agent:doctor -- --json
npm run agent:lifecycle -- --json
```
- Setup complete + `/admin` accessible + schema ok → proceed
- DB bootstrap missing → fix first (`db:migrate`, `db:seed`, `setup:step -- --next`)
- Setup incomplete → resume setup, not onboarding
- `legacy_reinstall_migration` → fresh install + snapshot transfer first

### B: Briefing
Present scope before executing any feature:
- Tier 1: 배포 필수 (7 features)
- Tier 2: 핵심 콘텐츠 (6 features)
- Tier 3+: 선택 기능
- User can choose specific items or follow recommended order (Tier 1 → 2)

## Gate Types

| Gate | When | Agent Does | User Does |
|------|------|-----------|-----------|
| A: Information | Need user input | Analyze context → propose default | Confirm or provide value |
| B: Selection | Multiple options | Recommend best option | Pick one |
| C: Review | Result needs approval | Generate/apply → show preview | Approve or request changes |
| D: Risk | High-impact action | Pre-check → warn → backup | Explicit approval |

Each feature follows: **Analyze → Execute → Verify** (3 checkpoints saved to onboarding-state.json).

## Tier 1: Deploy Essentials (7 features)

| Feature | Gate | What |
|---------|------|------|
| admin-account | A | Admin password change |
| clinic-info | A | Clinic name, intro, representative |
| clinic-contact | A | Address, phone, email, kakao |
| clinic-hours | B | Business hours |
| branding-minimal | B | Brand color, logo |
| terms-management | C | Terms & policies review |
| admin-password-env | A | Environment variable setup |

→ Tier 1 complete = ready for first deploy.

## Tier 2: Core Content (6 features)

| Feature | Gate | What |
|---------|------|------|
| staff-management | A | Doctor profiles |
| program-management | C | Treatment programs (sections, images) |
| homepage-setup | C | Homepage section layout |
| navigation-management | B | Menu structure |
| og-image | C | Social share image |
| location-page | C | Map + directions |

→ Tier 2 complete = looks like a real operating clinic.

## Tier 3+: Optional

User-initiated only. Agent suggests when relevant but never auto-starts.
Examples: reservation-setup, blog-management, seo-setup, intake-forms, multilingual, VIP management.

## Session Management

- **Resume**: Read onboarding-state.json → find `in_progress` or `pending` features → continue from last checkpoint
- **Skip**: User says "나중에" → set `status: "skipped"`. Next session: list skipped items.
- **Jump**: User can request any feature by name ("스킨부터 보고 싶어"). Agent advises if prerequisites are unmet but doesn't block.

## State Files

| File | Purpose |
|------|---------|
| `.agent/onboarding-registry.json` | Feature definitions + specs (SOT, read-only) |
| `.agent/onboarding-state.json` | Progress per feature (status: pending/in_progress/done/skipped) |
| `.agent/clinic-profile.json` | Auto-fill source (from softgate Gate 0) |

## Commands

```bash
npm run onboarding:brief     # Full scope briefing
npm run onboarding:status    # Current progress
npm run onboarding:next      # Next recommended feature
npm run onboarding:pending   # Incomplete + skipped list
```

## Messages (ko)

### 시작 브리핑
```
온보딩을 시작하겠습니다.

추천 순서는 Tier 1 (배포 필수) → Tier 2 (핵심 콘텐츠)입니다.
원하시면 특정 항목부터 바로 진행할 수 있습니다.

Tier 1 (7개): 관리자 계정, 병원 정보, 연락처, 진료시간, 브랜딩, 약관, 환경설정
Tier 2 (6개): 의료진, 프로그램, 홈페이지, 메뉴, OG이미지, 오시는길
Tier 3+: 예약, 블로그, SEO, 다국어 등 (원하실 때 진행)
```

### Tier 1 완료
```
🎉 Tier 1 완료! 1차 배포가 가능합니다.
배포하시겠습니까, Tier 2도 먼저 진행할까요?
```

### Tier 2 완료
```
✨ 핵심 콘텐츠 완료!
환자가 봤을 때 실제 운영 중인 병원으로 보입니다.
배포 후 Tier 3를 진행할까요?
```

### 세션 복귀
```
이전에 {feature}을(를) 설정하던 중이었습니다.
'{last_value}'(으)로 계속할까요, 다시 시작할까요?
```

### 건너뛰기
```
이전에 미룬 설정이 있습니다: {skipped_features}
지금 진행할까요?
```
