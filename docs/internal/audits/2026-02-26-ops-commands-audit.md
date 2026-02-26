---
date: 2026-02-26
auditor: claude-opus-4-6
scope: 운영커맨드, 배포체계, PII잔존, 보호규칙동기화
status: completed
---

# Clinic-OS 운영 커맨드 & 배포 체계 감사 (2026-02-26)

## 요약

운영 커맨드 12개 신규 생성 및 배포 체계 통합 작업 후 감사를 수행했습니다.
배포 파이프라인 SoT 통합은 완료되었으나, PII 잔존 항목과 보호 규칙 동기화 누락이 발견되었습니다.

## 발견사항

### CRITICAL

| ID | 항목 | 상태 |
|----|------|------|
| C1 | fetch.js fallback CORE_PATHS에 `.claude/commands/`, `.claude/rules/` 누락 — manifest 로드 실패 시 커맨드 파일이 core:pull 보호 대상에서 빠짐 | 미해결 |
| C2 | `clinic-os-safety.md` 재생성 필요 — protection-manifest.yaml에 `.claude/` 추가했으나 safety rules 문서 미반영 | 미해결 |

### HIGH

| ID | 항목 | 상태 |
|----|------|------|
| H1 | `BRD Clinic` 하드코딩 잔존 (8건) — 코어 파일이라 클라이언트에 배포됨 | 미해결 |
| H2 | `admin@brd.clinic` 이메일 잔존 (3건) — 디버그 스크립트 + 로그인 placeholder | 미해결 |
| H3 | `src/moai_adk/` Python 패키지 잔존 — MoAI 브랜딩, src/ 코어 경로에 포함 | 미해결 |

### MEDIUM

| ID | 항목 | 상태 |
|----|------|------|
| M1 | `public/content-api-docs.md`에 `brd-clinic.pages.dev` URL 하드코딩 (3건) | 미해결 |
| M2 | `brd_` prefix localStorage 키 (`brd_locale`, `brd_session_id` 등) — 기능 코드에 깊이 사용됨 | 참고 |
| M3 | `brd-chat-*` CSS 클래스명 — chat-widget.js 전체에 BRD 접두사 (100+건) | 참고 |

### LOW

| ID | 항목 | 상태 |
|----|------|------|
| L1 | `docs/internal/` 내 `yeonseung-choe.workers.dev` URL (3건) — local_prefixes라 클라이언트 미배포 | 참고 |

## 보호 규칙 동기화 분석

### protection-manifest.yaml ↔ fetch.js fallback

| 경로 | manifest | fetch.js fallback | 상태 |
|------|----------|-------------------|------|
| `.claude/commands/` | ✅ 있음 | ❌ 없음 | **불일치 (C1)** |
| `.claude/rules/` | ✅ 있음 | ❌ 없음 | **불일치 (C1)** |
| `.agent/onboarding-registry.json` | ✅ | ✅ | 일치 |
| `.agent/workflows/` | ✅ | ✅ | 일치 |
| 나머지 core_paths | ✅ | ✅ | 일치 |

### mirror-core.js CORE_FILES ↔ shared-file-lists.js

| 항목 | mirror-core.js | shared-file-lists.js | 상태 |
|------|---------------|---------------------|------|
| CLIENT_COMMANDS (7개) | `...CLIENT_COMMANDS` | ✅ 정의됨 | 일치 |
| CLIENT_RULES (2개) | `...CLIENT_RULES` | ✅ 정의됨 | 일치 |
| mirror-starter.js | `...CLIENT_COMMANDS, ...CLIENT_RULES` | 동일 import | 일치 |

### clinic-os-safety.md ↔ manifest

안전 규칙 문서가 마지막으로 생성된 시점 이후 manifest에 `.claude/commands/`, `.claude/rules/`가 추가되었으나, `generate-protection-docs.js`가 아직 재실행되지 않아 문서에 미반영 상태.

## PII 잔존 상세

### BRD Clinic 하드코딩 (H1)

| 파일 | 라인 | 내용 | 위험 |
|------|------|------|------|
| `src/pages/admin/campaigns/index.astro` | 705 | `"BRD Clinic"` 텍스트 | 클라이언트 배포됨 |
| `src/pages/admin/campaigns/index.astro` | 897 | `'BRD 클리닉'` fallback | 클라이언트 배포됨 |
| `src/pages/admin/campaigns/index.astro` | 899 | `'BRD 클리닉'` alias | 클라이언트 배포됨 |
| `src/scripts/analytics.ts` | 2 | `BRD Clinic Analytics` 주석 | 클라이언트 배포됨 |
| `src/components/layout/BaseLayout.astro` | 355 | `BRD Clinic Analytics` 주석 | 클라이언트 배포됨 |
| `src/pages/api/test/sms.ts` | 17 | `'Test Message from BRD Clinic'` | 클라이언트 배포됨 |

