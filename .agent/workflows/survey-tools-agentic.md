---
description: 검사도구 Agent-First 워크플로우
category: dev
---

# 검사도구 Agent-First 워크플로우

> 목적: 에이전트가 `src/survey-tools/local/**` 에 새 검사도구를 만들거나 수정할 때 런타임 계약을 먼저 읽고 진행하도록 돕는 실행 문서

## 0. 언제 검사도구를 쓰는가

다음 요청은 보통 검사도구로 분류한다.

- 자가진단/설문/체크리스트/문진 페이지가 필요하다
- `/ext/survey-tools/{toolId}` 형태로 공개 링크가 필요하다
- 결과 페이지와 인쇄용 리포트가 필요하다
- 환자와 연결된 결과 저장이 필요하다

새 기능이 일반 페이지나 관리자 기능에 더 가깝다면 플러그인 또는 `_local` 을 먼저 검토한다.

## 1. 읽을 파일

1. `.agent/runtime-context.json`
2. `.agent/manifests/local-workspaces.json`
3. `src/lib/survey-tools-loader.ts`
4. `src/plugins/survey-tools/README.md`
5. `docs/SURVEY_TOOLS_GUIDE.md`
6. `src/plugins/survey-tools/pages/[...tool].astro`
7. `scripts/survey-tool-install.js`
8. `scripts/survey-tool-create.js`
9. `scripts/survey-tool-check.js`

## 2. 경로와 우선순위

검사도구 로딩 우선순위:

1. `src/survey-tools/local/{toolId}/`
2. `src/survey-tools/store/{toolId}/`
3. `src/survey-tools/{toolId}/`

즉 로컬 도구가 가장 우선한다.

스토어 도구는 `src/survey-tools/store/{toolId}/` 에 자동 설치되며, 손으로 `manifest.json` 을 복사하지 않는다.

## 3. 기본 구조

```text
src/survey-tools/local/{toolId}/
├── manifest.json
├── survey.astro        # 선택
├── result.astro        # 선택
└── report.astro        # 선택
```

간단한 검사는 `manifest.json` 의 `questions`, `scoring` 으로 충분할 수 있다.
복잡한 검사는 `survey/result/report.astro` 를 직접 작성한다.

새 local 도구를 만들 때는 수작업보다 스캐폴드를 먼저 쓴다.

```text
npm run survey-tool:create -- --id {toolId} --mode manifest --dry-run --json
```

검사지 커스터마이징이 필요하면:

```text
npm run survey-tool:create -- --id {toolId} --mode hybrid --with-report
```

## 4. 구현 방식 선택

### A. 데이터 기반

적합한 경우:

- 객관식/체크리스트 중심
- 점수 합산과 구간 해석이 단순하다
- 기본 설문 UI로 충분하다

필수:

- `manifest.json`
- `questions`
- `scoring`

추가 지원:

- `options[].score`
- `reverseScored`
- `weight`
- `useCustomSurvey/useCustomResult/useCustomReport`

### B. 커스텀 렌더링

적합한 경우:

- 브랜딩이 강하게 필요하다
- 복잡한 입력 흐름이 있다
- 결과/리포트 레이아웃을 자유롭게 구성해야 한다

필수:

- `manifest.json`
- 필요 시 `survey.astro`, `result.astro`, `report.astro`

## 5. 결과 저장과 연결

기본 제출 엔드포인트는:

```text
/api/survey-tools/submit
```

검증할 흐름:

1. 검사 페이지 열림
2. 답변 제출
3. 결과 ID 생성
4. `/ext/survey-tools/{toolId}/result/{resultId}` 이동
5. 필요 시 `/report/{resultId}` 인쇄 페이지 확인

환자 연결이 필요한 경우:

- `?patient_id=...` 흐름도 함께 확인
- 관리자 환자 상세 화면에서 진입하는 링크도 확인

## 6. 스토어 설치

스토어 설치가 필요하면 에이전트는 먼저 아래 명령으로 계획을 확인한다.

```text
npm run survey-tool:install -- --id {toolId} --dry-run --json
```

문제가 없으면 실제 설치를 실행한다.

```text
npm run survey-tool:install -- --id {toolId}
```

관리자 UI를 써야 할 때는 `/admin/surveys/tools/store` 를 사용한다.

패키지 안에 `migration.sql` 또는 `seed.sql` 이 있으면 설치 스크립트가 로컬 D1에 적용한다.

## 7. 하지 말아야 할 일

- `src/plugins/survey-tools/**` 직접 수정
- 루트 `migrations/` 수정
- 공용 코어 검사도구를 로컬 요구사항 때문에 직접 패치
- 코드에서 직접 참조하는 썸네일/로고를 R2 업로드로만 해결
- HQ에서 받은 `manifest.json` 을 사람이 직접 `src/survey-tools/store/` 에 저장

## 8. 완료 전 체크

- [ ] `toolId` 가 기존 local/store/core 와 충돌하지 않는가
- [ ] 새 도구라면 `survey-tool:create -- --dry-run --json` 으로 구조를 먼저 확인했는가
- [ ] 스토어 설치라면 `--dry-run --json` 결과를 먼저 확인했는가
- [ ] `survey-tool:check -- --id {toolId} --json` 으로 manifest/renderer 연결을 검증했는가
- [ ] `npm run build` 가 통과하는가
- [ ] `/ext/survey-tools/{toolId}` 가 열리는가
- [ ] result/report 흐름이 정상인가
- [ ] 환자 연결이 필요하면 해당 흐름도 확인했는가
