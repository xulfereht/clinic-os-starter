---
description: 플러그인 Agent-First 워크플로우
category: dev
---

# 플러그인 Agent-First 워크플로우

> 목적: 로컬 클리닉 설치본에서 에이전트가 플러그인을 안전하게 만들고, 테스트하고, HQ 스토어 제출/설치까지 주도하도록 돕는 실행 문서

## 0. 먼저 분류

사용자 요청이 들어오면 먼저 아래 중 어디에 해당하는지 판별한다.

1. 기존 코어 페이지 수정
   - `src/pages/_local/...`
   - 플러그인 불필요
2. 새 기능, 새 경로, 새 API, 새 관리자 탭 추가
   - `src/plugins/local/{plugin-id}/`
   - 플러그인 사용
3. 코어 버그 수정 또는 스토어/플랫폼 문제
   - 중앙 패치 대상
   - 로컬 플러그인으로 우회하지 말고 core/HQ 수정 여부 판단

## 1. 읽을 파일

플러그인 작업 전 아래 순서로 읽는다.

1. `docs/PLUGIN_DEVELOPMENT_GUIDE.md`
2. `docs/PLUGIN_API_REFERENCE.md`
3. `src/lib/plugin-loader.ts`
4. `src/pages/api/plugins/install.ts`
5. `src/pages/api/plugins/submit.ts`
6. `src/pages/api/plugins/migrate.ts`
7. `src/pages/ext/[...path].astro`
8. `src/pages/admin/hub/[...path].astro`

HQ 스토어 제출/검수까지 보려면 추가로 읽는다.

1. `hq/src/index.js`
2. `hq/migrations/0014_plugin_marketplace.sql`
3. `hq/schema.sql`

## 2. 로컬 플러그인 생성 규칙

플러그인은 반드시 아래에 만든다.

```text
src/plugins/local/{plugin-id}/
```

기본 구조:

```text
src/plugins/local/{plugin-id}/
├── manifest.json
├── README.md
├── pages/
├── api/          # optional
├── lib/          # optional
└── migrations/   # optional
```

기본 시작은 아래 명령이다.

```bash
npm run plugin:create -- --id=my-plugin --type=new-route --with-admin --dry-run --json
```

구조가 맞으면 실제 생성한다.

## 3. manifest 작성 규칙

런타임 SOT는 `src/lib/plugin-loader.ts` 이다.

필수에 가까운 필드:

- `id`
- `name`
- `description`
- `version`
- `author`
- `permissions`
- `type`

권장 필드:

- `routes`
- `pages`
- `apis`
- `hooks`
- `documentation`

주의:

- `hooks` 는 현재 loader 기준으로 `event` 사용
- validator 코드에는 `type` 용어가 남아 있어도 runtime 우선

## 4. import 규칙

로컬 플러그인은 현재 앱 내부 소스로 실행된다.

따라서:

- `@clinic-os/plugin-sdk` 를 기본 import 경로로 가정하지 말 것
- 실제 파일 깊이에 맞는 상대 경로를 사용

예:

- `src/plugins/local/my-plugin/api/stats.ts`
  - `../../../../lib/plugin-sdk`
- `src/plugins/local/my-plugin/pages/index.astro`
  - `../../../components/layout/BaseLayout.astro`

## 5. 데이터/스키마 규칙

반드시 지켜야 한다.

1. 코어 테이블 수정 금지
2. 루트 `migrations/` 수정 금지
3. 플러그인 쓰기는 `custom_*` 와 `plugin_storage` 범위만 사용
4. 스키마 변경은 `src/plugins/local/{pluginId}/migrations/` 또는 `sdk.migrations` 만 사용

권장 테이블명:

```text
custom_{plugin_id}_{entity}
```

## 6. 로컬 개발 절차

1. 요청을 플러그인으로 분류
2. `src/plugins/local/{plugin-id}` 생성
3. `manifest.json` / `README.md` / `pages/` 작성
4. 필요 시 `api/`, `lib/`, `migrations/` 추가
5. `npm run plugin:create -- --id={plugin-id} ...` 로 스캐폴드 생성
6. `npm run build`
7. `/ext/{pluginId}` 와 `/admin/hub/{pluginId}` 확인
8. 필요 시 `/api/plugins/migrate` 또는 관리자 UI에서 migration 실행

## 7. HQ 제출 절차

로컬 제출 전 확인:

- 관리자 세션 존재
- dev 모드
- 유효한 라이선스
- README 와 `documentation.summary`, `documentation.features` 작성

실행 흐름:

1. 로컬 validator 통과
2. zip 패키징
3. checksum 생성
4. HQ `/api/plugins/submit` 전송

현재 구현상 첫 제출 때 developer 레코드가 자동 생성될 수 있다. 다만 HQ 개발자 신청/심사 흐름과 완전히 정렬되어 있지 않을 수 있으므로, 플랫폼 버그와 정책을 구분해서 판단한다.

## 8. HQ 설치 절차

현재 코드 기준:

1. HQ 메타데이터 조회
2. 권한 분석
3. dev 모드면 `src/plugins/local/{pluginId}` 에 추출
4. DB에 `installed_pending_rebuild` 기록
5. rebuild 후 활성화

중요:

- 설치 후 바로 보이지 않으면 rebuild 필요 가능성이 큼
- 사용자에게 `Ctrl+C` 와 같은 수동 지시를 넘기지 말고 가능한 자동 rebuild 경로를 사용

## 9. 에이전트가 먼저 찾아야 할 위험 신호

1. HQ schema/init 과 marketplace 코드가 어긋나 fresh DB 에서 제출/검수 플로우가 깨질 수 있음
2. plugin_submissions 기록이 누락되면 검수 추적이 불분명해질 수 있음
3. auth 가 일부 API 에서 `admin_session=` 문자열 검사 수준에 머물러 있음
4. 플러그인 권한/스토어 정책과 실제 로컬 요청이 일치하는지 끝까지 검증해야 함

## 10. 이 경우는 중앙 패치로 올린다

- 스토어 제출/검수 자체가 안 되는 버그
- HQ schema mismatch
- 설치된 플러그인 enable/disable 정책 버그
- manifest contract drift
- SDK import path 문서 오류

## 11. 작업 완료 전 체크

- [ ] `_local/` 과 플러그인 중 올바른 방식을 골랐는가
- [ ] `src/plugins/local/` 밖을 건드리지 않았는가
- [ ] 코어 테이블을 수정하지 않았는가
- [ ] `custom_` 테이블만 생성했는가
- [ ] 빌드와 라우트를 검증했는가
- [ ] 제출 시 README 와 documentation 을 채웠는가
- [ ] 플랫폼 이슈면 audit 또는 중앙 패치로 분리했는가
