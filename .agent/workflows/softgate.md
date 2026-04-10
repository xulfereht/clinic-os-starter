---
description: Softgate guardrails — protect local work (code, data, assets) before onboarding
category: dev
---

# Softgate Guardrails

Protect client's local work before onboarding starts. Gates are **soft** — strongly recommended, never blocking. User can defer; agent re-reminds every 3 sessions.

## Gate Flow

```
setup:step complete → Gate 0 (Clinic Profile) → Gate 1 (GitHub)
  → Gate 2 (D1 Backup) → Gate 3 (R2/Cloudflare) → Onboarding (Tier 1-5)
  → [Gate M: Device Migration — on demand]
```

## Gate 0: Clinic Profiling

**Purpose**: Gather clinic context for all downstream operations.
**Output**: `.agent/clinic-profile.json` (local, core:pull protected)
**Trigger**: After setup, before onboarding

1. Ask for Naver Place URL / existing website URL / KakaoMap URL / manual entry
2. If URL provided → WebFetch + extract: name, address, phone, hours, services, staff, photos
3. Present extracted data → user confirms/corrects → save to clinic-profile.json
4. If existing website → analyze design tone, propose color/font migration, offer blog import

**clinic-profile.json structure**:
```json
{
  "source": { "type": "naver_place|website|manual", "url": "...", "scraped_at": "..." },
  "clinic": { "name_ko", "name_en", "tagline", "representative", "business_number" },
  "contact": { "phone", "address", "email", "kakao_channel" },
  "hours": { "weekdays", "saturday", "lunch", "closed" },
  "services": [{ "name", "keywords" }],
  "staff": [{ "name", "title", "specialties" }],
  "branding": { "primary_color", "existing_logo_url", "tone" },
  "migration": { "has_existing_site", "existing_url", "migrate_blog", "migrate_images" }
}
```

**Profile → Onboarding auto-fill**: clinic-info, contact, hours, branding, staff, programs, SEO, terms.

## Gate 1: Code Safety (GitHub)

**Check**: `git remote -v` → origin points to github.com?
**If missing**: Guide through GitHub repo creation → `git remote add origin` → initial commit → push.
**If deferred**: Warn about data loss risk. Record `github_reminded_at` in softgate-state.json.

**Auto-commit guardrail** (after GitHub connected):
| Timing | Pattern |
|--------|---------|
| Feature complete | `feat: {feature} 온보딩 완료` |
| Before deploy | `release: 배포 준비 — Tier {N}` |
| Session end | `wip: 작업 중 저장` |

## Gate 2: Data Safety (D1)

**3-layer protection**:
1. Local auto-backup: `~/.clinic-os-backups/{project}/` (5 rotation) via `npm run db:backup`
2. SQL dump → Git: `.backups/d1-snapshot-latest.sql` via `wrangler d1 export --local`
3. Production D1 on Cloudflare (auto-managed)

**Rules**: `npm run db:backup` before any DROP/DELETE/ALTER. DB snapshot before deploy. Remind if >7 days since last backup.

## Gate 3: Asset Safety (R2/Cloudflare)

