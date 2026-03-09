---
hq_slug: survey-tools
hq_title: "검사도구 만들기"
hq_category: "04. 플러그인 시스템"
hq_sort: 2
hq_active: true
---
# 검사도구 만들기

Clinic-OS의 검사도구는 `/ext/survey-tools/{toolId}` 형태로 열리는 자가진단/설문/결과 흐름입니다.

사람이 구조를 외우기보다, 에이전트가 아래 기준으로 진행하는 것이 맞습니다.

## 언제 검사도구가 맞나요?

- 간단한 자가진단이나 설문을 만들고 싶을 때
- 검사 결과 페이지와 인쇄 리포트가 필요할 때
- 환자 상세 화면과 연결되는 결과 저장이 필요할 때

## 작업 위치

로컬 클리닉 전용 검사도구는 여기에서 만듭니다.

```text
src/survey-tools/local/{toolId}/
```

우선순위는 `local > store > core` 입니다.

로컬에서 새 검사도구를 시작할 때는 에이전트가 아래 명령으로 스캐폴드를 먼저 만드는 편이 안전합니다.

```bash
npm run survey-tool:create -- --id burnout-check --mode manifest --dry-run --json
```

실제 생성:

```bash
npm run survey-tool:create -- --id burnout-check --title "번아웃 자가진단" --mode hybrid --with-report
```

검증:

```bash
npm run survey-tool:check -- --id burnout-check --json
```

스토어에서 받은 검사도구는 에이전트가 아래 경로에 자동으로 설치해야 합니다.

```text
src/survey-tools/store/{toolId}/
```

사람이 HQ에서 `manifest.json` 을 내려받아 손으로 복사하는 방식은 더 이상 권장하지 않습니다.

## 스토어 설치

기본 흐름은 다음 둘 중 하나입니다.

1. 관리자 화면: `/admin/surveys/tools/store` 에서 설치
2. 에이전트 명령: `npm run survey-tool:install -- --id {toolId}`

먼저 계획만 확인하려면:

```bash
npm run survey-tool:install -- --id burnout-check --dry-run --json
```

실제 설치는:

```bash
npm run survey-tool:install -- --id burnout-check
```

패키지에 `migration.sql` 또는 `seed.sql` 이 있으면 로컬 D1에도 같이 적용됩니다.

## 기본 구조

```text
src/survey-tools/local/stress-check/
├── manifest.json
├── survey.astro
├── result.astro
└── report.astro
```

필수는 `manifest.json` 이고, 나머지는 필요할 때만 추가합니다.

## 두 가지 방식

### 1. 데이터 기반 검사

질문과 점수 계산이 단순하면 `manifest.json` 에 `questions` 와 `scoring` 을 넣는 방식이 가장 빠릅니다.

이 방식에서도 다음 로직을 쓸 수 있습니다.

- `options[].score` 로 표시값과 실제 점수를 분리
- `reverseScored: true` 로 역채점 문항 처리
- `weight` 로 문항 가중치 부여
- `maxScore` 로 문항별 최대 점수 고정
- `scoring.interpretation` 으로 결과 구간과 문구 정의

기본 렌더러 지원 질문 타입:

- `info`
- `radio`
- `checkbox`
- `select`
- `text`
- `textarea`
- `number`
- `nrs`

### 2. 커스텀 검사

브랜딩, 애니메이션, 복잡한 입력 흐름이 필요하면 `survey.astro`, `result.astro`, `report.astro` 를 직접 만듭니다.

혼합 모드도 가능합니다.

- `survey.astro` 만 두면 커스텀 검사지 + 기본 결과/리포트
- `result.astro` 만 두면 기본 검사지 + 커스텀 결과
- `report.astro` 만 두면 기본 검사지/결과 + 커스텀 결과지

필요하면 manifest 에 `useCustomSurvey`, `useCustomResult`, `useCustomReport` 로 개별 제어할 수 있습니다.

## 검증 경로

에이전트는 최소한 아래를 확인해야 합니다.

1. `npm run build`
2. `/ext/survey-tools/{toolId}`
3. 검사 제출 후 `/result/{resultId}`
4. 필요 시 `/report/{resultId}`
5. 환자 연결이 있으면 환자 상세 화면 진입 흐름

## 하지 말아야 할 것

- `src/plugins/survey-tools/` 를 직접 수정하지 않기
- 루트 `migrations/` 를 검사도구용으로 수정하지 않기
- 코드에서 직접 참조하는 썸네일/로고를 관리자 업로드로만 해결하지 않기

## 에이전트에게 이렇게 요청하면 됩니다

- "불면 검사도구를 로컬 survey-tools로 만들어줘"
- "manifest 기반으로 가능한지 먼저 보고, 복잡하면 custom renderer로 만들어줘"
- "검사 제출부터 결과 페이지까지 로컬에서 검증해줘"
