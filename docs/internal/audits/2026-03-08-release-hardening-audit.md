# Release Pipeline Hardening Audit (2026-03-08)

## 목적

`master -> HQ -> starter artifact -> 로컬 클라이언트 update/build` 체인에서 재발성이 높은 불안정성을 줄이고, 실패 시 원인을 추적 가능한 형태로 정리한다.

## 이번 감사에서 확인한 고위험 항목

### 1. 릴리스 동시 실행 차단 부재

- `publish-release.js`, `total-release.js`, `release-modular.js`는 같은 R2/D1/태그 상태를 만지지만 공통 락이 없었다.
- 이 상태에서는 서로 다른 터미널/에이전트가 같은 버전을 동시에 올리거나, `total-release -> publish-release`와 별도 수동 릴리스가 충돌할 수 있었다.

### 2. 릴리스 run 메타데이터 부재

- 최근 릴리스가 어디서 실패했는지 요약하는 표준 파일이 없었다.
- `release-state.json`, `release-modular-state.json`, 콘솔 출력이 따로 놀아서 실패 후 추적 비용이 높았다.

### 3. 릴리스 내부 npm 실행 경로가 PATH 의존

- 로컬 환경에 `/usr/local/bin/npm@6` 같은 구형 npm이 있으면 `npm install` 뿐 아니라 `npm run build`, `npm run core:push`, `npm run hq:deploy`도 같은 리스크를 가진다.
- 최근 백록담 업데이트에서 실제로 `Node 22 + npm 6` 조합으로 install이 깨졌고, 릴리스 스크립트도 같은 취약점을 공유하고 있었다.

## 이번 패치

### A. 공통 릴리스 락 + run summary 추가

- `scripts/lib/release-run-state.js` 추가
- 기능:
  - `.agent/release.lock` 원자적 획득
  - stale lock 자동 정리
  - `.agent/release-last-run.json` 기록
  - `.agent/release-runs/<release-id>.json` 히스토리 저장
  - `total-release -> publish-release` 중첩 실행 시 동일 release id 상속

### B. 릴리스 스크립트 stage logging 추가

- `scripts/total-release.js`
  - `preflight`
  - `version-bump`
  - `git-sync`
  - `starter-mirror`
  - `starter-core-parallel`
  - `hq-deploy`
  - `hq-distribute`
- `scripts/publish-release.js`
  - `prepare-starter-artifacts`
  - `upload-r2-artifacts`
  - `generate-release-notes`
  - `update-hq-db`
- `scripts/release-modular.js`
  - step 단위 run summary 기록

### C. 릴리스 내부 npm 경로 안정화

- `scripts/total-release.js`
- `scripts/release-modular.js`

위 스크립트들은 내부 `npm run` 호출 시 `scripts/lib/npm-cli.js`를 사용해 Node 번들 npm을 우선 선택한다.

### D. 감사 리포트에 run 상태 노출

- `scripts/release-pipeline-audit.js`
  - `release_runtime.active_lock`
  - `release_runtime.last_run`
  - `client.last_deploy`
  - 최근 failed release가 있으면 권장 조치 추가

### E. 배포 검증을 실제 Production deployment 기준으로 강화

- `scripts/deploy-guard.js`
  - 성공 배포 후 `.agent/last-deploy.json` 기록
  - `project_name`, `deployment_id`, `deployment_source`, `git_head`, `site_url` 저장
- `scripts/release-validate.sh`
  - `wrangler.toml`에서 Pages project 이름 자동 해석
  - `npx wrangler pages deployment list --json` 기준 최신 Production deployment 조회
  - 최신 Production `Source`와 로컬 `git rev-parse --short HEAD` 일치 여부 검증
  - `.agent/last-deploy.json`이 있으면 deployment id/source/project까지 교차 검증

### F. conductor 상태 가시성 보강

- `scripts/release-conductor.sh`
  - `.agent/release.lock` 감지
  - `.agent/release-last-run.json` 요약 노출
  - `.agent/release-modular-state.json` 요약 노출
  - active release lock이 있으면 새 conductor 시작 차단

### G. starter update bundle + hash skip 추가

- `scripts/publish-release.js`
  - `starter-files/bundles/v<version>.json.gz` 번들 업로드
  - `manifest.json`에 `hashes`, `bundle` 메타데이터 기록
  - 이전 manifest 해시와 비교해 바뀐 starter 파일만 다시 업로드
