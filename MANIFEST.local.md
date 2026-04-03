# Clinic-OS Local Agent — Manifest

> SOUL.md defines who you are. This document defines what you can do.
> This is the skill map, data connector reference, and execution guide for the local agent.

---

## 1. Skill Architecture

Skills are Claude Code harness commands in `.claude/commands/`. They come in two types:

- **Atomic skills** — do one thing, independently executable
- **Orchestrator skills** — call atomic skills in sequence, manage workflow

An orchestrator skill (like `/onboarding`) calls atomic skills (like `/extract-place`, `/init-profile`) as sub-steps. The human can also run any atomic skill directly.

```
/onboarding (orchestrator)
  ├── /extract-place     ← atomic: pull Naver Place data
  ├── /extract-content   ← atomic: crawl existing blog
  ├── /extract-images    ← atomic: collect images + metadata
  ├── /init-profile      ← atomic: assemble clinic profile
  ├── /setup-domain      ← atomic: connect custom domain
  ├── /setup-admin       ← atomic: create admin account
  └── ... (tier 1-5 sub-skills)

/help (orchestrator)
  ├── list available skills
  ├── recommend skill for user's intent
  └── guide through execution
```

## 2. Skill Catalog

> **SOT**: `.agent/skill-registry.json` — 전체 스킬 목록의 단일 소스.
> `/help` 스킬로 가용 스킬을 확인할 수 있습니다.

### 콘텐츠 파이프라인 (핵심 워크플로우)

추출 → 분석 → 기획 → 제작 → 구성 순서로 진행합니다.

| 순서 | Skill | 입력 | 산출물 |
|------|-------|------|--------|
| 1 | `/extract-content` | 네이버 블로그 ID, 플레이스 URL | `clinic-profile.json` + DB posts |
| 1.5 | `/collect-references` (선택) | 경쟁사/기존사이트 URL | `references.yaml` |
| 2a | `/analyze-content` | DB posts, clinic-profile | `style-card.yaml` + `pipeline-context.yaml` |
| 2b | `/discover-edge` | style-card, references | `edge-profile.yaml` |
| 3 | `/plan-content` | edge-profile, style-card | `site-plan.yaml` (readiness + blog 딥링킹) |
| 4 | `/write-copy` | site-plan, edge-profile, blog posts | 실제 카피 |
| 5a | `/setup-homepage` | site-plan, copy | 커스텀 홈페이지 |
| 5b | `/setup-programs` | site-plan, blog posts, style-card | 프로그램 페이지 |

**충분성 게이트**: 각 단계에서 데이터 충분성을 체크합니다. 부족하면 사용자에게 보충을 요청합니다.
**상세 가이드**: `.agent/workflows/content-bootstrap.md`

### 파이프라인 산출물

스킬이 `.agent/` 디렉토리에 분석 파일을 생성합니다. 다운스트림 스킬이 이를 읽습니다.

| 산출물 | 생성 스킬 | 소비 스킬 |
|--------|----------|----------|
| `clinic-profile.json` | `/extract-content` | `/analyze-content`, `/setup-clinic-info` |
| `references.yaml` | `/collect-references` | `/discover-edge`, `/plan-content` |
| `style-card.yaml` | `/analyze-content` | `/write-copy`, `/write-blog`, `/setup-homepage` |
| `edge-profile.yaml` | `/discover-edge` | `/write-copy`, `/plan-content` |
| `site-plan.yaml` | `/plan-content` | `/setup-homepage`, `/setup-programs` |
| `pipeline-context.yaml` | `/analyze-content` (초기화) | 모든 다운스트림 스킬 (읽기+갱신) |

이 파일들은 로컬(core:pull 보호)이며 세션 간 누적됩니다.

### 셋업 & 온보딩

