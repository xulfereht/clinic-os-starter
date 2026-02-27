# Clinic-OS

> 이 프로젝트를 열면 즉시 아래 프로토콜을 실행하세요.

## 자동 감지 프로토콜

프로젝트를 열면 다음을 확인하여 현재 단계를 판별하세요:

| 우선순위 | 체크 | 없으면/있으면 | 행동 |
|---------|------|-------------|------|
| **최우선** | `.agent/last-error.json` | **있으면** | 에러 복구 (아래 참조) |
| 1 | `node_modules/` | 없으면 | `npm install` 실행 |
| 2 | `.docking/config.yaml` | 없으면 | `npm run setup` 안내 |
| 3 | `.agent/onboarding-state.json` | 없으면 | 온보딩 시작 |
| 4 | 위 파일 있고 pending 항목 | 있으면 | 이어서 진행 |

### 에러 자동 복구 (최우선)

`.agent/last-error.json`이 있으면 **다른 작업보다 먼저** 처리:
1. 파일을 읽고 에러 내용을 사용자에게 보고
2. `.agent/workflows/troubleshooting.md` 참조하여 복구 시도
3. `recovery.commands`를 순서대로 실행
4. 성공 시 `.agent/last-error.json` 삭제
5. 실패 시 사용자에게 수동 조치 안내

**상세 절차**: `.agent/workflows/first-contact.md`

## 파일 수정 규칙

- 코어 파일 수정 금지 (`.claude/rules/clinic-os-safety.md` 참조)
- 커스텀은 `_local/` / `local/` 디렉토리 사용

## 한국어 응답

모든 사용자 응답은 한국어로 작성하세요.
