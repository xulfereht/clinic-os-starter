# 2026-03-07 Local Workspace Agent Audit

## 요약

플러그인 영역은 `plugin-agentic.md` 와 관련 문서가 비교적 정리되어 있었지만, 나머지 safe workspace는 보호 규칙만 있고 실행 문서와 기계 판독 manifest가 약했다.

가장 큰 공백은 아래였다.

1. `_local`, `src/lib/local`, `public/local`, `docs/internal` 의 선택 기준이 에이전트에게 구조화되어 있지 않음
2. `src/survey-tools/local` 은 loader와 README는 있으나 agent-first workflow와 HQ 가이드 slug가 부족함
3. `runtime-context.json` 이 경로는 보여주지만 해당 경로의 역할/워크플로를 같이 안내하지 않음
4. workflow index 에 로컬 커스터마이징과 검사도구가 독립 플레이북으로 노출되지 않음

## 조치

- `.agent/manifests/local-workspaces.json` 추가
- `.agent/workflows/local-customization-agentic.md` 추가
- `.agent/workflows/survey-tools-agentic.md` 추가
- `docs/LOCAL_WORKSPACES_GUIDE.md` 추가
- `docs/SURVEY_TOOLS_GUIDE.md` 추가
- `runtime-context` 와 `first-contact` 문서에 새 manifest/workflow 연결

## 기대 효과

- 로컬 원장이 "페이지 수정", "로고 교체", "검사도구 만들기", "운영 메모 남기기"를 요청했을 때 에이전트가 작업 공간을 잘못 고를 가능성이 줄어든다.
- `public/local` 과 R2, `_local` 과 플러그인, survey tool 과 일반 plugin 의 경계가 더 명확해진다.
