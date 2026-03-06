---
date: 2026-02-26
auditor: claude-opus-4
scope: 구조, 보호체계, 문서, 개인정보, 배포
status: completed
---

# Clinic-OS 구조 감사 보고서 (2026-02-26)

## 요약

Clinic-OS 멀티테넌트 SaaS 레포에 대한 종합 감사를 수행했습니다.
보호 체계 문서화 불일치, 개인정보 잔존, 에이전트 가드레일 불균형을 발견하고
즉시 수정 가능한 항목부터 개선했습니다.

## 발견사항

### CRITICAL

| ID | 항목 | 상태 |
|----|------|------|
| C1 | `chat-widget.js:50` 주석에 실명(최연승) 잔존 | **해결됨** |
| C2 | `clinic-os-safety.md` ↔ `fetch.js` CORE_PATHS 절반만 커버 | **해결됨** |
| C3 | `GEMINI.md` 버전 v1.18.5 아웃데이트 + 보호 목록 불완전 | **해결됨** |
| C4 | `.claude/settings.json` 하드 가드레일 없음 (클라이언트 배포 시) | **해결됨** |
| C5 | `protection-manifest.yaml` SOT 부재 — 동일 규칙 5곳 분산 | 미해결 (향후) |
| C6 | HQ 가이드 일부 아웃데이트 | 미해결 (향후) |
| C7 | `docs/` 일부 명령어 참조 부정확 (`db:push` 등) | 미해결 (향후) |

### HIGH

| ID | 항목 | 상태 |
|----|------|------|
| H1 | 소스코드 내 실명 잔존 (DoctorIntro, topics, telemedicine) | **해결됨** (이전 세션) |
| H2 | 시드 데이터 실명 잔존 | **해결됨** (이전 세션) |
| H3 | BRD Clinic 브랜딩 잔존 | **해결됨** (이전 세션) |

### MEDIUM

| ID | 항목 | 상태 |
|----|------|------|
| M1 | 잔여 개인정보 파일 (업로드 이미지, favicon 등) | **해결됨** (이전 세션) |
| M2 | `CLAUDE.md` MoAI 참조 → 프로젝트 컨텍스트로 재구성 | **해결됨** (이전 세션) |
| M3 | 감사 체계 부재 — 기록/추적 프로세스 없음 | **해결됨** |

### LOW

| ID | 항목 | 상태 |
|----|------|------|
| L1 | `analytics.js` 설정 정리 필요 | 미해결 (비필수) |
| L2 | Codex용 가드레일 파일 부재 | 미해결 (향후) |

## fetch.js 보호 체계 분석

### CORE_PATHS (코어 → 덮어쓰기)
```
src/pages/          src/components/     src/layouts/
src/styles/         src/lib/            src/plugins/custom-homepage/
src/plugins/survey-tools/               src/survey-tools/stress-check/
migrations/         seeds/              docs/
scripts/            .docking/engine/    package.json
astro.config.mjs    tsconfig.json
```

### LOCAL_PREFIXES (절대 건드리지 않음)
```
src/lib/local/      src/plugins/local/  src/pages/_local/
src/survey-tools/local/                 public/local/
```

### PROTECTED_EXACT (양쪽 존재, 클라이언트 보호)
```
wrangler.toml       clinic.json         .docking/config.yaml
src/config.ts       src/styles/global.css
```

### PROTECTED_PREFIXES
```
.env                .core/              src/plugins/local/
```

## 권고사항

1. **단기 (이번 감사에서 해결)**: C1~C4 즉시 수정
2. **중기**: `protection-manifest.yaml` SOT 설계 → 모든 에이전트/문서가 단일 소스 참조
3. **장기**: `safety:check` CI 스크립트로 자동화하여 drift 방지

## 참조

- 개선 트래커: [IMPROVEMENT-TRACKER.md](./IMPROVEMENT-TRACKER.md)
- 보호 체계 소스: `.docking/engine/fetch.js` (L134-L182)
- Claude 안전 규칙: `.claude/rules/clinic-os-safety.md`
- Gemini 가이드: `GEMINI.md`
