# Clinic-OS 감사 기록

> 개발자 전용 문서입니다. core:push 배포 대상이 아닙니다.

| 날짜 | 범위 | 보고서 |
|------|------|--------|
| 2026-02-26 | 구조, 보호체계, 문서, 개인정보, 배포 | [보고서](./2026-02-26-structure-audit.md) |
| 2026-02-26 | 건강진단시스템, 퍼블리시플로우, 클라이언트배포, 트러블슈팅 | [보고서](./2026-02-26-health-deploy-publish-audit.md) |
| 2026-02-26 | 운영커맨드, 배포체계, PII잔존, 보호규칙동기화 | [보고서](./2026-02-26-ops-commands-audit.md) |
| 2026-02-27 | AEO 내부링크, AI 챗봇 폴백, 코어 배포 무결성, PII 잔존 | [보고서](./2026-02-27-aeo-ai-chat-audit.md) |
| 2026-02-27 | DB 복구 로직, 보호 규칙 동기화, PII/브랜딩 잔존 | [보고서](./2026-02-27-db-recovery-protection-audit.md) |
| 2026-02-27 | First Contact 프로토콜, 에이전트 파일 배포, 보호 규칙 동기화 | [보고서](./2026-02-27-first-contact-audit.md) |
| 2026-03-07 | 로컬 에이전트 반복 오류 탐지, HQ bug report 경로, 스타터 포함 상태 | [보고서](./2026-03-07-agent-issue-reporting-audit.md) |
| 2026-03-07 | clinic-release, starter/core/HQ 배포 경로, 병목/중복/병렬화 감사 | [보고서](./2026-03-07-release-pipeline-audit.md) |
| 2026-03-08 | 릴리스 동시 실행 차단, run summary, npm 경로 안정화 | [보고서](./2026-03-08-release-hardening-audit.md) |
| 2026-03-07 | 퍼블릭 스킨 시스템, skin pack 확장, 에이전트 경로 | [보고서](./2026-03-07-public-skin-system-audit.md) |
| 2026-03-07 | HQ 스킨 라이브러리, 공개 가이드 정렬, 중앙 마켓플레이스 갭 | [보고서](./2026-03-07-hq-skin-alignment-audit.md) |

## 개선 트래커

-> [IMPROVEMENT-TRACKER.md](./IMPROVEMENT-TRACKER.md)

## 감사 실행

```bash
# Claude Code에서:
/audit          # 새 감사 보고서 생성
/safety-check   # 보호 규칙 동기화 점검
/improvement    # 다음 할 일 안내
```
