# Clinic-OS Release Pipeline Checklist

> 최신 기준 SoT.  
> 범위: `master -> HQ -> starter artifact -> client update/build/deploy -> stable 승격`
> 
> **표준 릴리스 경로:** `npm run publish` (total-release.js) — 원클릭 자동.
> **정합성 검증:** `npm run release:verify` — 릴리스 전후 필수.
> **참고:** `release-modular.js`는 디버깅/dry-run 전용 (deprecated).

## 목적

- 릴리스를 사람이 다시 추론하지 않고 같은 순서로 진행하게 한다.
- `starter`, `HQ`, `client deploy` 중 하나만 갱신되는 드리프트를 막는다.
- 실패 시 어느 단계에서 끊겼는지 바로 확인하게 한다.

## Phase 0. 사전 점검

### 0-1. 로컬 상태 확인

```bash
git status --short
npm run release:verify              # 정합성 검증 (tag, mirror, state)
npm run release:pipeline:audit -- --json
npm run release:ops
```

확인할 것:
- `release:verify` 전체 PASS (7개 항목)
- `.agent/release.lock`가 없어야 한다.
- `release:pipeline:audit`에서 기존 PROD drift가 없어야 한다.
- `npm run release:ops` 요약에서 failed validation이 없어야 한다.

문제 발견 시:
```bash
npm run release:verify:fix          # 자동 수복
```

### 0-2. 필수 빌드/검증

```bash
npm run verify:starter
npm run build --prefix hq
```

필요 시:

```bash
npx vitest run tests/release-run-state.test.ts tests/starter-update-bundle.test.ts
```

## Phase 1. Beta Publish

### 1-1. HQ 먼저 최신 코드로 배포

```bash
npm run deploy --prefix hq
```

목적:
- starter bundle/hash API와 HQ 공개 API가 최신 코드 기준으로 먼저 떠 있어야 한다.

### 1-2. starter artifact + starter-files + HQ beta 등록

```bash
node scripts/publish-release.js
```

기대 결과:
- `starter-kit/vX.Y.Z.zip`
- `starter-kit/vX.Y.Z.build.json`
- `starter-files/package.json`
- `starter-files/bundles/vX.Y.Z.json.gz`
- `starter-files/manifest.json`
- HQ beta channel = 현재 버전

### 1-3. 결과 확인

```bash
npm run release:pipeline:audit -- --json
npm run release:ops:report
```

확인할 것:
- `hq.beta_version`
- `hq.starter_manifest_version`
- `hq.starter_manifest_file_count`
- `release_runtime.last_run.status = completed`
- `.agent/release-ops-report.{json,md}` 생성

## Phase 2. 클라이언트 동기화

### 2-1. 보호 스냅샷

```bash
cd ~/projects/<client>
npm run agent:snapshot -- --reason=pre-release-sync --json
```

### 2-2. 현재 상태 진단

```bash
npm run agent:doctor -- --json
```

확인할 것:
- `health.score`
- `versions.root_package_version`
- `versions.core_version`
- `setup_recommendation`

### 2-3. starter bootstrap

```bash
node scripts/update-starter.js
```

기대 결과:
- 첫 bootstrap이면 다수 파일 동기화 가능
- 이후엔 `변경 파일 N / 전체 M`, `건너뜀`이 보여야 함

### 2-4. starter + core 묶음 업데이트

beta 테스트:

```bash
node scripts/update-starter-core.js --beta
```

stable 경로:

```bash
node scripts/update-starter-core.js --stable
```

## Phase 3. 클라이언트 빌드/배포

### 3-1. 빌드

```bash
npm install
npm run build
```

### 3-2. 배포 preflight

```bash
node scripts/deploy-guard.js --non-interactive
```

확인할 것:
- `CLOUDFLARE_URL`
- `compatibility_date`
- D1/R2 drift 없음
- build output 검증 성공

### 3-3. 실제 배포

```bash
node scripts/deploy-guard.js --non-interactive --yes
```

기대 결과:
- `.agent/last-deploy.json` 갱신
- `deployment_id`, `deployment_source`, `git_head` 기록

### 3-4. 배포 검증

master repo에서:

```bash
cd ~/projects/clinic-os
bash scripts/release-validate.sh DEPLOYED vX.Y.Z
npm run release:pipeline:audit -- --json
npm run release:ops
```

확인할 것:
- `DEPLOYED = PASS`
- Pages production `source` = client local HEAD

## Phase 4. Stable 승격

beta 테스트가 끝나고 승격할 때:

```bash
npm run release -- --stable
```

또는 내부 정책상 별도 승격 경로가 있으면 그 경로를 사용하되, 최종 확인은 동일하다.

승격 후 확인:

```bash
npm run release:pipeline:audit -- --json
npm run release:ops:report
```

확인할 것:
- `hq.stable_version = target version`
- `STABLE_PROMOTED = PASS`

## 운영 체크포인트

매 릴리스마다 확인:
- HQ가 먼저 배포됐는가
- starter manifest/version이 beta와 맞는가
- client가 `update-starter`를 먼저 받았는가
- deploy 후 `.agent/last-deploy.json`이 갱신됐는가
- production deployment source가 local HEAD와 일치하는가

## 장애 시 기본 복구 순서

### starter 쪽이 꼬였을 때

```bash
node scripts/update-starter-standalone.cjs
node scripts/update-starter.js
```

### core update 중 실패했을 때

```bash
npm run core:rollback
node scripts/update-starter-core.js --beta
```

### 배포 전후 상태가 의심스러울 때

```bash
npm run agent:doctor -- --json
node scripts/deploy-guard.js --non-interactive
npm run release:pipeline:audit -- --json
```

## 이 체크리스트로 닫혀야 하는 상태

- HQ beta/stable 버전이 의도대로 정렬됨
- starter manifest와 starter zip이 같은 버전을 가리킴
- client starter/core/root 버전이 일치함
- client build 성공
- production deployment source가 client HEAD와 일치함
- `release:pipeline:audit` 전체 `PASS`
