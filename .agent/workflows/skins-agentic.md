# Skin Pack Workflow

스킨 팩은 퍼블릭 페이지의 톤앤매너를 `manifest + css + 섹션 override` 단위로 관리하는 경로입니다.

## 언제 이 경로를 쓰는가

- 단순 문구 수정이 아니라 사이트 전체 분위기를 바꿔야 할 때
- `Hero`, `MainHero` 같이 구현 난도가 높은 섹션을 페이지 override 하나로 숨기고 싶지 않을 때
- 병원별 스킨을 재사용하거나 이후 공유 가능한 단위로 남기고 싶을 때

## 기본 절차

1. 현재 요청이 스킨 팩 문제인지 먼저 판별
2. 현재 활성 스킨과 디자인 설정 확인
3. `npm run skin:create -- --id=<skin-id> --dry-run --json` 으로 생성 계획 확인
4. `src/skins/local/<skin-id>/manifest.json` 에서 defaults/tokens/cssVars 설계
5. 필요 시 `sections/Hero.astro`, `sections/MainHero.astro` override 추가
6. `npm run skin:check -- --json` 으로 manifest, stylesheet, override, inheritance 검증
7. `/admin/design` 의 preview pack 에서 `전체/hero/cards/info/topic/faq/notice` surface 비교
8. `/demo/design-system?skin=<skin-id>` 와 실제 퍼블릭 페이지 확인
9. `npm run build` 로 마감 검증

## 공유/설치 흐름

다른 병원과 공유하거나 스토어형 설치본처럼 가져오려면 다음 순서를 쓴다.

1. `npm run skin:bundle -- --id=<skin-id> --source=local --dry-run --json`
2. 번들 메타데이터와 포함 파일 검토
3. `npm run skin:bundle -- --id=<skin-id> --source=local`
4. 받는 쪽에서 `npm run skin:install -- --file <zip-path> --dry-run --json`
5. 충돌이 없으면 `npm run skin:install -- --file <zip-path>`
6. 설치 후 `npm run skin:check -- --id <skin-id> --source store --json`
7. `/admin/design` 에서 선택 후 preview pack 과 실제 페이지 확인

HQ curated 스킨은 브라우저 관리자에서도 같은 목적을 달성할 수 있다.

1. `/admin/skins/store` 에서 HQ 카탈로그 조회
2. `HQ Curated` 표시 스킨만 설치/업데이트
3. dev 서버 재시작
4. `/admin/design` 에서 선택

HQ 커뮤니티 스토어에 제출하려면 다음 순서를 쓴다.

1. `npm run skin:submit -- --id=<skin-id> --source=local --dry-run --json`
2. 번들 크기, manifest, 라이선스 키 존재 여부 확인
3. `npm run skin:submit -- --id=<skin-id> --source=local`
4. HQ `/admin/skins/review` 큐에 올라갔는지 확인

즉 에이전트는 다음 우선순위를 따른다.

- 로컬 제작 후 중앙 공유면 `skin:create / skin:check / skin:submit`
- 로컬 제작 후 병원 간 직접 공유면 `skin:create / skin:bundle / skin:install`
- HQ curated/community preset 도입이면 `/admin/skins/store` 또는 `npm run skin:install -- --id <skin-id>`
- 코어 기본 스킨은 store 설치가 아니라 core update 경로

## 에이전트 판단 기준

- `local` 스킨을 수정 중이면 `skin:create`, `skin:check`, `skin:bundle` 조합을 우선 사용
- 기존 클라이언트에서 스킨 관련 요청이면 먼저 `theme_config.skinSystemVersion` 또는 `skinActivatedAt` 존재 여부를 확인한다
- 명시 저장 전 기존 클라이언트는 legacy-safe 모드로 보고, 디자인 저장 시점부터만 v2 page template/recipe/override 가 활성화된다고 설명한다
- 이미 받은 zip 을 적용하는 상황이면 바로 수동 복사하지 말고 `skin:install -- --dry-run --json` 으로 충돌 여부부터 본다
- 같은 ID 가 `core` 또는 `local` 에 있으면 store 설치를 강행하지 않는다
- 설치 후에는 항상 `/admin/design` 미리보기와 `npm run build` 까지 같이 돌린다
- HQ에서 코어 프리셋/가이드를 보여줘야 하면 `/skins`, `/skins/{skinId}`, `/guide#vibe-skins`, `/guide#skin-sharing` 경로를 기준으로 안내한다
- HQ curated/community 스킨 설치/제거는 로컬 워크스페이스에서만 가능한 작업으로 설명한다
- 커뮤니티 공유 목적이면 zip 전달 전에 `skin:submit` 경로를 먼저 검토한다
- 브라우저에서 설치가 일어나도 실제 반영은 dev 서버 재시작 후 `/admin/design` 에서 확인한다

## curated 스킨 명령

```bash
npm run skin:install -- --id linenBreeze --dry-run --json
npm run skin:install -- --id linenBreeze
npm run skin:remove -- --id linenBreeze --dry-run --json
npm run skin:remove -- --id linenBreeze
npm run skin:submit -- --id editorial-clinic --source local --dry-run --json
npm run skin:submit -- --id editorial-clinic --source local
```

판단 기준:

- 설치 전에는 항상 `--dry-run --json`
- 코어 기본 스킨이면 설치하지 않고 `/admin/design` 에서 바로 선택
- 제거는 `store` source 에만 허용

## 우선순위

- 1차: `manifest.json` 의 `defaults`, `tokens`, `sectionStyles`
- 2차: `skin.css` 로 표면 스타일/장식/타이포
- 3차: `componentRecipes`
- 4차: `pageTemplates`
- 5차: Hero/MainHero override
- 6차: 페이지별 `_local` 조정은 마지막 수단

## 피해야 할 것

- 스킨 변경을 `src/components/sections/**` 직접 수정으로 해결
- 홈페이지 override 플러그인 하나에만 모든 스타일 책임을 몰아넣기
- 색상만 바꾸고 spacing/radius/type/section rhythm은 그대로 두기

## 검증 체크

- `/admin/design` 에 새 스킨이 보이는가
- `/admin/design` preview pack 에서 `전체`, `Hero Surface`, `Card Surface`, `Info Surface`, `Topic Detail`, `FAQ Detail`, `Notice Detail` 이 모두 의도대로 보이는가
- `npm run skin:check -- --id <skin-id> --json` 에 error 가 없는가
- `/demo/design-system?skin=<skin-id>` 에서 Hero/MainHero/정보/detail surface 가 의도대로 보이는가
- `/`, `/blog`, `/blog/{slug}`, `/programs`, `/location`, `/topics/...`, `/notices/...` 같은 주요 퍼블릭 페이지 4-6곳에서 깨짐이 없는가
- 기존 관리자 설정값(병원명/연락처/운영시간)이 그대로 소비되는가

## Pencil MCP 설계 메모

- Pencil MCP가 연결된 환경이면 먼저 스타일 가이드나 preview frame으로 방향을 잡는다.
- 그 결과를 바로 페이지 override로 옮기지 말고 `tokens -> sectionStyles -> componentRecipes -> pageTemplates` 순서로 분해한다.
- 구조가 큰 Hero/MainHero만 section override로 올리고, 나머지는 skin pack 계약 안에 남기는 편이 유지보수에 유리하다.
