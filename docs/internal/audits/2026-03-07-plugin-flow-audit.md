# 2026-03-07 Plugin Flow Audit

auditor: Codex
scope: local plugin development, HQ submission/review, store install/use, agent-driven workflow

## 결론

현재 플러그인 생태계는 "로컬에서 플러그인을 만들어 공유하고 설치한다"는 큰 방향은 갖추고 있다. 하지만 에이전트가 안전하게 주도하기에는 계약, 문서, HQ 스키마, 설치 후 활성화 흐름이 아직 덜 정렬되어 있다.

사용자 중심으로 보면 가장 큰 문제는 아래 세 가지다.

1. 문서를 따라도 실제 코드 계약과 어긋날 수 있다.
2. HQ 스토어 제출/검수 파이프라인이 fresh 환경에서 깨질 수 있다.
3. 설치/비활성화/리빌드 같은 운영 단계가 아직 사람 수동 개입에 기대는 구간이 남아 있다.

## 주요 발견

### S1. HQ marketplace 코드와 HQ 스키마/init 이 불일치

영향:

- fresh HQ DB 에서 플러그인 제출/검수/버전 관리가 정상 동작하지 않을 수 있음
- 운영 중에는 일부 seed 또는 수동 보정에 의존하게 됨

근거:

- `hq/package.json` 의 `db:init` 은 `hq/schema.sql` 을 사용
- `hq/schema.sql` 에는 plugin marketplace 테이블이 없음
- 반면 `hq/src/index.js` 는 `plugins`, `plugin_versions`, `plugin_reviews`, `plugin_submissions` 를 전제로 동작
- `hq/migrations/0014_plugin_marketplace.sql` 의 컬럼과 `hq/src/index.js` 의 INSERT/UPDATE 컬럼명이 다수 불일치

우선 조치:

1. `hq/schema.sql` 을 migration 결과와 동기화
2. `hq/src/index.js` 의 plugin INSERT/UPDATE 컬럼을 실제 스키마 기준으로 정렬
3. fresh init 검증 테스트 추가

### S1. 최초 제출 시 `plugin_submissions` 생성 누락

영향:

- 개발자 제출 내역 조회/재제출 흐름이 깨짐
- HQ 심사 상태 추적이 불완전함

근거:

- `hq/src/index.js` 제출 경로는 `plugins`, `plugin_versions`, `plugin_reviews` 만 기록
- 개발자 제출 목록과 재제출 경로는 `plugin_submissions` 조회를 전제로 함

우선 조치:

1. 최초 제출 시 `plugin_submissions` 생성
2. resubmit/review 로직과 동일한 상태 모델로 통일

### S2. 비활성화된 플러그인 API 가 계속 열릴 수 있음

영향:

- 사용자가 플러그인을 껐다고 생각해도 API 호출은 살아 있을 수 있음
- 민감한 동작은 UI보다 API 에서 우회될 수 있음

근거:

- 페이지 라우터는 `isPluginEnabled()` 를 확인
- `src/pages/api/plugins/run/[...path].ts`
- `src/pages/api/hub/[...path].ts`
  에서는 enable 상태 확인이 없음

우선 조치:

1. 두 API 라우터에서 `isPluginEnabled()` 검사 추가
2. disabled 상태 응답 계약 정의

### S2. manifest 계약이 loader, validator, 문서 사이에서 갈라져 있음

영향:

- 에이전트가 문서대로 작성해도 validator 또는 runtime 중 하나에서 어긋날 수 있음
- 플러그인 구조를 "감으로" 맞추게 됨

근거:

- `src/lib/plugin-loader.ts` 와 `src/lib/plugin-sdk.ts` 의 `PluginManifest` shape 차이
- hooks 는 한쪽이 `event`, 다른 쪽이 `type`
- docs 는 `pages`, `apis`, `overrides` 중심, validator 는 route/widget/schema 중심

우선 조치:

1. `manifest.schema.json` 같은 단일 계약 생성
2. loader, validator, docs 를 모두 그 schema 에 맞춤
3. sample plugin fixture 추가

### S2. 문서가 존재하지 않는 import 경로를 안내

영향:

- 로컬 플러그인을 에이전트가 생성할 때 첫 컴파일부터 실패할 수 있음

근거:

- 문서와 SDK README 가 `@clinic-os/plugin-sdk` 를 안내
- 실제 starter 에는 alias 가 없음

조치:

- 이번 배치에서 문서와 inline README 를 상대 경로 기준으로 정정함

### S2. 설치 후 리빌드가 여전히 사람 중심 UX

영향:

- 사용자가 `Ctrl+C`, `npm run dev` 같은 수동 절차를 따라야 할 가능성이 있음
- 에이전트 주도 UX 와 맞지 않음

근거:

- store/install 흐름에 rebuild API 는 존재
- 하지만 일부 UI/안내는 여전히 수동 재시작 중심

우선 조치:

1. install success 시 rebuild 자동 트리거
2. 완료/실패 상태 polling 을 기본 경로로 통일

### S3. 로컬 plugin submit/install API 의 auth 가 약함

영향:

- 관리자 권한 검증이 문자열 수준에 머물러 있음

근거:

- 일부 경로가 `admin_session=` 포함 여부만 검사

우선 조치:

1. 공통 admin auth helper 로 통일
2. role/permission 기반 검사 추가

### S3. 공식 플러그인 스캐폴드가 없음

영향:

- 에이전트가 매번 구조를 추론해야 함
- 문서 drift 가 생기면 생성 품질이 흔들림

근거:

- `package.json` 에 plugin scaffold 명령 없음
- scripts 에 dedicated create-plugin 없음

우선 조치:

1. `npm run plugin:create -- --id=my-plugin --type=new-route` 추가
2. manifest/README/pages/api/migrations 템플릿 제공

### S3. 계약 테스트 부족

영향:

- 제출/검수/설치/리빌드/enable-disable/route resolution 회귀를 자동으로 잡기 어려움

우선 조치:

1. local install -> rebuild -> route visible 테스트
2. disabled plugin -> page/API 차단 테스트
3. HQ submit -> submissions row -> review transition 테스트
4. fresh HQ schema init smoke test

## 이번 배치에서 반영한 문서 개선

- 사용자 설치/온보딩 문서를 Agent-First 기준으로 갱신
- 플러그인 개발 가이드를 runtime 계약 중심으로 정리
- 플러그인 API 레퍼런스를 실제 SDK entry 기준으로 정정
- plugin agentic workflow 를 실행 문서로 축소/정리
- `@clinic-os/plugin-sdk` alias 경고를 SDK inline 문서에 반영

## 다음 패치 우선순위

1. HQ schema/init 와 marketplace 코드 정렬
2. 최초 제출 시 `plugin_submissions` 생성
3. disabled plugin API 차단
4. manifest 단일 schema 도입
5. plugin scaffold 명령 추가
6. install -> rebuild 자동화와 contract test 추가