**CF-First (v1.29+)**: setup-step.js `cf-login` phase auto-completes D1 + R2 creation.
**Check**: wrangler.toml has R2 binding + non-placeholder database_id.
**If missing**: `npx wrangler login` → auto-create D1 + R2 bucket.
**Ref**: [Cloudflare Setup Guide](https://clinic-os-hq.pages.dev/guide/cloudflare-setup)

## Gate M: Device Migration

**Prerequisite**: Gate 1 (GitHub) complete.
**Flow on new device**:
```bash
git clone https://github.com/user/clinic-os-repo.git && cd clinic-os-repo
npm install
npx wrangler login         # Same Cloudflare account
npm run setup:step          # Detects existing clinic.json, minimal steps
# Local DB (optional): wrangler d1 execute DB --local --file .backups/d1-snapshot-latest.sql
npm run dev
```

## Gate Check Timing

| Trigger | Gates Checked |
|---------|--------------|
| First conversation | Gate 0 (clinic-profile.json exists?) |
| Before code edit | Gate 1 (GitHub remote?) |
| Before DB change | Gate 2 (recent backup?) |
| Before image upload | Gate 3 (R2 configured?) |
| Before deploy | All gates |
| Session start | Incomplete gates (every 3 sessions) |

## State File

`.agent/softgate-state.json`:
```json
{
  "github": { "connected", "remote_url", "connected_at", "auto_commit", "last_push_at" },
  "d1_backup": { "enabled", "last_backup_at", "backup_count" },
  "r2": { "configured", "bucket_name" },
  "reminders": { "github_reminded_at", "backup_reminded_at" }
}
```

## Agent Behavior

**DO**: Profile first (URL = fastest). Auto-backup before destructive ops. Keep migration path (GitHub + Cloudflare = restore anywhere).
**DON'T**: Use git jargon ("커밋/푸시" → "저장/백업"). Force all gates at once. Re-ask in same session after deferral.

## Messages (ko)

### Gate 0: 첫 인사
```
안녕하세요! 한의원 홈페이지를 만들어 드리겠습니다.
먼저 한의원에 대해 알려주세요.

가장 빠른 방법 — 아래 중 하나를 알려주시면 기본 정보를 자동으로 가져옵니다:
1. 기존 홈페이지 URL
2. 네이버 플레이스 URL (또는 검색명)
3. 카카오맵 URL
4. 없으면 직접 입력해도 됩니다
```

### Gate 0: 프로파일 확인
```
다음 정보를 찾았습니다:

🏥 {clinic_name}
📍 {address}
📞 {phone}
🕐 {hours}
👨‍⚕️ 의료진: {staff}
💊 진료: {services}

맞나요? 수정할 부분이 있으면 알려주세요.
```

### Gate 1: GitHub 안내
```
작업을 시작하기 전에 코드 백업을 설정합니다.
GitHub 계정이 있으신가요?
[A] 있어요 → 바로 연결
[B] 없어요 → 가입 안내
[C] 나중에 할게요
```

### Gate 1: GitHub 미연결 경고
```
⚠️ GitHub 없이도 작업할 수 있지만:
- 컴퓨터 고장 시 모든 작업을 잃습니다
- 다른 컴퓨터로 옮길 수 없습니다
- 실수로 파일을 지워도 복구할 수 없습니다

나중에 꼭 연결하시는 걸 권장합니다.
```

### Gate 2: 백업 리마인더
```
💾 로컬 백업은 있지만, 컴퓨터 문제 시 데이터가 사라질 수 있습니다.
GitHub에 연결하면 DB 스냅샷도 함께 백업됩니다.
지금 연결할까요?
```

### Gate 3: Cloudflare 안내
```
이미지를 업로드하려면 Cloudflare 스토리지(R2) 설정이 필요합니다.
Cloudflare 계정이 있으신가요?
[A] 있어요 → 바로 연결
[B] 없어요 → 셋업 가이드 안내
[C] 나중에 → 로컬 저장만 (유실 위험)
```

### Gate M: 디바이스 이전
```
기존 작업을 새 컴퓨터로 옮기는 방법을 안내합니다.

# 1. 코드 가져오기
git clone {repo_url}
cd {project_name} && npm install

# 2. Cloudflare 연결
npx wrangler login

# 3. 설정 확인 + 시작
npm run setup:step && npm run dev

프로덕션 데이터는 이미 Cloudflare에 있어서 별도 작업이 필요 없습니다.
```

### 게이트 완료
```
모든 안전장치가 완료되었습니다!

✅ 클리닉 프로파일 저장
✅ GitHub 코드 백업 연결
✅ Cloudflare DB/스토리지 설정
✅ 초기 DB 백업 완료

이제 홈페이지를 본격적으로 만들어볼까요?
```