| Skill | Purpose |
|-------|---------|
| `/onboarding` | 33개 피처, 5 티어 온보딩 오케스트레이터 |
| `/setup-clinic-info` | 기본 정보: 이름, 전화, 주소, 진료시간 |
| `/setup-homepage` | editorial/classic 프리셋 기반 홈페이지 구성 |
| `/setup-programs` | 프로그램 페이지 (blog 기반 섹션 생성) |
| `/setup-skin` | 테마/스킨 적용 |
| `/setup-og` | OG 이미지 + 소셜 메타 설정 |
| `/setup-intake` | 문진표 설정 |
| `/setup-i18n` | 다국어 설정 |
| `/setup-notifications` | 알림 채널 설정 |
| `/cleanup-samples` | 샘플 데이터 정리 |
| `/import-data` | 외부 데이터 가져오기 |

### 콘텐츠 제작

| Skill | Purpose |
|-------|---------|
| `/write-blog` | 라이터 페르소나 기반 블로그 글 작성 |
| `/write-copy` | 마케팅 카피 (히어로, 프로그램, 캠페인) |
| `/faq-generate` | 환자 질문 기반 FAQ 자동 생성 |
| `/review-curate` | 환자 후기 큐레이션 |
| `/review-compliance` | 의료광고법 컴플라이언스 검토 |
| `/optimize-aeo` | AEO/SEO 최적화 |

### 이미지 & 디자인

| Skill | Purpose |
|-------|---------|
| `/curate-images` | 수집 이미지 분류 + 메타데이터 |
| `/enhance-portrait` | 원장 사진 보정 (나노바나나) |
| `/generate-scenes` | 프로그램 이미지 생성 (나노바나나) |
| `/frontend-code` | 프론트엔드 코드 구현 |

### 분석 & 리포트

| Skill | Purpose |
|-------|---------|
| `/clinic-advisor` | 데이터 기반 경영 어드바이저 |
| `/business-report` | 월간 경영 리포트 |
| `/patient-cohort` | 환자 세그멘테이션 |
| `/campaign-draft` | 환자 캠페인 초안 |
| `/patient-remind` | 환자 리마인더 & 팔로업 |

### 시스템 & 유지보수

| Skill | Purpose |
|-------|---------|
| `/help` | 가용 스킬 안내, 의도 기반 추천 |
| `/handoff` | 세션 간 연속성 기록 |
| `/status` | 시스템 상태 대시보드 |
| `/infra-check` | D1, R2, Workers 인프라 검증 |
| `/troubleshoot` | 문제 해결 도우미 |
| `/navigate` | 코드베이스 탐색 |
| `/core-update` | 코어 업데이트 수신 + 충돌 해결 |
| `/migration-test` | 마이그레이션 시뮬레이션 |
| `/safety-check` | 파일 보호 규칙 동기화 검증 |
| `/audit` | 감사 리포트 생성 |
| `/improvement` | 개선 사항 추적 |

### 확장

| Skill | Purpose |
|-------|---------|
| `/plugin` | 플러그인 관리 |
| `/survey-tool` | 검사도구 관리 |
| `/dev-plugin` | 플러그인 개발 파트너 |
| `/dev-skin` | 스킨 개발 파트너 |
| `/dev-survey` | 검사도구 개발 파트너 |

### 페이즈별 스킬 가이드

**셋업 (설치 직후):**
`/infra-check` → `/safety-check` → `/core-update` (필요 시)

**온보딩 Tier 1 (배포 필수):**
`/setup-clinic-info` (이름, 주소, 전화, 진료시간) → `/setup-skin` (테마)

**온보딩 Tier 2 (핵심 콘텐츠):**
`/extract-content` → `/collect-references` → `/analyze-content` → `/discover-edge` → `/plan-content` → `/write-copy` → `/setup-programs` → `/setup-homepage`
이미지: `/curate-images` → `/enhance-portrait` → `/generate-scenes`
정리: `/cleanup-samples`

**온보딩 Tier 3 (환자 연결):**
`/setup-intake` (문진표/예약) → `/setup-notifications` (알림) → `/write-blog` → `/faq-generate`

**온보딩 Tier 4 (마케팅):**
`/campaign-draft` → `/optimize-aeo` → `/review-compliance` → `/review-curate`

