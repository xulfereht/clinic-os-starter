# Clinic-OS 문제 해결 가이드

로컬 에이전트가 코드베이스의 구조와 가드레일을 직접 읽고 문제를 해결합니다.

## 문제 해결 순서

1. **코드베이스 탐색**: `.agent/workflows/troubleshooting.md`를 먼저 읽고 진단 절차를 따름
2. **가이드 참조**: `docs/` 및 `hq/guides/`에서 관련 가이드 검색
3. **헬스 체크**: `npm run health` → `npm run doctor` 실행
4. **사용자에게 보고**: 시도한 것과 결과를 명확히 전달

## 주요 진단 명령어

| 상황 | 명령어 |
|------|--------|
| 환경 상태 확인 | `npm run health` |
| DB 스키마 검증 | `npm run doctor` |
| 코어 버전/상태 | `npm run core:status` |
| 코어 복구 | `npm run core:repair` |
| 스타터킷 복구 | `npm run update:starter` |

## 참조할 워크플로우 문서

- `.agent/workflows/troubleshooting.md` — 체계적 문제 해결 절차
- `.agent/workflows/upgrade-version.md` — 코어 업데이트 이슈
- `.agent/workflows/setup-clinic.md` — 초기 설정 이슈
- `docs/OPERATIONS_GUIDE.md` — 운영 가이드

## 원칙

- 외부 서포트 봇 호출 없이 로컬에서 해결
- `.agent/*` 문맥과 `docs/` 가이드가 충분한 지식 소스
- 2회 이상 실패 시 사용자에게 상황 설명하고 방향 논의
