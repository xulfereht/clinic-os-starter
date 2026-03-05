---
date: 2026-02-27
auditor: Claude Code (Opus 4.6)
scope: First Contact 프로토콜 구현, 에이전트 지시 파일 배포, 보호 규칙 동기화, PII 잔존
status: resolved
---

# First Contact 프로토콜 & 보호 규칙 감사

## 배경

"First Contact" 프로토콜 구현 — cos-setup.sh 실행 직후 에이전트가 자동으로 온보딩 진입하도록 6종 에이전트 지시 파일 + 상태 머신 워크플로우 추가.

## 변경 파일

| 파일 | 변경 |
|------|------|
| `scripts/mirror-starter.js` | agentGuide 축소 + .cursorrules/.windsurfrules/.clinerules 추가 |
| `.agent/workflows/first-contact.md` | 신규 — Phase 0~4 상태 머신 |
| `hq/public/cos-setup.sh` | print_complete() 에이전트 안내로 교체 |
| `scripts/mirror-core.js` | CORE_FILES에 에이전트 파일 3종 추가 + GEMINI.md first-contact 참조 |
| `.docking/protection-manifest.yaml` | core_paths에 .cursorrules 등 추가 |
| `.agent/README.md` | 6종 에이전트 진입점 + first-contact 네비게이션 |
| `scripts/generate-protection-docs.js` | AGENTS.md에 first-contact 네비게이션 |
| `.cursorrules` / `.windsurfrules` / `.clinerules` | 신규 — 자동 감지 프로토콜 |
| `CLAUDE.md` / `GEMINI.md` | 마스터 레포 네비게이션에 first-contact 참조 |
| `.docking/engine/fetch.js` | 하드코딩 폴백에 에이전트 파일 3종 추가 |

## 발견사항

### CRITICAL (0건)

없음 (발견 즉시 수정 완료)

### HIGH (1건 — 수정 완료)

| ID | 항목 | 상태 |
|----|------|------|
| H1 | fetch.js 하드코딩 폴백에 `.cursorrules`/`.windsurfrules`/`.clinerules` 누락 — 매니페스트 로드 실패 시 보호 불가 | **해결됨** |

### MEDIUM (2건 — 수정 완료)

| ID | 항목 | 상태 |
|----|------|------|
| M1 | GEMINI.md (마스터 정적본) 코어 단일 파일 목록에 에이전트 파일 3종 누락 | **해결됨** |
| M2 | `src/plugins/local/` 이 manifest에서 local_prefixes와 protected_prefixes 양쪽에 중복 등재 (기존 이슈, 기능상 무해) | 참고 |

### LOW (2건)

| ID | 항목 | 상태 |
|----|------|------|
| L1 | GEMINI.md (동적 생성본) `corePathsForbidList`에 디렉토리만 표시 — 단일 파일은 별도 참조 필요 | 참고 (현재 구조 의도) |
| L2 | `docs/internal/` 가 GEMINI.md local 폴더 테이블에 누락 (기존 이슈) | 참고 |

## PII 스캔 결과

| 패턴 | 활성 코드 | 아카이브 | 감사 기록 |
|------|----------|---------|----------|
| `최연승` | 0건 | 3건 | 1건 |
| `김지혜` | 0건 | 0건 | 0건 |
| `BRD` | 0건 | 8건 | 8건 |
| `yeonseung` | 15건 (CF 서브도메인 — 정상) | 0건 | 2건 |
| `moai` | 7건 (기술 명칭 — 정상) | 0건 | 2건 |

**결론**: 활성 소스코드에 PII 없음. 아카이브/감사 기록은 이력 보존.

## 보호 규칙 동기화 상태

| 소스 | .cursorrules 등 포함 | 상태 |
|------|---------------------|------|
| `protection-manifest.yaml` (SOT) | core_paths | OK |
| `fetch.js` 매니페스트 로드 | 자동 반영 | OK |
| `fetch.js` 하드코딩 폴백 | 추가됨 | **수정 완료** |
| `clinic-os-safety.md` | 재생성됨 | OK |
| `AGENTS.md` | 재생성됨 | OK |
| `GEMINI.md` (마스터) | 추가됨 | **수정 완료** |
| `GEMINI.md` (동적 생성) | 매니페스트 기반 자동 | OK |

## 이전 감사 대비

- 이전 미완료 항목: 0건
- 신규 발견: 3건 (H1, M1 수정 완료 / M2 기존 이슈)
- 현재 미해결: 0건
