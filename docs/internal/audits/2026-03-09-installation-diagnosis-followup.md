---
date: 2026-03-09
auditor: codex
scope: installation-diagnosis-followup
status: resolved
---

# Installation Diagnosis Follow-up (2026-03-09)

## 결론

- `fetch.js` 폴백 보호 경로 누락은 실제 버그였고 수정 완료
- `clinic-os-support-agent.yeonseung-choe.workers.dev` 지적은 오탐으로 정리
- 향후 에이전트가 같은 support-agent hostname을 근거 없이 HQ 이슈로 올리지 않도록 문서와 doctor/report JSON에 근거를 추가

## 반영 사항

### 1. fetch.js 폴백 보호 경로 수정

- `.docking/engine/fetch.js`
  - `CORE_PATHS` fallback에 `src/skins/` 추가
  - `LOCAL_PREFIXES` fallback에 `src/skins/local/` 추가
- 회귀 테스트:
  - `tests/safety-check.test.ts`

### 2. support-agent hostname 오탐 방지

- `scripts/lib/issue-reporting.js`
  - 공식 support endpoint host allowlist 추가
  - `summarizeIssueReporting()` / `reportIssueToSupport()` 결과에 `support_url_meta` 추가
- `scripts/agent-doctor.js`
  - human output에 공식 support endpoint 여부 표시
- `scripts/agent-report-issue.js`
  - preview 출력에 support endpoint 상태/설명 표시

### 3. 에이전트 문서 최신화

- `.agent/workflows/first-contact.md`
  - 공식 support-agent hostname 오탐 금지 규칙 추가
- `.claude/rules/support-agent.md`
  - support-agent endpoint 판별 규칙 추가
- `docs/internal/audits/2026-03-07-agent-issue-reporting-audit.md`
  - 공식 support endpoint 오탐 금지 메모 추가

## 운영 판단

다음 항목만으로는 HQ bug report 대상이 아닙니다.

- `workers.dev` hostname 사용
- `yeonseung-choe.workers.dev` 서브도메인 사용
- support-agent URL이 `clinic-os-support-agent.yeonseung-choe.workers.dev` 인 것 자체

다음 증거가 있을 때만 이슈로 승격합니다.

- endpoint reachability 실패
- `/support/chat`, `/support/report-bug` 계약 경로 실패
- 인증/라이선스 헤더 계약 실패
- 운영 설정 문서와 실제 배포 대상 불일치
