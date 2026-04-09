# SEO & Marketing Settings (/admin/settings/seo) — 투어 시나리오

## 페이지 목적
검색 엔진 최적화(SEO), 소셜미디어 미리보기(Open Graph), 마케팅 추적 도구(GA/Meta/Naver/Kakao)를 통합 관리합니다.

## 시나리오 (8 스텝)

### Step 1: 사이트맵 정보 확인
- **title**: 사이트맵 등록 안내
- **text**: 사이트맵 인덱스 방식을 사용하므로 검색 엔진(Google, Naver)에는 아래 하나의 주소만 제출하면 됩니다. 주소 복사 버튼으로 복사한 후 Google Search Console, Naver 웹마스터 도구에 제출하세요.
- **highlight**: `.bg-indigo-50.rounded-2xl.border.border-indigo-100`
- **trigger**: none
- **tips**:
  - 사이트맵 URL: https://YOUR_DOMAIN/sitemap.xml
  - 하위 사이트맵(posts, knowledge 등)은 검색 로봇이 자동 수집
  - 별도로 등록할 필요 없음
  - Sitemap Index를 통해 대규모 콘텐츠 처리
- **buttons**:
  - `주소 복사 / 사이트맵 URL 복사 / Google/Naver 웹마스터에 제출`

### Step 2: 기본 SEO 설정 - 제목 접미사
- **title**: 사이트 제목 접미사 설정
- **text**: "사이트 제목 접미사"는 모든 페이지 제목 뒤에 자동으로 추가됩니다. 예를 들어 "| 강남 한의원"으로 설정하면 "진료안내 | 강남 한의원" 형식으로 검색 결과에 표시됩니다.
- **highlight**: `#inputTitleSuffix`
- **trigger**: none
- **tips**:
  - 예: "| Clinic Name" 또는 "- 강남 한의원"
  - 전체 제목은 60글자 이내 권장 (검색 결과 잘림 방지)
  - 지역명 포함 권장 (Local SEO)
  - 모든 페이지에 일관되게 적용
- **buttons**:
  - `#inputTitleSuffix / 제목 접미사 입력 / 예: | 강남 한의원`

### Step 3: 기본 SEO 설정 - 메타 설명
- **title**: 기본 메타 설명 입력
- **text**: "기본 메타 설명"은 페이지별 특화 설명이 없을 때 기본으로 사용됩니다. 검색 결과에 제목 아래 표시되므로 100-160글자로 명확하고 설득력 있게 작성하세요.
- **highlight**: `#inputMetaDesc`
- **trigger**: none
- **tips**:
  - 100-160글자 권장 (초과 시 검색 결과에서 잘림)
  - 주요 키워드 포함 (예: "한의원", "한의학 치료", "지역명")
  - 고객에게 어필할 수 있는 내용 (USP)
  - 자연스러운 문장으로 작성
- **buttons**:
  - `#inputMetaDesc / 메타 설명 입력 / 사이트 전체 기본 설명`

### Step 4: 기본 SEO 설정 - 타겟 지역
- **title**: Local SEO 타겟 지역 설정
- **text**: "타겟 지역"은 Local SEO의 핵심입니다. "서울 강남구" 같은 지역명을 입력하면 이 정보가 모든 페이지 제목과 설명에 반영되어 지역 검색 최적화를 돕습니다.
- **highlight**: `#inputRegion`
- **trigger**: none
- **tips**:
  - 예: "서울 강남구" 또는 "강남 한의원"
  - 정확한 지역명 입력 (지역 검색 순위 향상)
  - 한곳만 입력 (여러 지점이면 분리 필요)
  - 주소와 일치하면 더 효과적
- **buttons**:
  - `#inputRegion / 타겟 지역 입력 / 예: 서울 강남구`

