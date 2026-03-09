# 로컬 에이전트 반복 오류 → HQ 이슈 보고 경로 감사

작성일: 2026-03-07

## 범위

- 스타터킷/코어 설치본에서 로컬 에이전트가 반복 오류를 감지했을 때 HQ 지원 채널로 이슈를 올리는 경로
- doctor/support 상태 파일과 support-agent-worker bug report API의 정합성
- 스타터킷 배포물에 필요한 스크립트와 상태 파일 포함 여부

## 결론

기존에도 HQ 쪽 bug report API는 존재했지만, 로컬 설치본에서 이를 구조적으로 호출하는 에이전트 드리븐 경로가 약했습니다. 이번 패치로 `반복 오류 감지 -> fingerprint 축적 -> 중복 이슈 append 또는 신규 생성 -> doctor 제안` 흐름을 닫았습니다.

## 주요 발견 사항

### 1. 로컬 진단은 있었지만 구조화된 이슈 보고 진입점이 없었음

- `.agent/last-error.json`, `.agent/support-status.json`, `.agent/runtime-context.json`은 존재했지만 이를 묶어 HQ bug report payload로 변환하는 표준 CLI가 없었습니다.
- 결과적으로 로컬 에이전트는 같은 오류를 반복해서 만나도 HQ에 일관된 포맷으로 전달하기 어려웠습니다.

### 2. 반복 오류 판단 기준과 이력 저장이 없었음

- 기존 상태 파일은 “최근 에러 1건” 중심이라, 같은 fingerprint가 여러 번 반복됐는지 구분하지 못했습니다.
- 같은 이벤트를 중복 제출하지 않도록 막는 로컬 이력도 없었습니다.

### 3. 지원 API 경로가 둘로 보여 혼동 여지가 있었음

- HQ 쪽 `api/support/bug` 경로는 내부 API 키 기반의 단순 경로입니다.
- 실제 클라이언트 설치본이 써야 하는 구조화된 bug report API는 `support-agent-worker`의 `/support/report-bug` 입니다.
- 로컬 에이전트 관점에서 어떤 경로를 source of truth로 써야 하는지 명시가 부족했습니다.

### 4. `last-error.json` 스키마가 완전히 일관되지는 않음

- 일부 경로는 `error.message`, `error.stack` 객체 형태를 남기고,
- 일부 경로는 더 평평한 형태를 남길 수 있습니다.
- 이번 패치는 두 형태를 모두 흡수하도록 만들었지만, 발생원 스키마 자체는 아직 완전히 정렬되지 않았습니다.

## 반영한 개선

### 1. 로컬 이슈 리포팅 CLI 추가

- `npm run agent:report-issue`
- 위치:
  - `scripts/agent-report-issue.js`
  - `scripts/lib/issue-reporting.js`

지원 기능:

- 반복 오류 fingerprint 생성
- `.agent/issue-history.json`에 occurrence/attempt/report 상태 축적
- `.agent/issue-report-status.json`에 마지막 제출 결과 기록
- dry-run / json / force / duplicate append 제어
- `clinic.json`, `.cos-license`, 환경변수에서 라이선스 키 탐색

### 2. support-agent-worker bug report 계약에 맞춘 payload 생성

- `/support/report-bug/check-similar`
- `/support/report-bug/:id/append`
- `/support/report-bug`

중복이 있으면 기존 bug에 추가 정보를 append하고, 없으면 신규 bug를 생성합니다.

### 3. doctor와 자동 제안 연결

- `npm run agent:doctor -- --json` 출력에 `issue_reporting` 블록 추가
- 반복/고위험 이슈일 때만 `report_recurring_issue` 제안
- 라이선스가 없는 마스터 레포에서는 제안 액션을 자동으로 띄우지 않도록 제한

### 4. 스타터킷 포함 및 상태 파일 ignore 정리

- 스타터 배포물에 `agent:report-issue`와 관련 라이브러리 포함
- `.agent/issue-history.json`
- `.agent/issue-report-status.json`

