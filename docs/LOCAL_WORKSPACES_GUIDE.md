---
hq_slug: local-workspaces
hq_title: "로컬 작업 공간 선택 가이드"
hq_category: "06. 설치와 환경"
hq_sort: 26
hq_active: true
---
# 로컬 작업 공간 선택 가이드

Clinic-OS를 받은 뒤 로컬에서 작업할 때 가장 중요한 것은 **어디를 고쳐야 하는지**를 먼저 고르는 것입니다.

사용자는 보통 자연어로 요청하고, 에이전트가 아래 표를 기준으로 적절한 작업 공간을 선택하면 됩니다.

## 한눈에 보기

| 요청 유형 | 권장 위치 | 예시 |
|----------|----------|------|
| 기존 공개 페이지 레이아웃/문구 수정 | `src/pages/_local/` | 소개 페이지, location, doctors |
| 병원 전용 helper/adapter | `src/lib/local/` | 외부 API formatter, 문구 helper |
| 새 기능/새 경로/새 관리자 탭 | `src/plugins/local/` | VIP 관리, 리포트, 통합 기능 |
| 자가진단/설문/검사 결과 페이지 | `src/survey-tools/local/` | 스트레스 검사, 문진 |
| 로고/파비콘/OG 이미지 | `public/local/` | logo.png, og-image.jpg |
| 내부 메모/복구 기록 | `docs/internal/` | 감사, 운영 런북 |

## 1. `src/pages/_local/`

기존 코어 퍼블릭 페이지를 병원별로 다르게 보여줘야 할 때 사용합니다.

예:

```text
src/pages/doctors/index.astro
→ src/pages/_local/doctors/index.astro
```

좋은 요청 예:

- "의료진 소개 페이지 문구를 우리 한의원에 맞게 바꿔줘"
- "location 페이지에 주차 안내 섹션을 추가해줘"

## 2. `src/lib/local/`

로컬 페이지, 플러그인, 검사도구가 함께 쓸 작은 helper와 adapter를 둘 때 사용합니다.

좋은 요청 예:

- "이 외부 API 응답을 우리 병원 형식으로 변환하는 helper 만들어줘"
- "로컬 배너 문구를 조합하는 util 만들어줘"

## 3. `src/plugins/local/`

기존 페이지 수정이 아니라 **독립된 기능**이 필요할 때 사용합니다.

좋은 요청 예:

- "VIP 환자 전용 관리 기능을 추가해줘"
- "새 관리자 탭과 API가 필요한 기능을 만들어줘"

기본 시작:

```bash
npm run plugin:create -- --id=my-plugin --type=new-route --with-admin --dry-run --json
```

## 4. `src/survey-tools/local/`

검사도구, 자가진단, 설문처럼 `/ext/survey-tools/{toolId}` 로 열리는 흐름이 필요할 때 사용합니다.

좋은 요청 예:

- "불면 자가진단 도구를 만들어줘"
- "환자에게 보낼 스트레스 체크 링크를 만들고 결과 페이지도 같이 만들어줘"

권장 시작:

```bash
npm run survey-tool:create -- --id insomnia-check --mode manifest --dry-run --json
```

## 5. `public/local/`

코드에서 직접 참조하는 정적 파일을 둘 때 사용합니다.

좋은 요청 예:

- "로고 파일을 교체해줘"
- "OG 이미지와 favicon을 추가해줘"

주의:

- 관리자에서 업로드하는 의료진 사진/블로그 이미지와는 다릅니다.
- 관리자 업로드는 Cloudflare R2 영역입니다.

## 6. `docs/internal/`

배포용 콘텐츠가 아니라 에이전트와 운영자를 위한 내부 메모 공간입니다.

좋은 요청 예:

- "이번 복구 과정을 문서로 남겨줘"
- "다음 업데이트 전에 확인할 체크리스트 만들어줘"

## 에이전트에게 이렇게 요청하면 됩니다

- "이 요청이 `_local` 인지 플러그인인지 먼저 분류해줘"
- "로컬 작업 공간 중 어디가 맞는지 판단하고 거기에만 수정해줘"
- "정적 자산이면 `public/local`, 관리자 업로드면 R2로 구분해서 처리해줘"
- "검사도구면 survey-tools 흐름으로 만들어줘"
