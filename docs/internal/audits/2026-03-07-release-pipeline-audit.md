# 2026-03-07 Release Pipeline Audit

## 범위

- `clinic-release` / `total-release.js`
- `release-modular.js`
- `publish-release.js`
- HQ 배포와 원격 D1 마이그레이션 경로

## 핵심 진단

### 1. Starter 산출물 준비가 릴리스 중복 작업을 유발하고 있었음

- `total-release` step 3에서 이미 `starter:push`가 `.starter-staging`을 최신화함
- 그런데 step 4 `create-starter-kit`가 다시 staging을 재구성함
- 이후 step 7 `publish-release`가 또 다시 starter 생성/검증을 반복함

영향:

- 릴리스 시간 증가
- staging freshness가 이미 확보된 상태에서도 불필요한 파일 복사/해시 계산 반복
- 로그가 길어지고 실패 지점 파악이 어려움

### 2. 인프라 파일 R2 업로드가 완전 직렬이라 병목이 있었음

- `STARTER_INFRA_FILES` 업로드가 파일 수만큼 순차 실행
- 각 업로드가 네트워크 round-trip을 포함해 릴리스 후반부 체감 시간을 키움

### 3. `create-starter`와 `core-mirror`는 순서 의존성이 약한데 직렬로 실행되고 있었음

- 둘 다 version bump 이후 같은 워크스페이스를 읽지만 서로 다른 staging 디렉토리를 사용
- `.starter-staging` vs `.mirror-staging`
- 따라서 step 3 완료 후에는 안전한 병렬 후보

### 4. HQ 배포에는 이미 D1 마이그레이션 자동화가 필요했고, 이번 배치로 포함시켰음

- 기존 gap은 이번 작업 전 선행 패치로 해소
- 이제 `hq:deploy`는 `build -> db:migrate:remote -> deploy`

### 5. 클라이언트 릴리스 체인에서 `update:starter`가 누락돼 있었음

- 기존 Phase 2 문구는 `core:pull:beta -> build -> deploy`만 강조
- 하지만 구형 설치본은 starter infra가 먼저 갱신되지 않으면 새 에이전트 스크립트와 복구 경로를 못 받음
- 실제 백록담 설치본도 `package.json/core version = 1.25.6` 상태였고, 최신 에이전트 경로와 차이가 남아 있었음

### 6. 기존 validator는 `HQ beta/stable`만 보고 standalone/update 경로 drift를 못 잡고 있었음

- `starter-files/manifest.json`이 구버전이어도 `PUBLISHED_BETA`는 통과 가능
- 클라이언트에 `agent-doctor.js`, `agent-report-issue.js` 같은 핵심 starter infra가 없어도 `CORE_PULLED`는 통과 가능

## 이번 배치 적용 내용

### 적용 1. Starter staging 재사용

- `release-modular` step 4는 `create-starter-kit --reuse-staging` 사용
- 같은 step에서 `verify-starter-kit --staging --no-refresh`로 추가 refresh 제거
- `total-release`도 동일한 재사용 경로로 정렬

### 적용 2. prepared starter 재사용 플래그

- `publish-release.js`에 `--prepared-starter` 추가
- `total-release`와 `release-modular` step 7이 이 플래그를 사용
- 이미 생성/검증된 starter zip이 있으면 release 단계에서 다시 만들지 않음

### 적용 3. 인프라 파일 업로드 제한 병렬화

- `publish-release.js`의 starter infra 업로드를 동시성 4로 병렬 실행
- 실패 집계와 20% 임계값 로직은 유지

### 적용 4. 안전 병렬 구간 추가

- `total-release`에서
  - `Starter Kit 생성/검증`
  - `Core 미러링`
  를 병렬 실행
- 둘 중 하나라도 실패하면 전체 릴리스 실패로 처리

### 적용 5. 클라이언트 릴리스 체인에 `update:starter` 반영

- `release-conductor.sh`의 클라이언트 단계 안내를 `update:starter -> core:pull:beta`로 수정
- `/clinic-release` 문서도 같은 순서로 갱신

### 적용 6. 릴리스 validator 강화

- `PUBLISHED_BETA`는 이제 `starter-files/manifest.json` 버전도 같이 검증
- `CORE_PULLED`는 클라이언트에 핵심 starter infra 파일이 존재하는지까지 확인

### 적용 7. 전체 파이프라인 감사 커맨드 추가

- `scripts/release-pipeline-audit.js`
- `npm run release:pipeline:audit -- --json`
- master/HQ/client 버전, starter manifest, 백록담 상태, 단계별 validator 결과, 다음 권장 명령을 한 번에 출력

### 적용 8. `update:starter` 배포 세트를 `.starter-staging` 기준으로 확장

- 더 이상 19개 인프라 파일만 manifest에 올리지 않음
- `.starter-staging`의 실제 starter 파일 세트를 기준으로 starter update manifest를 생성
- 결과적으로 `.agent/*`, `.claude/*`, docs, tests, generated starter guide 파일까지 로컬 클라이언트가 `update:starter`로 받을 수 있는 방향으로 확장됨
- `package.json`은 old updater가 raw overwrite할 위험이 있으므로 manifest에는 넣지 않음
- 대신 `starter-files/package.json`을 별도 업로드하고, 새 `update-starter-core.js`가 merge-safe하게 동기화함

## 기대 효과

- Starter 관련 중복 작업 2회 제거
- R2 인프라 업로드 체감 시간 단축
- 릴리스 로그에서 병목 구간 식별이 쉬워짐
- `clinic-release` 경로와 실제 스크립트 동작이 더 일치

## 남은 개선 후보

### P1. 릴리스 요약 아티팩트 저장

- 각 단계 시작/종료 시각
- 병렬 단계별 소요 시간
- 실패/성공 요약
- 제안 위치: `.agent/release-last-run.json`

### P1. `publish-release`의 R2 업로드 검증 범위 조정

- 현재 starter zip/metadata는 검증하지만 infra file은 업로드만 수행
- 중요 파일 subset에 대해서는 lightweight verify를 붙일 여지 있음

### P2. `clinic-release` 오케스트레이터와 모듈러 상태의 이중 기록 정리

- 현재 orchestrator 상태와 `release-modular-state.json`이 병존
- SoT를 하나로 줄이거나 동기화 전략을 명시할 필요가 있음