위 두 파일은 git 추적에서 제외해 로컬 진단 상태가 커밋에 섞이지 않게 했습니다.

### 5. `last-error.json` 스키마를 발생원 기준으로 통일

- `scripts/lib/error-recovery.mjs`에 공통 structured writer를 추가했습니다.
- `.docking/engine/fetch.js`
- `.docking/engine/migrate.js`
- `scripts/setup-step.js`

위 경로가 이제 같은 형태의 `last-error.json`을 쓰도록 정렬되었습니다.

정렬된 핵심 필드:

- `schema_version`
- `timestamp`
- `command`
- `phase`
- `error.message`
- `error.stack`
- `error.code`
- `context`
- `recovery.commands`
- `attempts`

### 6. HQ 이슈 보드에서 raw bug report 가시화

- HQ 기존 `/admin/support/issues`는 반복 패턴과 미해결 세션만 보여주고, 로컬 에이전트가 올린 raw bug report는 직접 보이지 않았습니다.
- 이번 패치로 같은 페이지 안에 다음 구역을 추가했습니다.

추가된 요소:

- bug stats KPI
- 상태/심각도 필터
- raw bug report 리스트
- bug detail 조회
- status 변경
- GitHub issue 생성

즉 로컬 설치본의 `agent:report-issue`로 올라온 bug가 HQ 운영면에서 바로 보이고 triage 가능한 상태가 되었습니다.

### 7. HQ 운영면에 반복 설치/업데이트 오류 집계 추가

- raw bug list만으로는 “같은 설치/업데이트 오류가 여러 클리닉에서 반복되는지”를 한눈에 보기 어려웠습니다.
- support-agent-worker에 `/admin/bugs/insights` 집계 endpoint를 추가해 최근 bug를 다음 기준으로 묶도록 했습니다.

집계 기준:

- category: `install`, `update`, `migration`, `deploy`, `auth`, `runtime`, `other`
- phase
- step
- normalized title 기반 cluster

HQ `/admin/support/issues`에는 다음이 추가되었습니다.

- 운영 오류 카테고리 분포
- 주요 phase 목록
- 반복 클러스터 테이블

이제 운영자는 “디바이스 등록”, “core:pull”, “db:migrate”, “deploy drift” 같은 오류가 어느 축에서 반복되는지 바로 볼 수 있습니다.

## 검증

- `npx vitest run tests/agent-issue-reporting.test.ts`
- `npx vitest run tests/error-recovery-schema.test.ts`
- `npm run agent:doctor -- --json`
- `npm run verify:starter`
- `npm run build --prefix hq`
- `npx vitest run tests/bug-insights.test.ts`

검증 결과:

- 반복 fingerprint 누적 동작 확인
- duplicate append 경로 확인
- 신규 bug 생성 경로 확인
- `fetch/migrate/recovery` 공통 스키마 writer 확인
- 라이선스 없는 마스터 레포에서 doctor가 과한 제출 액션을 제안하지 않는 것 확인
- 스타터킷 검증 130/130 통과
- HQ `/admin/support/issues`에 raw bug inbox가 포함된 상태로 빌드 통과
- support-agent-worker bug insights helper/cluster 집계 테스트 통과

## 남은 갭

### 1. support URL 기본값 단일화

- 현재 로컬 이슈 리포팅 기본값은 support-agent-worker URL을 직접 사용합니다.
- 장기적으로는 HQ manifest 또는 공용 설정 파일에서 단일 source of truth로 내리는 편이 안전합니다.

### 2. HQ 운영면에서의 가시화

- 현재는 로컬 에이전트가 HQ 지원 채널로 bug를 잘 올리는 쪽에 초점이 맞춰져 있습니다.
- HQ 관리자 면에서 “반복적으로 많이 들어오는 설치 오류/업데이트 오류”를 집계하는 뷰는 별도 강화 여지가 남아 있습니다.
