---
date: 2026-02-27
auditor: Claude Opus 4.6 (자동 감사)
scope: DB 복구 로직, 보호 규칙 동기화, PII 잔존, 코드 브랜딩
status: completed
---

# 감사 보고서: DB 복구 로직 & 보호 규칙 동기화

## 감사 범위

1. `fetch.js` 고아 DB 복구 로직 검증
2. protection-manifest.yaml ↔ 문서 보호 목록 동기화
3. PII / 클라이언트 특정 브랜딩 잔존 스캔
4. 이전 감사 미완료 항목 확인

---

## 발견사항

### MEDIUM

| ID | 설명 | 상태 |
|----|------|------|
| M1 | GEMINI.md 코어 경로 목록에 5개 경로 누락: `src/content/aeo/`, `.agent/onboarding-registry.json`, `.agent/workflows/`, `.claude/commands/`, `.claude/rules/` | **해결됨** |
| M2 | GEMINI.md 보호 파일 목록에 `.agent/onboarding-state.json`, `src/plugins/local/` 누락 | **해결됨** |
| M3 | `brd_` 접두사 localStorage 키 잔존 — `chat.astro` (12건), `middleware.ts` (2건), `analytics.ts` (2건) | 참고 (기능적 — 변경 시 기존 클라이언트 데이터 유실) |
| M4 | `seeds/` 내 `Baekrokdam` / `백록담` 하드코딩 (6건) — 약관, 프로그램 설명, 매뉴얼 | 참고 (시드 데이터 — DB 설정으로 override 가능) |

### LOW

| ID | 설명 | 상태 |
|----|------|------|
| L1 | `src/pages/admin/db_fix_home*.sql` 내 `백록담` 하드코딩 (5건) — 일회성 DB 수정 스크립트 | 참고 |
| L2 | `legacy_seeds/` 내 `백록담한의원` 하드코딩 (5건) — deprecated 시드, 실사용 안 됨 | 참고 |
| L3 | `TermsViewer.astro:79` — `Baekrokdam Oriental Medicine Clinic` 정규식 — 동적 치환 로직으로 정상 | 참고 (의도적) |
| L4 | `docs/internal/SPEC-AGENT-COMM-001`에 `yeonseung-choe.workers.dev` 3건 — CF 계정 서브도메인 (정상 URL) | 참고 (이전 감사에서 확인됨) |

---

## 보호 규칙 동기화 상태

### SOT: `.docking/protection-manifest.yaml`

| 소비자 | 동기화 상태 |
|--------|------------|
| `fetch.js` fallback CORE_PATHS | ✅ 완전 일치 |
| `.claude/rules/clinic-os-safety.md` | ✅ 완전 일치 |
| `AGENTS.md` | ✅ 완전 일치 |
| `CLAUDE.md` | ✅ 완전 일치 |
| `GEMINI.md` | ✅ 동기화 완료 (이번 감사에서 수정) |

### GEMINI.md 누락 항목

코어 경로 (line 109-115):
- `src/content/aeo/`
- `.agent/onboarding-registry.json`
- `.agent/workflows/`
- `.claude/commands/`
- `.claude/rules/`

보호 파일 (line 127-131):
- `.agent/onboarding-state.json` (보호 목록에서 누락, 온보딩 섹션에는 언급됨)

---

## DB 복구 로직 검증 (`fetch.js`)

### 새로 추가된 함수 (v1.24.2)

| 함수 | 역할 | 검증 |
|------|------|------|
| `ensureLocalDb()` | 4가지 케이스 분기 (접근/고아복구/생성/안내) | ✅ 구문 정상 |
| `recoverOrphanedData()` | 활성 DB 비어있고 고아 DB에 데이터 있으면 복사 | ✅ 활성 DB 제외 로직 |
| `recoverExistingDb()` | wrangler 접근 불가하지만 .sqlite 존재 시 연결 | ✅ 크기 임계값 (1KB) |
| `findActiveDbFile()` | miniflare 해시 기반 파일명에서 최근 수정 파일 식별 | ✅ mtime 기반 |

### 안전성 평가

- ✅ 기존 데이터 삭제 없음 — 복사만 수행, 원본 보존
- ✅ 빈 DB 백업 생성 (`*.empty-backup`)
- ✅ WAL/SHM 파일 동반 복사
- ✅ 실패해도 core:pull 자체는 계속 진행 (try-catch)
- ✅ `execFileSync` 사용 (command injection 방지)
- ⚠️ 활성 DB 식별이 mtime 기반 — 대부분 정확하나 100% 보장은 아님

---

## 이전 감사 미완료 항목 확인

| 항목 | 상태 |
|------|------|
| 모든 이전 미완료 항목 (H1-H3, M1, C1, H1-H4, 구조 항목) | ✅ 전부 해결됨 |
| IMPROVEMENT-TRACKER.md 미완료 섹션 | ✅ 0건 (전부 `[x]`) |

---

## 요약

| 심각도 | 발견 수 | 해결 | 미해결 | 참고 |
|--------|---------|------|--------|------|
| CRITICAL | 0 | - | - | - |
| HIGH | 0 | - | - | - |
| MEDIUM | 4 | 2 | 0 | 2 |
| LOW | 4 | 0 | 0 | 4 |
| **합계** | **8** | **2** | **0** | **6** |

## 권고 사항

1. **M1+M2**: GEMINI.md 코어 경로/보호 파일 목록 업데이트 (매니페스트와 동기화)
2. **M3**: `brd_` localStorage 키는 기존 클라이언트 데이터 호환성 때문에 유지. 향후 마이그레이션 유틸리티와 함께 `cos_` 접두사로 일괄 변경 권고
3. **M4+L1+L2**: 시드/SQL 내 `백록담` 하드코딩은 `{{clinic_name}}` 플레이스홀더 기반으로 점진 교체 권고 (비긴급)
