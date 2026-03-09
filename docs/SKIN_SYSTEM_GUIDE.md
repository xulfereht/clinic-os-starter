# Skin System Guide

Clinic-OS의 스킨 시스템은 퍼블릭 페이지 스타일을 `스킨 팩` 단위로 관리합니다.

현재 코어 프리셋 라인업:

- `clinicLight`: 기본 의료 신뢰형
- `wellnessWarm`: 친근한 패밀리 웰니스형
- `hanbangClassic`: 전통 한방 헤리티지형
- `editorialCalm`: 버건디 에디토리얼형
- `forestTherapy`: 자연 회복형
- `dataDark`: 산업/터미널형 다크
- `midnightSignal`: 고대비 시그널 다크형
- `scandiCare`: 북유럽 패밀리 케어형
- `ivoryLedger`: 조용한 프리미엄 아이보리형

## 목표

- 단순 CSS override를 넘어, 퍼블릭 페이지 전반의 분위기를 한 단위로 적용
- 코어 프리셋과 로컬 커스텀 스킨을 같은 방식으로 선택
- Hero/MainHero 같은 고난도 섹션도 스킨 팩 안에서 override 가능
- 이후 공유 가능한 구조 유지

## 디렉토리 구조

```text
src/skins/
├── clinicLight/
├── wellnessWarm/
├── dataDark/
├── hanbangClassic/
├── store/
│   └── linenBreeze/
│       ├── manifest.json
│       ├── skin.css
│       └── skin-package.json
└── local/
    └── my-clinic-skin/
        ├── manifest.json
        ├── skin.css
        └── sections/
            ├── Hero.astro
            └── MainHero.astro
```

## manifest.json 역할

- `defaults`: 기본 brandHue, rounding, density, mode
- `tokens`: accent, text, surface 같은 semantic token override
- `cssVars`: 세부 CSS 변수
- `sectionStyles`: 섹션 리듬/카드 톤 조정
- `componentRecipes`: step card, media frame, info panel 같은 하위 UI 레시피 방향
- `pageTemplates`: home landing, program detail 같은 페이지 골격 preset
- `pageTemplates`: blog list/detail, program list/detail 같은 페이지 골격 preset
- `overrides.sections`: 특정 섹션을 Astro 컴포넌트로 교체
- `stylesheet`: 스킨 전용 CSS 파일

## 자유도 범위

현재 스킨 시스템은 다음 순서로 강해집니다.

1. `tokens + cssVars`
   색상, 폰트, radius, density 같은 전역 분위기
2. `sectionStyles`
   Hero, Problem, Process, Gallery, YouTube, MiniDiagnosis 같은 섹션 표면
3. `componentRecipes`
   `stepCard`, `mediaFrame`, `diagnosisPanel`, `infoPanel` 같은 하위 패턴
4. `pageTemplates`
   `programDetail`, `homeLanding` 같은 페이지 골격 preset
5. `overrides.sections`
   특정 섹션 레이아웃/애니메이션을 Astro 컴포넌트로 완전 교체

주의:

- `pageTemplates` 는 현재 `homeLanding`, `blogList`, `blogDetail`, `programList`, `programDetail`, `reviewDetail`, `topicDetail`, `conditionDetail`, `faqDetail`, `noticeDetail` 에서 실제로 소비됩니다.
- 페이지 전체를 완전히 새 구조로 바꾸려면 여전히 `_local` 페이지 override가 필요할 수 있습니다.
- 목표는 `_local`로 바로 도망치지 않고, 가능한 한 `sectionStyles -> componentRecipes -> pageTemplates -> section override` 순서로 해결하는 것입니다.

## 로컬 스킨 생성

```bash
npm run skin:create -- --id editorial-clinic --extends clinicLight --dry-run --json
npm run skin:create -- --id editorial-clinic --extends clinicLight
npm run skin:check -- --id editorial-clinic --json
```

생성 후:

1. `manifest.json` 조정
2. `skin.css` 작성
3. `sectionStyles`, `componentRecipes`, `pageTemplates` 조정
4. 필요 시 `sections/Hero.astro`, `sections/MainHero.astro` 수정
5. `npm run skin:check -- --id editorial-clinic --json` 으로 manifest/override 검증
6. 관리자 `/admin/design` 의 multi-surface preview pack 에서 홈/hero/cards/info/blog/program/topic/faq/notice surface 확인
7. 관리자 `/admin/design` 에서 선택

