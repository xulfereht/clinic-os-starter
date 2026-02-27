---
date: 2026-02-27
auditor: claude-opus-4
scope: AEO 내부링크, AI 챗봇 폴백, 코어 배포 무결성, PII 잔존
status: resolved
---

# 감사 보고서: AEO 내부링크 & AI 챗봇 배포 안전성 (2026-02-27)

## 배경

기존 클라이언트가 새 버전 업데이트 시 `internal-link-map.json` import 에러 발생.
AEO 기능 추가 시 `src/content/aeo/`가 `core_paths`에 누락된 것이 원인.
이를 계기로 전체 코어 배포 무결성, AI 챗봇 연결, PII 잔존을 종합 점검.

## 발견 사항

### CRITICAL — 1건 (해결)

| ID | 항목 | 해결 |
|----|------|------|
| C1 | `src/scripts/debug/create-placeholder-member.ts:17`에 `@brd.clinic` 이메일 잔존 | `@clinic.local`로 교체 |

> **취소**: `scripts/cos-ask`의 `yeonseung-choe.workers.dev`는 실제 Cloudflare 계정 서브도메인 (정상 URL). 오탐으로 원복 완료.

### HIGH — 4건 (모두 해결)

| ID | 항목 | 해결 |
|----|------|------|
| H1 | `src/content/aeo/`가 `core_paths`에 누락 → 클라이언트 빌드 실패 | protection-manifest.yaml + fetch.js fallback에 추가 |
| H2 | `InternalLinkingModule`의 "Talk to AI" 버튼이 `/ai-chat` 하드링크 → 미설정 클라이언트 404 | feature flag (`ai_chat_enabled`) 조건부 렌더링 |
| H3 | `scripts/release-validate.sh:136`에 `brd-clinic-v2` 하드코딩 | 환경변수 `$PAGES_PROJECT_NAME`으로 교체 |
| H4 | `CLAUDE.md` 코어 경로 목록에 `src/content/aeo/` 누락 | 추가 |

### MEDIUM — 4건 (참고/향후 과제)

| ID | 항목 | 상태 |
|----|------|------|
| M1 | `brd_` prefix localStorage/쿠키 키 17건 (chat.astro, middleware.ts, analytics.ts) | 기존 M2 — 클라이언트 로컬 데이터, 기능 영향 없음 |
| M2 | `brd-chat-*` CSS 클래스 100건 (public/chat-widget.js) | 기존 M3 — 리네이밍 시 백록담 호환성 문제 |
| M3 | `docs/internal/project_architecture.md`에 `brd-clinic` 참조 3건 | docs/internal/ 미배포 |
| M4 | `docs/internal/RELEASE_WORKFLOW.md`에 `brd-clinic` 참조 | docs/internal/ 미배포 |

### LOW — 2건 (참고)

| ID | 항목 | 상태 |
|----|------|------|
| L1 | `docs/internal/SPEC-AGENT-COMM-001`에 `yeonseung-choe.workers.dev` 3건 | 실제 CF 계정 서브도메인, 정상 |
| L2 | `.moai/` 디렉토리 보호 목록 미정의 (core:pull에서 무시됨) | 실질 영향 없음 |

## 구조적 개선 (이번 감사에서 신규 구축)

| 항목 | 설명 |
|------|------|
| `scripts/check-core-imports.js` | 코어 파일의 비코어 경로 import 자동 감지 |
| `deploy-guard.js` 연동 | 배포 전 코어 import 무결성 검사 (blocker) |
| `mirror-core.js` 연동 | core:push 전 차단 게이트 |
| `fetch.js` 스타터킷 차단 | `minStarterVersion` 미달 시 core:pull 차단 (기존: 경고만) |
| 코어 폴백 `/ai-chat` | AI 챗봇 미설정 클라이언트용 안내 페이지 |
| `InternalLinkingModule` feature flag | `ai_chat_enabled` 기반 조건부 버튼 렌더링 |
| `aeo.ts` 조건부 manifest | AI 엔트리포인트를 설정에 따라 포함/제외 |

## 보호 체계 동기화 결과

| 소스 | CORE_PATHS | LOCAL | PROTECTED | 상태 |
|------|:---:|:---:|:---:|------|
| protection-manifest.yaml | 21 | 6 | 6+3 | SOT |
| fetch.js fallback | 21 | 6 | 6+3 | **동기화됨** |
| clinic-os-safety.md | 21 | 6 | 6+3 | **동기화됨** (자동생성) |
| CLAUDE.md (약식) | 6 | 3 | 3 | **동기화됨** (`src/content/aeo/` 추가) |

## 이전 감사 대비

| 항목 | 이전 (02-26) | 현재 (02-27) |
|------|-------------|-------------|
| CRITICAL 미해결 | 0 | 0 (1건 발견 즉시 해결, 1건 오탐 원복) |
| HIGH 미해결 | 0 | 0 (4건 발견 즉시 해결) |
| 코어 import 가드레일 | 없음 | **구축 완료** |
| 스타터킷 버전 차단 | 경고만 | **차단으로 강화** |
| AI 챗봇 폴백 | 없음 | **코어 제공** |