### Step 5: Open Graph (SNS) - OG 설정
- **title**: 소셜미디어 공유 설정
- **text**: "OG 사이트명"에 병원/클리닉 이름을 입력하면 카카오톡, 페이스북 등에 공유될 때 표시됩니다. "OG 기본 이미지"는 공유 시 나타나는 썸네일(1200x630)입니다.
- **highlight**: `.space-y-5`
- **trigger**: none
- **tips**:
  - OG 사이트명: 병원 정식명 또는 약칭
  - OG 이미지: 1200x630px, PNG/JPG 권장
  - 페이지별 특화 이미지가 없으면 이 기본값 사용
  - 카카오톡 미리보기로 확인 후 저장
- **buttons**:
  - `#inputOgSiteName / OG 사이트명 / 예: Clinic Name`
  - `input[name="seo.og_image"] / OG 이미지 업로드 / 1200x630 이미지`

### Step 6: OG 타입 및 추적 도구 설정
- **title**: OG 타입 및 분석 도구 연결
- **text**: "OG 타입"은 웹사이트 타입으로 대부분 "Website"로 설정합니다. "추적 및 분석 도구" 섹션에서 Google Analytics, Meta Pixel, Naver Analytics, Kakao Pixel ID를 입력하면 방문자 행동을 추적할 수 있습니다.
- **highlight**: `.grid.md\\:grid-cols-2.gap-4`
- **trigger**: none
- **tips**:
  - OG 타입: Website(기본) 또는 Article
  - GA ID: G-로 시작하는 측정 ID (예: G-XXXXXXXXXX)
  - Meta Pixel ID: 13-15자리 숫자
  - Naver Analytics: s_로 시작하는 ID (예: s_xxxxx)
  - Kakao Pixel: Kakao 비즈니스에서 발급
  - 모든 항목은 선택사항
- **buttons**:
  - `select[name="seo.og_type"] / OG 타입 / Website 또는 Article`
  - `input[name="tracking.ga_measurement_id"] / GA ID / Google Analytics 측정 ID`
  - `input[name="tracking.meta_pixel_id"] / Meta Pixel ID / Facebook 픽셀 ID`
  - `input[name="tracking.naver_analytics_id"] / Naver Analytics / 네이버 애널리틱스 ID`
  - `input[name="tracking.kakao_pixel_id"] / Kakao Pixel / 카카오 픽셀 ID`

### Step 7: SEO 디버거 - 페이지 검사
- **title**: SEO 디버거로 페이지 검사
- **text**: 우측 "SEO 디버거" 섹션에서 검사할 페이지 경로(예: /programs/neuro)를 입력하고 "검사" 버튼을 클릭하면, 해당 페이지의 OG 태그를 실시간으로 분석하여 Google 검색 미리보기와 KakaoTalk 미리보기로 표시합니다.
- **highlight**: `.bg-slate-900.rounded-2xl.p-6.shadow-xl`
- **trigger**: click
- **tips**:
  - 경로 형식: /programs/neuro (슬래시부터 시작)
  - 또는 전체 URL: https://example.com/programs
  - 검사 결과는 실시간으로 미리보기 업데이트
  - 지역명 적용 여부 확인 가능
  - Debug Info 패널에서 정확한 태그값 확인
- **buttons**:
  - `#debugUrl / 검사할 경로 입력 / 페이지 경로 또는 전체 URL`
  - `#btnDebug / 검사 버튼 / OG 태그 분석 및 미리보기`

### Step 8: 미리보기 및 저장
- **title**: 미리보기 확인 및 설정 저장
- **text**: 좌측 "Google Search Preview"에서 검색 결과 미리보기를, 우측 "KakaoTalk Preview"에서 카카오톡 공유 미리보기를 확인합니다. 모든 설정을 완료한 후 상단 "설정 저장" 버튼을 클릭하여 변경 사항을 저장합니다.
- **highlight**: `.lg\\:col-span-5.space-y-8`
- **trigger**: click
- **tips**:
  - Google 미리보기: 검색 결과 표시 형식
  - Kakao 미리보기: 카카오톡 공유 시 표시 형식
  - 이미지가 없으면 기본값 사용
  - 저장 전에 미리보기로 최종 확인 권장
  - 저장 후 모든 페이지에 적용됨
- **buttons**:
  - `button[form="seoForm"] / 설정 저장 / 모든 SEO 및 추적 설정 저장`