**온보딩 Tier 5+ (운영):**
`/clinic-advisor` → `/business-report` → `/patient-cohort` → `/patient-remind`

**항상 사용 가능:**
`/help` `/status` `/navigate` `/troubleshoot` `/handoff`

---

## 2. Skill Standard Format

Every skill in `.claude/commands/` follows this structure:

```markdown
# /skill-name — Short Description

Brief explanation of what this skill does and when to use it.

## Data Sources

List the API endpoints this skill reads from:
- `GET /api/endpoint` — what data it provides
- `POST /api/endpoint` — what action it performs

## Procedure

### Step 1: Gather data
(bash commands or API calls)

### Step 2: Process
(analysis, generation, transformation)

### Step 3: Output
(what to present to the user)

### Step 4: Action (if applicable)
(API calls to write data — ALWAYS confirm with user first)

## Output Format

Describe the expected output structure.

## Safety

- Read operations: execute freely
- Write operations: confirm with clinic owner before executing
- Never overwrite existing content without explicit approval
```

---

## 3. Data Connector Map

The local agent accesses clinic data through API endpoints. The dev server must be running (`npm run dev` → localhost:4321) or use the production URL.

### Database Policy

데이터베이스 스키마와 초기 데이터는 분리 관리됩니다:

- **`migrations/`** = DDL만 (CREATE, ALTER, INDEX). core:pull 시 자동 적용.
- **`seeds/`** = DML만 (INSERT OR IGNORE/REPLACE). 멱등 패턴 필수.
- **`d1_seeds`** 테이블이 적용된 시드를 추적 → core:pull 시 미적용 시드만 실행.

새 기능 개발 시:
1. 새 테이블/컬럼 → `migrations/` 에 DDL
2. 필수 기본 데이터 → `seeds/` 에 INSERT OR IGNORE
3. core:pull 받는 클라이언트 → DDL 자동 적용 + 새 시드만 실행 + 기존 데이터 보호

### Core Data APIs

| API Group | Endpoint Pattern | Data | Use Case |
|-----------|-----------------|------|----------|
| **Patients** | `/api/patients` | Patient records, history, tags | Cohort analysis, reminders, CRM |
| **Reservations** | `/api/reservations` | Bookings, schedule | Scheduling insights, reminders |
| **Posts** | `/api/posts` | Blog posts, reviews, notices | Content generation, curation |
| **Analytics** | `/api/analytics` | Traffic, page views, behavior | Traffic analysis, reporting |
| **Doctors** | `/api/doctors` | Staff profiles, specialties | Content personalization |
| **Programs** | `/api/programs` | Treatment programs | Content, marketing |
| **Events** | `/api/events` | Clinic events, promotions | Marketing, notifications |
| **FAQ** | `/api/faq` | Frequently asked questions | Content generation |
| **Knowledge** | `/api/knowledge` | Knowledge base articles | Authority content |
| **Leads** | `/api/leads` | Prospect/lead records | CRM, campaigns |
| **Settings** | `/api/settings.ts` | Clinic configuration | Context for all skills |
| **Clinic Info** | `/api/clinic-info.ts` | Basic clinic info (name, hours, address) | Universal context |
| **Services** | `/api/services.ts` | Service catalog | Content, pricing |
| **Contacts** | `/api/contacts` | Contact records | Communication |
| **Intake** | `/api/intake`, `/api/intakes` | Patient intake forms | Patient experience |
| **Self-diagnosis** | `/api/self-diagnosis` | Assessment tools | Patient engagement |
| **Payments** | `/api/payments` | Payment records | Business reporting |
| **Inventory** | `/api/inventory` | Product inventory | Operations |
| **VIP** | `/api/vip-management` | VIP tier management | CRM |
| **Admin** | `/api/admin/*` | Admin operations | System management |
| **Media** | `/api/media`, `/api/files` | Uploaded files, images | Content management |
| **Surveys** | `/api/surveys`, `/api/survey-tools` | Survey data | Patient engagement |
| **Pages** | `/api/pages` | Dynamic page content | Content management |
| **Content** | `/api/content` | Content collections | Multi-format content |
| **Auth** | `/api/auth` | Authentication | Session management |

