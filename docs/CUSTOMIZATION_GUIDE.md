# 홈페이지 커스터마이징 가이드
# Homepage Customization Guide

> AI 어시스턴트(Claude, ChatGPT 등)를 사용하여 홈페이지를 안전하게 커스터마이징하는 방법을 안내합니다.
>
> This guide helps you safely customize your homepage using AI assistants (Claude, ChatGPT, etc.).

---

## 목차 (Table of Contents)

1. [빠른 시작 (Quick Start)](#1-빠른-시작-quick-start)
2. [섹션 레퍼런스 (Section Reference)](#2-섹션-레퍼런스-section-reference)
3. [자연어 프롬프트 예시 (Natural Language Prompts)](#3-자연어-프롬프트-예시-natural-language-prompts)
4. [테스트 및 검증 (Testing & Validation)](#4-테스트-및-검증-testing--validation)
5. [문제 해결 (Troubleshooting)](#5-문제-해결-troubleshooting)
6. [커스텀 페이지 추가 (Adding Custom Pages)](#6-커스텀-페이지-추가-adding-custom-pages)
7. [플러그인 유형 비교 (Plugin Type Comparison)](#7-플러그인-유형-비교-plugin-type-comparison)
8. [업데이트 보존 (Update Preservation)](#8-업데이트-보존-update-preservation)
9. [안전 지침 (Safety Guidelines)](#9-안전-지침-safety-guidelines)

---

## 1. 빠른 시작 (Quick Start)

### 1.1 커스터마이징이란? (What is Customization?)

커스터마이징은 **코어 코드를 직접 수정하지 않고** 로컬 오버라이드 또는 플러그인을 통해 사이트를 변경하는 방법입니다.

**핵심 원칙:**
- 코어 파일 (`src/pages/`, `src/components/`)을 직접 수정하지 않습니다
- **기존 페이지 커스터마이징**: `src/pages/_local/`에 동일 경로로 파일을 만듭니다
- **새 기능/경로 추가**: `src/plugins/local/`에 플러그인을 만듭니다
- `core:pull` 업데이트 시 `_local/`과 플러그인은 보존됩니다

### 1.2 커스터마이징 위치 (Customization Location)

**방법 1: 기존 코어 페이지 커스터마이징 (페이지 오버라이드)**

기존 페이지를 수정하고 싶을 때는 `src/pages/_local/`에 동일한 경로 구조로 파일을 만듭니다.
Astro `_` prefix 컨벤션으로 라우팅에서 자동 제외되며, Vite 플러그인이 빌드/dev 시 자동으로 코어 페이지를 오버라이드합니다.

```
src/pages/doctors/index.astro              ← 코어 원본
src/pages/_local/doctors/index.astro       ← 로컬 오버라이드 (이게 우선)
```

```bash
# 예: 의료진 소개 페이지를 커스터마이징하려면
mkdir -p src/pages/_local/doctors
cp src/pages/doctors/index.astro src/pages/_local/doctors/index.astro
# src/pages/_local/doctors/index.astro를 수정
```

**방법 2: 홈페이지 커스터마이징 (플러그인 오버라이드)**

홈페이지(`/`)는 플러그인 Override 시스템을 사용합니다:

```
src/plugins/custom-homepage/  # 코어 제공 (수정하지 마세요)
src/plugins/local/custom-homepage/  # 로컬 커스터마이징 (여기서 작업하세요)
```

**방법 3: 새 페이지/기능 추가 (new-route 플러그인)**

완전히 새로운 페이지를 추가할 때는 `src/plugins/local/`에 플러그인을 만듭니다:

```
src/plugins/local/my-plugin/  # 새 기능 추가
```

### 1.3 기본 구조 이해 (Understanding Basic Structure)

**섹션 배열 (Sections Array):**
```javascript
const sections = [
    { type: "MainHero", ... },      // 히어로 섹션
    { type: "BridgeSection", ... }, // 연결 섹션
    { type: "ServiceTiles", ... },  // 서비스 타일
    // ...
];
```

**번역 객체 (Translation Object):**
```javascript
const tr = {
    hero: {
        title: {
            ko: "한국어 제목",
            en: "English Title",
        },
    },
};
```

### 1.4 시작하기 (Getting Started)

**Step 1:** 로컬 플러그인 폴더 생성 (없는 경우)
```bash
cp -r src/plugins/custom-homepage src/plugins/local/custom-homepage
```

**Step 2:** 파일 열기
```bash
# VS Code에서 열기
code src/plugins/local/custom-homepage/pages/index.astro
```

**Step 3:** 로컬 개발 서버 실행
```bash
npm run dev
```

**Step 4:** 브라우저에서 확인
```
http://localhost:4321
```

---

## 2. 섹션 레퍼런스 (Section Reference)

### 2.1 섹션 카테고리 (Section Categories)

#### Hero 섹션 (Hero Sections)

| 섹션 타입 | 설명 | 주요 용도 |
|-----------|------|----------|
| `MainHero` | 이미지 캐러셀 히어로 | 메인 비주얼 |
| `HeroSection` | 일반 히어로 | 단일 이미지 히어로 |
| `TelemedicineHeroSection` | 비대면 진료 히어로 | 원격 진료 페이지 |
| `PageIntroSection` | 페이지 소개 | 서브 페이지 헤더 |

#### Bridge & Narrative 섹션 (Bridge & Narrative)

| 섹션 타입 | 설명 | 주요 용도 |
|-----------|------|----------|
| `BridgeSection` | 히어로 연결 | 히어로와 본문 연결 |
| `NarrativeFlowSection` | 3단계 스토리텔링 | 문제-해결-결과 |

#### Content 섹션 (Content Sections)

| 섹션 타입 | 설명 | 주요 용도 |
|-----------|------|----------|
| `ProblemSection` | 문제 설명 | 통증/문제 제시 |
| `SolutionSection` | 해결책 설명 | 치료 방법 소개 |
| `MechanismSection` | 치료 메커니즘 | 원리 설명 |
| `ProcessSection` | 치료 프로세스 | 진료 과정 |
| `FeatureHighlightSection` | 특징 하이라이트 | 장점 강조 |
| `SolutionTypesSection` | 솔루션 유형 | 치료 종류 |
| `PhilosophySection` | 철학/약속 | 진료 철학 |

#### Listing 섹션 (Listing Sections)

| 섹션 타입 | 설명 | 주요 용도 |
|-----------|------|----------|
| `ServiceTilesSection` | 서비스 타일 그리드 | 주요 서비스 |
| `ProgramListSection` | 프로그램 목록 | 진료 프로그램 |
| `DoctorListSection` | 의사 목록 | 의료진 소개 |
| `DiagnosisListSection` | 진단 목록 | 질병 목록 |
| `TreatableConditionsSection` | 치료 가능 질환 | 적응증 |

#### Media 섹션 (Media Sections)

| 섹션 타입 | 설명 | 주요 용도 |
|-----------|------|----------|
| `GallerySection` | 이미지 갤러리 | 사진 갤러리 |
| `YouTubeSection` | 유튜브 임베드 | 비디오 소개 |

#### Info 섹션 (Info Sections)

| 섹션 타입 | 설명 | 주요 용도 |
|-----------|------|----------|
| `HomeInfoSection` | 홈 정보 | 진료시간/연락처/지도 |
| `FAQSection` | FAQ | 자주 묻는 질문 |
| `PricingSection` | 가격정보 | 진료비 안내 |
| `LocationMapSection` | 지도 | 위치 지도 |
| `TransportInfoSection` | 교통정보 | 오시는 길 |
| `BusinessHoursSection` | 진료시간 | 운영 시간 |

#### Related 섹션 (Related Sections)

| 섹션 타입 | 설명 | 주요 용도 |
|-----------|------|----------|
| `RelatedDiagnosisSection` | 관련 진단 | 연관 질환 |
| `RelatedReviewsSection` | 관련 후기 | 치료 후기 |
| `RelatedPostsSection` | 관련 게시글 | 블로그 포스트 |

#### Guide 섹션 (Guide Sections)

| 섹션 타입 | 설명 | 주요 용도 |
|-----------|------|----------|
| `StepGuideSection` | 단계 가이드 | 절차 안내 |
| `AdaptationPeriodSection` | 적응 기간 | 회복 기간 |
| `SideEffectsGridSection` | 부작용 그리드 | 주의사항 |
| `RulesChecklistSection` | 규칙 체크리스트 | 주의 사항 |

#### CTA 섹션 (CTA Sections)

| 섹션 타입 | 설명 | 주요 용도 |
|-----------|------|----------|
| `InquiryCTASection` | 문의 CTA | 예약/문의 버튼 |

#### Utility 섹션 (Utility Sections)

| 섹션 타입 | 설명 | 주요 용도 |
|-----------|------|----------|
| `RawHtmlSection` | HTML 삽입 | 커스텀 HTML |

### 2.2 섹션 상세 문서 (Section Details)

#### MainHero (메인 히어로)

**타입 ID:** `MainHero`

**용도:** 이미지 캐러셀을 사용하는 메인 히어로 섹션

**필수 Props:**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| data | object | 섹션 데이터 | - |

**선택적 Props (data 내부):**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| images | Array<{url, alt}> | 이미지 목록 | [] |
| mainHeading | string | 메인 제목 | "치유와 회복의 공간" |
| subHeading | string | 서브 제목 | "전통의 지혜와 현대한의학의 통합" |
| description | string | 설명 텍스트 | 기본 설명 |
| ctaText | string | CTA 버튼 텍스트 | "예약하기" |
| ctaLink | string | CTA 링크 | "/intake" |
| theme | "light" \| "dark" | 테마 | "dark" |

**사용 예시:**
```javascript
{
    type: "MainHero",
    images: [
        { url: "/images/hero/1.jpg", alt: "Clinic Interior" },
        { url: "/images/hero/2.jpg", alt: "Treatment Room" },
    ],
    mainHeading: "환영합니다",
    subHeading: "건강한 미래를 함께합니다",
    description: "최고의 의료 서비스를 제공합니다",
    ctaText: "진료 예약하기",
    ctaLink: "/intake",
    theme: "light",
}
```

#### BridgeSection (브릿지 섹션)

**타입 ID:** `BridgeSection`

**용도:** 히어로와 본문을 연결하는 텍스트 섹션

**필수 Props:**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| data | object | 섹션 데이터 | - |

**선택적 Props (data 내부):**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| title | string | 제목 | - |
| description | string | 설명 | - |

**사용 예시:**
```javascript
{
    type: "BridgeSection",
    title: "통증의 끝이 아닌, 건강한 일상의 시작입니다.",
    description: "체계적인 치료로 근본적인 회복을 돕습니다.",
}
```

#### NarrativeFlowSection (내러티브 플로우)

**타입 ID:** `NarrativeFlow`

**용도:** 3단계 스토리텔링 (문제-해결-결과)

**필수 Props:**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| data | object | 섹션 데이터 | - |

**선택적 Props (data 내부):**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| title | string | 제목 | - |
| subtitle | string | 서브타이틀 | - |
| steps | Array<{number, title, description}> | 단계 배열 | - |

**사용 예시:**
```javascript
{
    type: "NarrativeFlow",
    title: "왜 다시 아플까요?",
    subtitle: "근본적인 원인을 해결해야 일상이 바뀝니다.",
    steps: [
        {
            number: 1,
            title: "통증의 원인",
            description: "잘못된 자세와 습관으로 척추와 골반이 틀어집니다.",
        },
        {
            number: 2,
            title: "비수술적 교정",
            description: "추나 요법과 수기 치료로 관절의 위치를 되찾습니다.",
        },
        {
            number: 3,
            title: "재발 없는 건강",
            description: "근육과 인대를 강화하여 튼튼한 몸을 완성합니다.",
        },
    ],
}
```

#### ServiceTilesSection (서비스 타일)

**타입 ID:** `ServiceTiles`

**용도:** 서비스/기능을 타일 형태로 표시

**필수 Props:**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| data | object | 섹션 데이터 | - |

**선택적 Props (data 내부):**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| title | string | 섹션 제목 | "Medical Services" |
| subtitle | string | 섹션 부제 | "Please select a service." |
| items | Array<{link, icon, title, desc, bg}> | 타일 항목 | [] |

**items 배열 구조:**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| link | string | 링크 URL | - |
| icon | string | 아이콘 (이모지) | - |
| title | string | 타이틀 | - |
| desc | string | 설명 | - |
| bg | "soft" \| "white" | 배경색 | "soft" |

**사용 예시:**
```javascript
{
    type: "ServiceTiles",
    title: "주요 진료 과목",
    subtitle: "다양한 질환을 세심하게 진료합니다.",
    items: [
        {
            link: "/programs",
            icon: "🏥",
            title: "진료 안내",
            desc: "다양한 치료 프로그램",
            bg: "soft",
        },
        {
            link: "/reviews",
            icon: "💬",
            title: "치료 후기",
            desc: "환자분들의 솔직한 후기",
            bg: "white",
        },
        {
            link: "/intake",
            icon: "📅",
            title: "예약하기",
            desc: "간편한 온라인 예약",
            bg: "soft",
        },
    ],
}
```

#### PhilosophySection (철학 섹션)

**타입 ID:** `Philosophy`

**용도:** 진료 철학/약속 소개

**필수 Props:**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| data | object | 섹션 데이터 | - |

**선택적 Props (data 내부):**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| title | string | 제목 | - |
| subtitle | string | 배지 텍스트 | - |
| description | string | 본문 텍스트 | - |

**사용 예시:**
```javascript
{
    type: "Philosophy",
    title: "내 가족을 치료하는 마음으로 한 분 한 분께 정성을 다합니다.",
    subtitle: "이웃과 함께하는 정직한 진료",
    description: "우리 동네 가까운 곳에서 환자분들의 고통을 덜어드리고자 합니다.",
}
```

#### HomeInfoSection (홈 정보)

**타입 ID:** `HomeInfo`

**용도:** 진료시간, 연락처, 지도 통합 표시

**필수 Props:** 없음

**선택적 Props:** 없음 (모두 DB에서 자동 로드)

**사용 예시:**
```javascript
{
    type: "HomeInfo",
}
```

#### FAQSection (FAQ 섹션)

**타입 ID:** `FAQ`

**용도:** 자주 묻는 질문 표시

**필수 Props:**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| data | object | 섹션 데이터 | - |

**선택적 Props (data 내부):**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| title | string | 섹션 제목 | - |
| items | Array<{question, answer}> | FAQ 항목 | [] |

**사용 예시:**
```javascript
{
    type: "FAQ",
    title: "자주 묻는 질문",
    items: [
        {
            question: "예약은 어떻게 하나요?",
            answer: "온라인 예약 또는 전화로 예약 가능합니다.",
        },
        {
            question: "진료 시간은 어떻게 되나요?",
            answer: "평일 09:00-18:00, 토요일 09:00-13:00입니다.",
        },
    ],
}
```

#### YouTubeSection (유튜브 섹션)

**타입 ID:** `YouTube`

**용도:** 유튜브 영상 임베드

**필수 Props:**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| data | object | 섹션 데이터 | - |

**선택적 Props (data 내부):**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| videoId | string | 유튜브 비디오 ID | - |
| title | string | 섹션 제목 | - |

**사용 예시:**
```javascript
{
    type: "YouTube",
    videoId: "dQw4w9WgXcQ",
    title: "한의원 소개 영상",
}
```

#### GallerySection (갤러리 섹션)

**타입 ID:** `Gallery`

**용도:** 이미지 갤러리 표시

**필수 Props:**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| data | object | 섹션 데이터 | - |

**선택적 Props (data 내부):**

| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| title | string | 섹션 제목 | - |
| images | Array<{url, alt, caption}> | 이미지 배열 | [] |

**사용 예시:**
```javascript
{
    type: "Gallery",
    title: "시설 사진",
    images: [
        { url: "/images/gallery/1.jpg", alt: "Waiting Room", caption: "대기실" },
        { url: "/images/gallery/2.jpg", alt: "Treatment Room", caption: "진료실" },
    ],
}
```

### 2.3 Props 공통 규칙 (Common Props Rules)

**공통 Props:**
- `id` (string): 섹션 고유 ID (자동 생성)
- `programId` (string): 프로그램 ID (선택)
- `settings` (object): 클리닉 설정 (자동 전달)

**다국어 처리:**
```javascript
// T() 함수 사용
const title = T("hero", "title"); // tr.hero.title[locale]

// 직접 사용
const text = tr.hero.title.ko;
```

---

## 3. 자연어 프롬프트 예시 (Natural Language Prompts)

### 3.1 텍스트 변경 (Text Changes)

#### 프롬프트 1: 히어로 제목 변경

**프롬프트 (Prompt):**
```
"히어로 섹션의 제목을 '[병원명]에 오신 것을 환영합니다'로 변경해주세요"
```

**예상 결과 (Expected Result):**
```javascript
// 변경 전
mainHeading: "우리 가족을 위한 믿을 수 있는 동네 한의원"

// 변경 후
mainHeading: "[병원명]에 오신 것을 환영합니다"
```

#### 프롬프트 2: 섹션 설명 수정

**프롬프트 (Prompt):**
```
"NarrativeFlow 섹션의 첫 번째 단계 설명을 '잘못된 자세로 통증이 발생합니다'로 수정해주세요"
```

**예상 결과 (Expected Result):**
```javascript
// 변경 전
step1_desc: "잘못된 자세와 습관으로 틀어진 척추와 골반..."

// 변경 후
step1_desc: "잘못된 자세로 통증이 발생합니다"
```

#### 프롬프트 3: CTA 버튼 텍스트 변경

**프롬프트 (Prompt):**
```
"히어로 섹션의 예약 버튼 텍스트를 '상담 신청하기'로 변경해주세요"
```

**예상 결과 (Expected Result):**
```javascript
// 변경 전
ctaText: "진료 예약하기"

// 변경 후
ctaText: "상담 신청하기"
```

### 3.2 섹션 추가/삭제 (Section Add/Remove)

#### 프롬프트 4: 섹션 삭제

**프롬프트 (Prompt):**
```
"Philosophy 섹션을 삭제해주세요"
```

**예상 결과 (Expected Result):**
```javascript
// 변경 전
const sections = [
    { type: "MainHero", ... },
    { type: "Philosophy", ... },
    { type: "HomeInfo", ... },
];

// 변경 후
const sections = [
    { type: "MainHero", ... },
    { type: "HomeInfo", ... },
];
```

#### 프롬프트 5: FAQ 섹션 추가

**프롬프트 (Prompt):**
```
"HomeInfo 섹션 위에 FAQSection을 추가해주세요. FAQ 항목은 '예약 방법', '진료 시간' 2개를 포함해주세요"
```

**예상 결과 (Expected Result):**
```javascript
{
    type: "FAQ",
    title: "자주 묻는 질문",
    items: [
        { question: "예약은 어떻게 하나요?", answer: "온라인 또는 전화로 예약 가능합니다." },
        { question: "진료 시간은 어떻게 되나요?", answer: "평일 09:00-18:00입니다." },
    ],
}
```

### 3.3 레이아웃 변경 (Layout Changes)

#### 프롬프트 6: 섹션 순서 변경

**프롬프트 (Prompt):**
```
"섹션 순서를 변경해주세요. ServiceTiles를 Philosophy 위로 옮겨주세요"
```

**예상 결과 (Expected Result):**
```javascript
// 변경 전
const sections = [
    { type: "NarrativeFlow", ... },
    { type: "Philosophy", ... },
    { type: "ServiceTiles", ... },
];

// 변경 후
const sections = [
    { type: "NarrativeFlow", ... },
    { type: "ServiceTiles", ... },
    { type: "Philosophy", ... },
];
```

#### 프롬프트 7: 섹션 간격 조정

**프롬프트 (Prompt):**
```
"BridgeSection과 NarrativeFlow 사이에 공백을 추가해주세요" (Note: 이는 섹션 간 간격을 조정합니다)
```

### 3.4 이미지 교체 (Image Replacement)

#### 프롬프트 8: 히어로 이미지 변경

**프롬프트 (Prompt):**
```
"히어로 섹션의 이미지를 '/public/images/clinic-hero.jpg'로 변경해주세요"
```

**예상 결과 (Expected Result):**
```javascript
// 변경 전
images: [
    { url: "/images/hero/zen_hero_1.png", alt: "Zen Hero 1" },
]

// 변경 후
images: [
    { url: "/images/clinic-hero.jpg", alt: "Clinic Hero" },
]
```

#### 프롬프트 9: 갤러리 이미지 추가

**프롬프트 (Prompt):**
```
"GallerySection을 추가하고 '/public/images/gallery/' 폴더의 이미지들을 로드해주세요"
```

**예상 결과 (Expected Result):**
```javascript
{
    type: "Gallery",
    title: "시설 사진",
    images: [
        { url: "/images/gallery/clinic-1.jpg", alt: "Clinic 1" },
        { url: "/images/gallery/clinic-2.jpg", alt: "Clinic 2" },
    ],
}
```

### 3.5 다국어 추가 (Multilingual)

#### 프롬프트 10: 베트남어 번역 추가

**프롬프트 (Prompt):**
```
"히어로 섹션에 베트남어(vi) 번역을 추가해주세요. 제목은 'Chào mừng bạn đến phòng khám'"
```

**예상 결과 (Expected Result):**
```javascript
// 변경 전
hero: {
    title: {
        ko: "환영합니다",
        en: "Welcome",
    },
}

// 변경 후
hero: {
    title: {
        ko: "환영합니다",
        en: "Welcome",
        vi: "Chào mừng bạn đến phòng khám",
    },
}
```

### 3.6 복합 변경 (Complex Changes)

#### 프롬프트 11: 히어로 섹션 완전 변경

**프롬프트 (Prompt):**
```
"히어로 섹션을 변경해주세요:
- 제목: '건강의 시작, [병원명]'
- 부제: '여러분의 건강을 책임집니다'
- 설명: '전문 한의사가 정성을 다해 진료합니다'
- CTA: '진료 예약'
- 링크: '/reservation'
- 테마: dark"
```

#### 프롬프트 12: 서비스 타일 내용 변경

**프롬프트 (Prompt):**
```
"ServiceTiles의 항목을 변경해주세요:
1. 진료과목 -> '/programs', '🩺', '진료 안내', '모든 진료 프로그램 보기'
2. 의사 소개 -> '/doctors', '👨‍⚕️', '의료진', '전문 한의사 팀'
3. 오시는 길 -> '/location', '📍', '위치 안내', '찾아오시는 길'"
```

---

## 4. 테스트 및 검증 (Testing & Validation)

### 4.1 사전 테스트 체크리스트 (Pre-test Checklist)

**필수 항목 (Essential):**
- [ ] 로컬 개발 서버 실행 (`npm run dev`)
- [ ] 브라우저에서 http://localhost:4321 접속
- [ ] 모든 섹션이 렌더링되는지 확인
- [ ] 콘솔에 에러가 없는지 확인 (F12 → Console)
- [ ] 페이지 로딩 속도 확인

**반응형 테스트 (Responsive):**
- [ ] 모바일 (375px): iPhone SE
- [ ] 태블릿 (768px): iPad Mini
- [ ] 데스크톱 (1024px+): PC

**기능 테스트 (Functional):**
- [ ] 모든 링크가 정상 작동하는지 확인
- [ ] CTA 버튼이 올바른 페이지로 이동하는지 확인
- [ ] 이미지가 모두 로딩되는지 확인
- [ ] 캐러셀이 정상 작동하는지 확인

### 4.2 LLM 자동 검증 프롬프트 (LLM Auto-validation)

**검증 프롬프트:**
```
"다음 변경 사항을 검증해주세요:
1. 모든 섹션이 올바르게 렌더링되는지 확인
2. 콘솔 에러가 없는지 확인
3. 모든 링크가 작동하는지 확인
4. 반응형 레이아웃이 정상인지 확인
5. 다국어 텍스트가 올바르게 표시되는지 확인

문제가 있으면 원인과 해결 방법을 알려주세요."
```

### 4.3 수동 검증 절차 (Manual Validation)

**Step 1: 시각적 검사**
```bash
# 1. 로컬 서버 실행
npm run dev

# 2. 브라우저에서 열기
open http://localhost:4321

# 3. 각 섹션 확인
- 레이아웃이 깨지지 않는지
- 텍스트가 잘리지 않는지
- 이미지가 올바른 크기로 표시되는지
```

**Step 2: 콘솔 확인**
```javascript
// 브라우저 콘솔 (F12)에서 실행
console.log("Checking for errors...");

// 섹션 렌더링 확인
document.querySelectorAll('section').forEach((section, i) => {
    console.log(`Section ${i + 1}:`, section.className);
});
```

**Step 3: 네트워크 확인**
```bash
# 이미지 로딩 확인
# 개발자 도구 → Network → Images
# 모든 이미지가 200 OK 상태인지 확인
```

---

## 5. 문제 해결 (Troubleshooting)

### 5.1 섹션 렌더링 오류 (Section Rendering Errors)

#### 문제: 섹션이 화면에 보이지 않음

**증상 (Symptoms):**
- 섹션 화면에 표시 안됨
- 페이지에 공백만 표시

**원인 (Causes):**
- 섹션 타입 오타
- 필수 Props 누락
- 섹션 컴포넌트 임포트 실패

**해결 방법 (Solutions):**

1. **섹션 타입 확인**
```javascript
// 대소문자 구분 확인
// ❌ 잘못된 타입
{ type: "mainhero", ... }  // 소문자

// ✅ 올바른 타입
{ type: "MainHero", ... }  // PascalCase
```

2. **필수 Props 확인**
```javascript
// MainHero 필수 Props
{
    type: "MainHero",
    images: [...],           // 필수
    mainHeading: "...",      // 필수
}
```

3. **콘솔 에러 확인**
```bash
# 브라우저 콘솔 (F12)에서 에러 메시지 확인
# "Unknown section type: XXX" → 타입 오타
# "Cannot read property of undefined" → Props 누락
```

**LLM 진단 프롬프트:**
```
"왜 섹션이 렌더링되지 않나요? 다음을 확인해주세요:
1. 섹션 타입 오타
2. 필수 Props 누락
3. 브라우저 콘솔 에러 메시지"
```

### 5.2 Props 누락 (Missing Props)

#### 문제: TypeError: Cannot read property

**증상 (Symptoms):**
- 콘솔에 "Cannot read property 'XXX' of undefined" 에러
- 섹션이 부분적으로 렌더링됨

**원인 (Causes):**
- 필수 속성 누락
- 데이터 구조 불일치

**해결 방법 (Solutions):**

1. **기본값 추가**
```javascript
// 안전한 기본값 설정
const sections = [
    {
        type: "MainHero",
        images: data.images || [],
        mainHeading: data.mainHeading || "기본 제목",
    },
];
```

2. **옵셔널 체이닝**
```javascript
// 안전한 접근
const title = data?.mainHeading || "기본 제목";
```

### 5.3 다국어 텍스트 누락 (Missing Translations)

#### 문제: 일부 언어에서 텍스트가 보이지 않음

**증상 (Symptoms):**
- 영어에서는 정상 작동
- 일본어/중국어에서 텍스트 없음

**원인 (Causes):**
- 번역 키 누락
- locale 값 불일치

**해결 방법 (Solutions):**

1. **번역 키 확인**
```javascript
// 모든 언어에 번 추가
const tr = {
    hero: {
        title: {
            ko: "환영합니다",
            en: "Welcome",
            ja: "ようこそ",           // 추가
            "zh-hans": "欢迎",        // 추가
            vi: "Chào mừng",         // 추가
        },
    },
};
```

2. **폴백 값 설정**
```javascript
// T() 함수에 폴백
const T = (category, key) => {
    return tr[category][key][currentLocale] || tr[category][key]["en"] || "";
};
```

### 5.4 이미지 로딩 실패 (Image Loading Failure)

#### 문제: 이미지가 깨진 아이콘으로 표시됨

**증상 (Symptoms):**
- 이미지가 로딩되지 않음
- 404 Not Found 에러

**원인 (Causes):**
- 파일 경로 오타
- 파일이 존재하지 않음

**해결 방법 (Solutions):**

1. **파일 경로 확인**
```javascript
// ❌ 잘못된 경로
{ url: "/images/hero/1.jpg" }  // 파일 없음

// ✅ 올바른 경로
{ url: "/images/hero/zen_hero_1.png" }  // 실제 파일명
```

2. **파일 존재 확인**
```bash
# public/images/ 폴더 확인
ls -la public/images/hero/
```

### 5.5 스타일 깨짐 (Broken Styles)

#### 문제: 레이아웃이 깨져 보임

**증상 (Symptoms):**
- 요소들이 겹침
- 텍스트가 잘림
- 간격이 이상함

**원인 (Causes):**
- Tailwind 클래스 충돌
- 부모 요소 스타일 영향

**해결 방법 (Solutions):**

1. **캐시 초기화**
```bash
# 브라우저 캐시 삭제
# 또는 하드 리프레시 (Ctrl+Shift+R / Cmd+Shift+R)
```

2. **스타일 오버라이드 확인**
```javascript
// 커스텀 스타일이 있는 경우 확인
<style>
    /* 섹션별 스타일 오버라이드 */
</style>
```

### 5.6 링크 작동 불가 (Broken Links)

#### 문제: 링크 클릭 시 404 에러

**증상 (Symptoms):**
- 링크를 클릭하면 페이지를 찾을 수 없음
- CTA 버튼이 작동하지 않음

**원인 (Causes):**
- URL 경로 오타
- localizedPath 미사용

**해결 방법 (Solutions):**

1. **다국어 경로 사용**
```javascript
// ❌ 잘못된 방식
{ link: "/programs" }

// ✅ 올바른 방식
{ link: localizedPath("/programs") }
```

2. **경로 확인**
```bash
# 실제 페이지 경로 확인
ls src/pages/
```

### 5.7 반응형 레이아웃 문제 (Responsive Issues)

#### 문제: 모바일에서 레이아웃이 깨짐

**증상 (Symptoms):**
- 모바일에서 요소들이 겹침
- 텍스트가 넘침

**해결 방법 (Solutions):**

1. **브라우저 개발자 도구로 테스트**
```bash
# F12 → 토글 도구 모음 → 반응형 모드
# 모바일 (375px)에서 확인
```

2. **Tailwind 반응형 클래스 확인**
```html
<!-- md: 이상 적용 -->
<div class="text-sm md:text-base">
```

### 5.8 로컬 개발 서버 문제 (Dev Server Issues)

#### 문제: npm run dev가 실패함

**증상 (Symptoms):**
- "Error: Cannot find module"
- Port 4321 이미 사용 중

**해결 방법 (Solutions):**

1. **종료된 프로세스 확인**
```bash
# 포트 확인
lsof -i :4321

# 프로세스 종료
kill -9 [PID]
```

2. **의존성 재설치**
```bash
rm -rf node_modules
npm install
```

---

## 6. 커스텀 페이지 추가 (Adding Custom Pages)

### 6.1 new-route 플러그인이란? (What is new-route Plugin?)

**new-route 플러그인**은 `/ext/{plugin-id}` 경로로 새로운 페이지를 추가하는 방법입니다.

**특징:**
- 새로운 URL 경로 생성
- 코어 페이지와 충돌하지 않음
- `core:pull` 시 보존됨 (local 폴더 사용 시)

### 6.2 플러그인 생성 절차 (Plugin Creation Steps)

#### Step 1: 플러그인 디렉토리 생성

```bash
# src/plugins/local/ 폴더에서 작업 (보호됨)
mkdir -p src/plugins/local/doctor-profile
cd src/plugins/local/doctor-profile
```

#### Step 2: manifest.json 생성

```json
{
  "id": "doctor-profile",
  "name": "의사 프로필 페이지",
  "description": "각 의사의 상세 프로필 페이지",
  "version": "1.0.0",
  "author": "clinic-name",
  "type": "new-route",
  "category": "customization",
  "routes": {
    "base": "/ext/doctor-profile",
    "public": [
      {
        "path": "/",
        "file": "pages/index.astro",
        "title": "의사진 소개"
      },
      {
        "path": "/:doctorId",
        "file": "pages/[doctorId].astro",
        "title": "의사 상세 프로필"
      }
    ]
  }
}
```

#### Step 3: 페이지 컴포넌트 작성

**pages/index.astro (목록):**
```astro
---
import BaseLayout from "../../../components/layout/BaseLayout.astro";
import { getClinicSettings } from "../../../lib/clinic";

const { settings, db } = Astro.props;
const clinicName = settings.name || "Clinic OS";
---

<BaseLayout title="의사진 소개 - {clinicName}">
    <div class="page-container py-16">
        <h1 class="text-4xl font-bold mb-8">의사진 소개</h1>
        <!-- 의사 목록 표시 -->
    </div>
</BaseLayout>
```

**pages/[doctorId].astro (상세):**
```astro
---
import BaseLayout from "../../../components/layout/BaseLayout.astro";

const { settings, db, path } = Astro.props;
const doctorId = path.split('/')[0];
---

<BaseLayout title="의사 프로필">
    <div class="page-container py-16">
        <h1>의사 ID: {doctorId}</h1>
        <!-- 의사 상세 정보 표시 -->
    </div>
</BaseLayout>
```

### 6.3 URL 경로 구조 (URL Path Structure)

```
/ext/doctor-profile          → pages/index.astro
/ext/doctor-profile/dr-kim   → pages/[doctorId].astro (doctorId = "dr-kim")
/ext/doctor-profile/dr-lee   → pages/[doctorId].astro (doctorId = "dr-lee")
```

### 6.4 실제 예시 시나리오 (Example Scenarios)

#### 시나리오 1: 진료소 소개 페이지

```json
{
  "id": "clinic-intro",
  "name": "진료소 소개",
  "type": "new-route",
  "routes": {
    "base": "/ext/clinic-intro",
    "public": [
      {
        "path": "/",
        "file": "pages/index.astro",
        "title": "진료소 소개"
      }
    ]
  }
}
```

**URL:** `/ext/clinic-intro`

#### 시나리오 2: 상담 예약 페이지

```json
{
  "id": "consultation-booking",
  "name": "상담 예약",
  "type": "new-route",
  "routes": {
    "base": "/ext/booking",
    "public": [
      {
        "path": "/",
        "file": "pages/index.astro",
        "title": "상담 예약"
      },
      {
        "path": "/confirm",
        "file": "pages/confirm.astro",
        "title": "예약 확인"
      }
    ]
  }
}
```

**URL:** `/ext/booking/`, `/ext/booking/confirm`

### 6.5 페이지 컴포넌트 작성 가이드 (Page Component Guide)

**기본 구조:**
```astro
---
// 1. 필수 임포트
import BaseLayout from "../../../components/layout/BaseLayout.astro";
import { getClinicSettings } from "../../../lib/clinic";
import SectionRenderer from "../../../components/common/SectionRenderer.astro";

// 2. Props 수신
const { settings, db, path, url, request } = Astro.props;

// 3. 데이터 로드
const clinicName = settings.name || "Clinic OS";

// 4. 섹션 정의
const sections = [
    { type: "PageIntroSection", ... },
    // ...
];
---

<!-- 5. 렌더링 -->
<BaseLayout title={clinicName}>
    <SectionRenderer sections={sections} settings={settings} />
</BaseLayout>
```

---

## 7. 플러그인 유형 비교 (Plugin Type Comparison)

### 7.1 플러그인 유형 비교표 (Plugin Type Comparison Table)

| 항목 | new-route | override |
|------|-----------|----------|
| **목적** | 새로운 페이지 추가 | 기존 페이지 교체 |
| **URL 경로** | `/ext/{plugin-id}` | 원본 경로 유지 |
| **Priority** | 5 (기본) | 10 (높음) |
| **충돌 처리** | 독립 경로로 충돌 없음 | 기존 페이지 대체 |
| **사용 사례** | 진료소 소개, 의사 프로필 | 홈페이지 완전히 변경 |
| **manifest 필드** | `routes` | `overrides` |

### 7.2 선택 결정 트리 (Selection Decision Tree)

```
1. 새로운 페이지를 추가하나요?
   ├── YES → new-route 사용
   └── NO → 2번으로

2. 기존 페이지를 완전히 교체하나요?
   ├── YES → override 사용
   └── NO → new-route로 새 페이지 만들기
```

### 7.3 사용 사례별 예시 (Use Case Examples)

#### new-route 사용 예시:

- **진료소 소개 페이지:** `/ext/clinic-intro`
- **의사 프로필:** `/ext/doctor-profile/dr-kim`
- **상담 예약:** `/ext/booking`
- **이벤트 페이지:** `/ext/event summer-special`

#### override 사용 예시:

- **홈페이지 완전히 변경:** `/` (root)
- **특정 코어 페이지 교체:** 코어가 제공하는 Override Point만 가능

### 7.4 충돌 처리 방식 (Conflict Resolution)

#### new-route:
- 독립적인 `/ext/` 경로 사용
- 다른 플러그인과 경로 충돌 없음
- 여러 new-route 플러그인 동시 사용 가능

#### override:
- priority가 높은 플러그인이 우선
- 동일 priority 시 경고 메시지
- 코어가 제공하는 Override Point에서만 작동

**Override Points (코어 제공):**
- `/` - 메인 홈페이지

---

## 8. 업데이트 보존 (Update Preservation)

### 8.1 보호된 위치 (Protected Locations)

다음 위치의 파일은 `core:pull` 업데이트 시 **절대 수정되지 않습니다.**

```bash
src/pages/_local/         # 로컬 페이지 오버라이드
src/plugins/local/        # 로컬 클라이언트 플러그인
src/survey-tools/local/   # 로컬 검사도구
src/lib/local/           # 로컬 유틸리티
public/local/            # 로컬 에셋
```

### 8.2 4레벨 필터 시스템 (4-Level Filter System)

#### Level 1: LOCAL_PREFIXES

`local/` 또는 `_local/` 접두사 파일은 항상 보존됩니다.

**적용 대상:**
- `src/pages/_local/` - 페이지 오버라이드 파일
- `src/lib/local/` - 모든 파일
- `src/plugins/local/` - 모든 파일
- `src/survey-tools/local/` - 모든 파일
- `public/local/` - 모든 파일

#### Level 2: PROTECTED_EXACT

정확히 일치하는 파일은 백업 후 복원됩니다.

**적용 대상:**
- `wrangler.toml` - 클라이언트 D1/R2 설정
- `clinic.json` - 클라이언트 서명 파일
- `.docking/config.yaml` - 클라이언트 인증 정보

#### Level 3: LOCAL_PATH_PARTS

경로에 `local`이 포함된 파일이 보존됩니다.

#### Level 4: CORE_REPLACEMENTS

코어 파일만 교체됩니다.

**적용 대상:**
- `src/pages/` - 코어 페이지
- `src/components/` - 코어 컴포넌트
- `src/layouts/` - 코어 레이아웃
- `src/styles/` - 코어 스타일

### 8.3 보존 규칙 (Preservation Rules)

| 규칙 | 설명 |
|------|------|
| **local 접두사** | `local/` 접두사 파일은 절대 수정되지 않음 |
| **PROTECTED_EXACT** | 정확히 일치하는 파일은 백업 후 복원 |
| **코어 파일** | CORE_PATHS에 있는 파일만 업데이트 대상 |

### 8.4 업데이트 후 확인 체크리스트 (Post-update Checklist)

**필수 확인:**
- [ ] `src/plugins/local/` 내 파일 확인
- [ ] 커스텀 홈페이지 정상 작동 확인
- [ ] 커스텀 페이지 접근 가능 확인 (`/ext/*`)
- [ ] 다국어 설정 유지 확인
- [ ] 로컬 에셋 로딩 확인

### 8.5 충돌 처리 (Conflict Handling)

**충돌 감지 시:**
1. `.core-backup/<timestamp>/`에 백업 생성
2. 마이그레이션 가이드 출력
3. "백업 확인하고 local로 이전해주세요" 메시지

**충돌 해결:**
```bash
# 1. 백업 확인
ls .core-backup/

# 2. 백업 내용을 local/로 이전
cp -r .core-backup/[timestamp]/* src/plugins/local/

# 3. git add & commit
git add src/plugins/local/
git commit -m "migrate: core files to local"
```

---

## 9. 안전 지침 (Safety Guidelines)

### 9.1 안전 지침 테이블 (Safety Guidelines Table)

| 작업 유형 | 위치 | 안전성 | 업데이트 영향 | 롤백 방법 |
|----------|------|--------|---------------|-----------|
| 페이지 오버라이드 | `src/pages/_local/` | ✅ 안전 | 보존됨 | 파일 삭제 |
| 섹션 데이터 수정 | `local/` 플러그인 | ✅ 안전 | 보존됨 | Git revert |
| 새 페이지 추가 | `local/` 플러그인 | ✅ 안전 | 보존됨 | 플러그인 삭제 |
| 다국어 추가 | `tr` 객체 | ✅ 안전 | 보존됨 | 번역 삭제 |
| 로컬 에셋 추가 | `public/local/` | ✅ 안전 | 보존됨 | 파일 삭제 |
| 코어 파일 수정 | `src/` 코어 | ⚠️ 위험 | 덮어씌워짐 | 재설치 필요 |
| `node_modules` 수정 | `node_modules/` | ⚠️ 위험 | 삭제됨 | 재설치 필요 |
| 빌드 결과 수정 | `dist/` | ⚠️ 위험 | 삭제됨 | 재빌드 필요 |

### 9.2 안전한 작업 (Safe Operations)

**✅ 안전 (Safe):**

1. **섹션 데이터 수정**
```javascript
// src/plugins/local/custom-homepage/pages/index.astro
const sections = [
    { type: "MainHero", ... },  // 안전
];
```

2. **새 페이지 추가**
```bash
# src/plugins/local/my-page/
mkdir -p src/plugins/local/my-page/pages
```

3. **다국어 추가**
```javascript
const tr = {
    hero: {
        title: {
            ko: "환영합니다",
            vi: "Chào mừng",  // 추가 안전
        },
    },
};
```

4. **로컬 에셋**
```bash
# public/local/images/
cp my-photo.jpg public/local/images/
```

### 9.3 위험한 작업 (Unsafe Operations)

**⚠️ 위험 (Unsafe):**

1. **코어 파일 직접 수정**
```bash
# ❌ 위험
# src/pages/index.astro 수정
# src/components/sections/ 수정
```

2. **node_modules 수정**
```bash
# ❌ 위험
# node_modules/ 내부 파일 수정
```

3. **빌드 결과물 수정**
```bash
# ❌ 위험
# dist/ 내부 파일 수정
```

### 9.4 권장 패턴 (Recommended Patterns)

**1. 항상 `local/` 디렉토리 내에서 작업**
```bash
# ✅ 좋은 예
src/plugins/local/my-plugin/

# ❌ 나쁜 예
src/plugins/my-plugin/  # 코어에서 덮어씌워짐
```

**2. SectionRenderer의 선언적 구성 사용**
```javascript
// ✅ 좋은 예
const sections = [
    { type: "MainHero", ... },
];

// ❌ 나쁜 예
// 직접 HTML 작성 (복잡함 증가)
```

**3. 기존 섹션 재사용**
```javascript
// ✅ 좋은 예
// 기존 섹션 타입 활용
{ type: "FAQ", items: [...] }

// ❌ 나쁜 예
// 새로운 섹션 컴포넌트 직접 작성
```

**4. Git을 사용한 변경 사항 추적**
```bash
# 변경 전 커밋
git add .
git commit -m "before: customization"

# 커스터마이징 후 커밋
git add .
git commit -m "feat: customize homepage"
```

### 9.5 롤백 방법 (Rollback Methods)

**안전한 작업 롤백:**
```bash
# Git revert
git revert HEAD

# 또는 이전 커밋으로
git reset --hard HEAD~1
```

**위험한 작업 복구:**
```bash
# 코어 재설치
npm run core:pull

# 전체 프로젝트 재설치 (최후 수단)
# starter-kit.zip 다시 설치
```

---

## 10. 참고 문서 (References)

### 10.1 관련 문서 (Related Documentation)

| 문서 | 위치 | 용도 |
|------|------|------|
| `AI-QUICK-REFERENCE.md` | `/docs/` | AI 퀵 레퍼런스 |
| `PLUGIN_DEVELOPMENT_GUIDE.md` | `/docs/` | 플러그인 개발 |
| `LOCAL_GIT_ARCHITECTURE.md` | `/docs/` | Git 아키텍처 |
| `custom-homepage/README.md` | `/src/plugins/custom-homepage/` | 플러그인 README |

### 10.2 지원 및 피드백 (Support & Feedback)

**문제 신고:**
- GitHub Issues: [clinic-os repo]
- 이메일: support@clinic-os.com

**피드백:**
- 문서 개선 제안 환영
- 사용 사례 공환 환영

---

**문서 버전:** 1.0.0
**마지막 업데이트:** 2026-02-08
**상태:** Active