### admin@brd.clinic 이메일 (H2)

| 파일 | 라인 | 내용 |
|------|------|------|
| `src/scripts/debug/create-super-admin.ts` | 15 | `'admin@brd.clinic'` |
| `src/scripts/debug/super-admin.ts` | 13 | `'admin@brd.clinic'` |
| `src/pages/admin/login.astro` | 50 | `placeholder="admin@brd.clinic"` |

### MoAI 패키지 (H3)

`src/moai_adk/` — Python 패키지가 `src/` 코어 경로에 존재.
Astro/JS 프로젝트에서 사용되지 않는 것으로 보이며, MoAI 브랜딩이 전체에 포함됨.

## 이번 세션 작업 검증

### 신규 커맨드 파일 (12개)

| 커맨드 | 용도 | 배포 대상 | 파일 존재 |
|--------|------|----------|----------|
| `/release` | 릴리즈 파이프라인 | 마스터 전용 | ✅ |
| `/hq-admin` | HQ D1 관리 | 마스터 전용 | ✅ |
| `/client-debug` | 클라이언트 진단 | 마스터 전용 | ✅ |
| `/guide-sync` | 가이드 파이프라인 | 마스터 전용 | ✅ |
| `/changelog` | 릴리즈 노트 | 마스터 전용 | ✅ |
| `/onboarding` | 온보딩 + 가드레일 | 클라이언트 배포 | ✅ |
| `/status` | 시스템 상태 | 클라이언트 배포 | ✅ |
| `/infra-check` | 인프라 점검 | 클라이언트 배포 | ✅ |
| `/migration-test` | core:pull 시뮬 | 클라이언트 배포 | ✅ |
| `/safety-check` | 보호 규칙 점검 | 클라이언트 배포 | ✅ |
| `/audit` | 감사 보고서 | 클라이언트 배포 | ✅ |
| `/improvement` | 개선 안내 | 클라이언트 배포 | ✅ |

### 신규 스크립트 (2개)

| 파일 | 상태 | git 추적 |
|------|------|---------|
| `scripts/release-conductor.sh` | ✅ 동작 확인 | ❌ untracked |
| `scripts/release-validate.sh` | ✅ 동작 확인 | ❌ untracked |

### SoT 배포 체계

| SoT 파일 | 변경 | 상태 |
|----------|------|------|
| `shared-file-lists.js` | CLIENT_COMMANDS, CLIENT_RULES 추가 | ✅ |
| `mirror-core.js` | import + spread 적용 | ✅ |
| `mirror-starter.js` | import + spread 적용 | ✅ |
| `protection-manifest.yaml` | `.claude/commands/`, `.claude/rules/` 추가 | ✅ |

## 권고사항

### 즉시 조치 (이번 세션)

1. **C1**: fetch.js fallback에 `.claude/commands/`, `.claude/rules/` 추가
2. **C2**: `node scripts/generate-protection-docs.js` 실행하여 safety rules 재생성

### 단기 조치 (다음 릴리즈 전)

3. **H1**: `BRD Clinic` → `Sample Clinic` / `CLINIC_SETTINGS.name` fallback으로 교체
4. **H2**: `admin@brd.clinic` → `admin@example.com` 으로 교체
5. **H3**: `src/moai_adk/` 디렉토리 용도 확인 → 불필요하면 제거

### 중기 조치

6. **M1**: `public/content-api-docs.md`의 하드코딩 URL → 플레이스홀더로 교체
7. **M2/M3**: `brd_` prefix는 기능 코드에 깊이 사용되어 일괄 교체 시 리스크 높음 — 다음 메이저 버전에서 리브랜딩 검토

## 참조

- 이전 감사: [2026-02-26 구조 감사](./2026-02-26-structure-audit.md)
- 이전 감사: [2026-02-26 건강진단/배포 감사](./2026-02-26-health-deploy-publish-audit.md)
- 보호 체계 SoT: `.docking/protection-manifest.yaml`
- 배포 SoT: `scripts/shared-file-lists.js`