### API Access Pattern

Two access methods — use the right one for the situation:

| Method | When to use | Requires |
|--------|------------|----------|
| `curl localhost:4321/api/*` | Dev server running (`npm run dev`) | Dev server up |
| `npx wrangler d1 execute DB --local` | Direct DB query, no server needed | wrangler.toml |

```bash
# Method 1: Via dev server (preferred — includes auth, middleware, validation)
curl -s http://localhost:4321/api/patients | head -c 500

# Method 2: Direct D1 query (when dev server is not running)
npx wrangler d1 execute DB --local --command "SELECT * FROM patients LIMIT 5"

# Write data (POST) — ALWAYS confirm with user first
curl -s -X POST http://localhost:4321/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "...", "content": "..."}'
```

> `DB` is the binding name from wrangler.toml. Works for all client installations.

---

## 4. Skill Management Lifecycle

```
Identify need
  → Community feedback, clinic request, or pattern observation
    → Design skill spec (purpose, data sources, steps, output, safety)
      → Implement in .claude/commands/skill-name.md
        → Test on master repo (dev data)
          → Deploy via core:push (all clients receive)
            → Monitor: does it work? is it used? feedback?
              → Iterate or deprecate
```

### Who Creates Skills

- **Meta agent (master)**: Designs, implements, verifies, deploys
- **Local agent (client)**: Uses skills, reports issues, suggests improvements
- **Community**: Requests features, shares usage patterns

### Skill Versioning

Skills are versioned through core:push tags. No separate skill version number — they evolve with the system version. If a skill needs a breaking change, add a migration note in the skill's markdown.

### Skill Deprecation

Replace the skill content with a notice pointing to the replacement. Don't delete — clients may have documentation referencing the old name.

---

## 5. Onboarding → 콘텐츠 파이프라인 → 운영

### Phase 1: 온보딩 (시스템 구성)

`.agent/onboarding-registry.json` (33 피처, 5 티어)를 따릅니다.
- Tier 1: 배포 필수 (도메인, DB, 기본 정보)
- Tier 2: 핵심 콘텐츠 (블로그 추출, 프로그램 설정)
- Tier 3: 환자 서비스 (예약, 문진, 알림)
- Tier 4: 마케팅 (캠페인, SEO)
- Tier 5: 고급 (분석, 자동화)

상태: `.agent/onboarding-state.json`

### Phase 2: 콘텐츠 파이프라인 (사이트 완성)

Tier 2 이후 콘텐츠 파이프라인을 실행합니다:
```
/extract-content → /collect-references → /analyze-content
  → /discover-edge → /plan-content → /write-copy
    → /setup-homepage → /setup-programs
```

각 단계의 산출물은 `.agent/*.yaml`에 저장되어 다음 단계의 입력이 됩니다.
데이터가 부족하면 사용자에게 보충을 요청합니다 (충분성 게이트).

상세: `.agent/workflows/content-bootstrap.md`

### Phase 3: 운영 (데이터 축적 → 스킬 활용)

데이터가 쌓이면서 스킬이 유용해집니다:
- `/write-blog` — 라이터 페르소나 기반 블로그 작성
- `/business-report` — 월간 경영 리포트
- `/patient-cohort` — 환자 세그멘테이션
- `/clinic-advisor` — 데이터 기반 경영 조언

---

## 6. Current State

| Component | Count | Status |
|-----------|-------|--------|
| Available skills (local+universal) | 45 | ✅ Full pipeline coverage |
| API route groups | 52 | ✅ Full coverage |
| Onboarding features | 33 | ✅ 5 tiers |
| Agent workflows | 22 | ✅ Setup/onboarding/content/troubleshooting |
| Pipeline artifacts | 6 | ✅ style-card → edge-profile → site-plan |