## HQ curated 스킨 가져오기

로컬 워크스페이스에서는 HQ curated 및 승인된 community 스킨을 관리자에서 바로 설치할 수 있습니다.

1. `/admin/skins/store` 에서 카탈로그 확인
2. `HQ Curated` 또는 `Community` 표시가 있는 스킨 설치
3. 개발 서버 재시작
4. `/admin/design` 에서 선택

브라우저 설치는 내부적으로 다음 흐름을 탑니다.

- HQ `/api/skins` 카탈로그 조회
- `/api/skins/{id}/download` 로 package download
- 로컬 `src/skins/store/<skin-id>` 에 설치
- 설치 후 manifest 를 `source: "store"` 로 정규화

주의:

- 코어 스킨은 store 설치 대상이 아닙니다.
- 같은 ID 가 `local` 에 있으면 설치 차단됩니다.
- 브라우저 설치/제거는 로컬 개발 워크스페이스에서만 동작합니다.

에이전트가 터미널에서 직접 처리할 때는 다음 명령을 씁니다.

```bash
npm run skin:install -- --id linenBreeze --dry-run --json
npm run skin:install -- --id linenBreeze
npm run skin:remove -- --id linenBreeze --dry-run --json
npm run skin:remove -- --id linenBreeze
```

즉 HQ 스토어 스킨 도입은 두 경로가 있습니다.

- 로컬 관리자 `/admin/skins/store`
- 에이전트 터미널 명령 `skin:install -- --id <skin-id>`

## HQ 커뮤니티 스킨 제출

로컬에서 만든 스킨을 HQ 스토어 심사 큐로 올릴 수 있습니다.

```bash
npm run skin:submit -- --id editorial-clinic --source local --dry-run --json
npm run skin:submit -- --id editorial-clinic --source local
```

제출 흐름:

1. 로컬 skin pack 을 번들링
2. HQ `/api/skins/submit` 에 업로드
3. HQ 관리자 `/admin/skins/review` 큐에 등록
4. 승인 후 `/api/skins`, `/skins`, `/admin/skins/store` 에 노출

주의:

- core/HQ curated 스킨 ID 는 community 제출에 사용할 수 없습니다.
- 같은 skin ID 가 다른 개발자에게 이미 할당돼 있으면 제출이 거절됩니다.
- 첫 제출은 리뷰 큐로 가고, 이미 승인 이력이 있는 스킨의 새 버전은 바로 active 로 승격될 수 있습니다.

## 마스터 레포 로컬 HQ 스모크 테스트

마스터 레포에서도 `실제 라이선스 -> 제출 -> 승인 -> 설치` 흐름을 끝까지 검증할 수 있어야 합니다.

```bash
npm run skin:test:hq-local
```

이 명령은 다음을 자동으로 수행합니다.

1. 로컬 HQ D1 초기화
2. 테스트 라이선스 발급
3. 임시 local 스킨 생성
4. 로컬 HQ로 `skin:submit`
5. 로컬 HQ DB에서 승인 처리
6. 같은 라이선스로 `skin:install`
7. 설치 manifest 검증 후 테스트 산출물 정리

## 스킨 공유 번들

로컬에서 만든 skin pack 은 zip 번들로 공유하고, 받는 쪽에서는 `store` source 로 설치합니다.

```bash
npm run skin:bundle -- --id editorial-clinic --source local --dry-run --json
npm run skin:bundle -- --id editorial-clinic --source local
npm run skin:install -- --file dist-skins/editorial-clinic-skin-v1.0.0.zip --dry-run --json
npm run skin:install -- --file dist-skins/editorial-clinic-skin-v1.0.0.zip
```

번들 규칙:

- zip 루트에는 `manifest.json`, `skin.css`, `sections/**`, `README.md` 같은 스킨 파일만 포함
- `skin-package.json` 이 같이 들어가고, 설치 대상은 항상 `src/skins/store/<skin-id>`
- 설치 후 manifest 는 `source: "store"` 로 정규화
- 같은 ID 가 `src/skins/local/<skin-id>` 또는 코어에 있으면 설치 차단
- 같은 ID 의 store 설치본이 있으면 `--force` 로만 재설치

## 적용 흐름

