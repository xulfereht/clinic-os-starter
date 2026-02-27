# Clinic-OS

> 이 프로젝트를 열면 즉시 아래 프로토콜을 실행하세요.

## 자동 감지 프로토콜

프로젝트를 열면 다음을 확인하여 현재 단계를 판별하세요:

| 체크 | 없으면 | 행동 |
|------|--------|------|
| `node_modules/` | 설치 미완료 | `npm install` 실행 |
| `.docking/config.yaml` | 셋업 미완료 | `npm run setup` 안내 |
| `.agent/onboarding-state.json` | 온보딩 미시작 | 온보딩 시작 |
| 위 파일 있고 pending 항목 | 온보딩 진행 중 | 이어서 진행 |

**상세 절차**: `.agent/workflows/first-contact.md`

## 파일 수정 규칙

- 코어 파일 수정 금지 (`.claude/rules/clinic-os-safety.md` 참조)
- 커스텀은 `_local/` / `local/` 디렉토리 사용

## 한국어 응답

모든 사용자 응답은 한국어로 작성하세요.