- `scripts/update-starter.js`
  - manifest 해시 기준 변경 파일만 다운로드
  - 변경 파일이 많으면 bundle 1회 다운로드 후 로컬 적용
  - 변경 없음이면 `0개 적용 / N개 건너뜀`으로 즉시 종료
- `scripts/update-starter-standalone.cjs`
  - 동일한 hash skip / bundle fallback 로직 지원
- `hq/src/index.js`
  - starter bundle 경로를 binary(`application/gzip`)로 직접 서빙

### H. 단일 운영 진입점 + 실행 리포트 추가

- `scripts/clinic-release.js`
  - `status`: 현재 릴리스 상태를 사람이 바로 읽을 수 있는 요약으로 출력
  - `report`: `.agent/release-ops-report.{json,md}` 생성
  - `beta`: HQ 배포 + starter publish 묶음 실행
  - `client-sync`: client snapshot/doctor/update-starter/update-starter-core(beta) 묶음 실행
  - `client-build`: client `npm install` + `npm run build`
  - `client-deploy`: preflight 또는 실제 배포 실행
  - `stable`: stable 승격 실행
- `scripts/lib/release-ops-report.js`
  - `release-pipeline-audit`, `release-last-run`, `release-modular-state`를 한 장 요약으로 병합
- `package.json`
  - `npm run release:ops`
  - `npm run release:ops:report`
- `docs/internal/RELEASE_PIPELINE_CHECKLIST.md`, `.claude/commands/clinic-release.md`
  - 운영 체크리스트와 명령 문서를 새 단일 진입점 기준으로 정리

### I. conductor / modular 상태 파일 단일화

- `scripts/release-conductor.sh`
  - `.agent/release-modular-state.json`을 공용 state file로 사용
  - legacy `.agent/release-state.json`은 자동 이관 후 제거
  - conductor가 쓰는 `pipelineState`, `history`, `validations`와 modular step metadata를 한 파일에 병합
- `scripts/release-validate.sh`
  - 버전 해석 fallback도 공용 state file 기준으로 정렬
- `.agent/README.md`
  - 릴리스 상태 파일 SoT를 `release-modular-state.json`으로 수정

## 검증

- `node --check scripts/lib/release-run-state.js`
- `node --check scripts/total-release.js`
- `node --check scripts/release-modular.js`
- `node --check scripts/publish-release.js`
- `node --check scripts/release-pipeline-audit.js`
- `node --check scripts/clinic-release.js`
- `node --check scripts/lib/release-ops-report.js`
- `npx vitest run tests/release-run-state.test.ts`
- `npx vitest run tests/release-ops-report.test.ts tests/release-run-state.test.ts`
- `node scripts/release-modular.js status`
- `npm run release:pipeline:audit -- --json`
- `npm run release:ops`
- `npm run release:ops:report`
- `bash scripts/release-conductor.sh status`
- `npx vitest run tests/starter-update-bundle.test.ts tests/starter-package-merge.test.ts`
- 백록담에서 `node scripts/update-starter.js`
  - 1회차: 구형 updater bootstrap 때문에 전체 196개 다운로드
  - 2회차: `변경 파일 0 / 건너뜀 196` 확인

## 남은 리스크

### 1. top-level `npm run ...` 자체는 여전히 사용자 PATH에 영향받음

- 내부 하위 호출은 안정화했지만, 사용자가 첫 진입을 `npm run release`로 시작할 때는 셸의 npm shim 경고가 남을 수 있다.
- 이건 repo 내부만으로 완전히 제거할 수 없고, 현재는 `clinic-release` 같은 Node 직접 실행 진입점을 표준 경로로 두는 것으로 완화했다.

### 2. conductor / modular 저장 포맷 정규화는 일부 과제 남음

- 이번 배치로 `.agent/release-state.json`과 `.agent/release-modular-state.json`의 이중 파일 문제는 해소했다.
- 다만 `pipelineState/history/validations`와 `currentStep/steps/lastUpdate`가 같은 파일 안에 공존하므로, 장기적으로는 필드 네이밍까지 한 번 더 정규화하는 게 좋다.

### 3. starter publish 첫 1회는 여전히 전체 업로드가 필요

- 기존 manifest에 파일 해시가 없던 상태에서 `hash skip`을 처음 도입할 때는 전체 starter 파일 재업로드가 한 번 필요하다.
- 이후부터는 같은 버전 hotfix나 소규모 수정에서 변경 파일만 업로드/다운로드된다.