1. 기존 클라이언트는 `theme_config.skinSystemVersion` 또는 `skinActivatedAt` 이 없으면 legacy-safe 모드로 유지
2. 관리자 디자인 설정을 저장하면 `theme_config.skin`, `skinSystemVersion=2`, `skinActivatedAt` 이 함께 저장
3. `BaseLayout` 이 v2 활성 상태일 때만 skin pack CSS 변수와 stylesheet를 주입
4. `SectionRenderer` 가 v2 활성 상태일 때만 현재 스킨의 섹션 override를 우선 적용
5. v2 비활성 상태에서는 기존 토큰/legacy 설정을 유지하고, pageTemplates/componentRecipes 는 generic fallback 으로 동작

## 추천 전략

- 느낌만 바꾸면 `tokens + skin.css`
- 섹션 리듬만 바꾸면 `sectionStyles`
- 프로그램 상세의 step/video/gallery/card 형태를 정리하려면 `componentRecipes`
- 같은 skin 안에서 `homeLanding`, `blogList`, `blogDetail`, `programList`, `programDetail`, `reviewDetail`, `topicDetail`, `conditionDetail`, `faqDetail`, `noticeDetail` 골격을 분리하려면 `pageTemplates`
- Hero 레이아웃이나 애니메이션이 달라지면 `sections/MainHero.astro`
- 특정 페이지 한 곳만 다르면 마지막에 `_local` 페이지 override

## skin:check 가 보는 것

- `manifest.json` 기본 필드 (`id`, `name`, `description`, `version`)
- `source` 와 실제 디렉토리 위치 일치 여부
- `extends` 대상 존재 여부 및 cycle
- `componentRecipes`, `pageTemplates` 객체 형식 여부
- `stylesheet`, `overrides.sections[].file` 파일 존재 여부
- 같은 skin id 를 `store/local` 이 override 하는 경우 경고
- 번들 설치 직후 store manifest 가 유효한지 재검증

## 관리자 미리보기 팩

`/admin/design` 은 단일 iframe 이 아니라 여러 surface 를 동시에 보여줍니다.

- `전체 페이지`: 전체 톤앤매너와 섹션 리듬
- `Hero Surface`: MainHero/Hero 레이아웃과 모션 방향
- `Card Surface`: Problem/Pricing 카드 밀도와 강조 톤
- `Info Surface`: 오시는 길/교통/진료시간 등 실사용 정보 블록
- `Blog List`: 콘텐츠 카드, 카테고리 칩, 소개 리듬
- `Program List`: 프로그램 리스트 카드, intro panel, CTA 모듈
- `Topic Detail`: 토픽 상세와 미니 배너 템플릿
- `FAQ Detail`: FAQ 상세와 sticky aside 템플릿
- `Notice Detail`: 공지 단일 컬럼 템플릿

## HQ 라이브러리와 로컬 스토어

HQ 공개 페이지와 로컬 관리자 페이지가 역할을 나눕니다.

- HQ:
  - `/skins` : 코어 + HQ curated + 승인된 community 카탈로그
  - `/skins/{skinId}` : 템플릿/recipe/override/명령 요약
  - `/admin/skins/review` : 커뮤니티 스킨 리뷰 큐
  - `/guide#vibe-skins` : 에이전트 드리븐 스킨 제작 가이드
  - `/guide#skin-sharing` : bundle/install 공유 흐름
- 로컬 관리자:
  - `/admin/design` : 적용, preview, theme config 저장
  - `/admin/skins/store` : HQ curated/community 스킨 설치/제거

이제 HQ는 스킨을 커뮤니티 제출/심사/승인 흐름으로 다룰 수 있습니다. 다만 평점/리뷰/상세 telemetry 는 플러그인 스토어만큼 깊게 붙어 있지 않습니다.

## Pencil MCP 기반 설계

Pencil MCP가 연결된 환경에서는 다음 순서로 쓰는 편이 좋습니다.

1. Pencil에서 원하는 분위기의 스타일 가이드나 preview frame을 만든다.
2. 결과를 `tokens -> sectionStyles -> componentRecipes -> pageTemplates` 순서로 번역한다.
3. Hero/MainHero처럼 구조가 큰 차이는 section override로 올린다.
4. `/admin/design` 과 `/demo/design-system?skin={skinId}` 에서 미리보기 surface를 비교한다.

핵심은 Pencil 시안을 바로 `_local` 페이지로 옮기지 않고, 먼저 skin pack 계약으로 흡수하는 것입니다.
