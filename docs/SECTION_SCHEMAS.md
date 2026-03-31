# Section Component Schemas

> **Purpose**: Canonical reference for agents and skills generating section JSON.
> Every section stored in `programs.sections` or `homepage_sections.sections` JSON column
> must conform to the schemas below. Using the wrong shape will render nothing or crash.
>
> **SOT**: The actual `interface Props` in each `.astro` file. This doc is a derivative.
> If this doc conflicts with the component code, the code wins.

## How Sections Work

### Storage
```
programs.sections       → JSON array of section objects
homepage_sections       → JSON array of section objects (homepage)
page_sections           → JSON array of section objects (custom pages)
```

### Rendering Pipeline
```
DB JSON → page route (e.g. programs/[id].astro)
       → SectionRenderer.astro
       → components map: section.type → Component
       → <Component data={section} skin={...} index={...} />
```

### Section Object Shape
Every section in the JSON array **must** have:
```jsonc
{
  "type": "SectionTypeKey",  // Required — maps to component (see Type Keys below)
  "id": "optional-anchor",  // Optional — HTML anchor id
  // ... type-specific data fields (passed as `data` prop)
}
```

The entire section object is passed as the `data` prop to the component.

---

## Type Key Reference

| Type Key | Aliases | Component | Category |
|----------|---------|-----------|----------|
| `Hero` | `hero` | HeroSection | Program |
| `Problem` | `problem` | ProblemSection | Program |
| `Solution` | `solution` | SolutionSection | Program |
| `Mechanism` | `mechanism` | MechanismSection | Program |
| `Process` | `process` | ProcessSection | Program |
| `TreatableConditions` | `treatable` | TreatableConditionsSection | Program |
| `Gallery` | `gallery` | GallerySection | Program |
| `Pricing` | `pricing` | PricingSection | Program |
| `FAQ` | `faq` | FAQSection | Program |
| `DoctorIntro` | `doctor-intro` | DoctorIntroSection | Program / Page |
| `YouTube` | `youtube` | YouTubeSection | Program |
| `RelatedDiagnosis` | `related-diagnosis` | RelatedDiagnosisSection | Program |
| `RelatedReviews` | `related-reviews` | RelatedReviewsSection | Program |
| `RelatedPosts` | `related-posts` | RelatedPostsSection | Program |
| `FeatureHighlight` | `feature-highlight` | FeatureHighlightSection | Program |
| `SolutionTypes` | `solution-types` | SolutionTypesSection | Program |
| `MainHero` | `mainhero` | MainHeroSection | Homepage |
| `ServiceTiles` | — | ServiceTilesSection | Homepage |
| `Philosophy` | — | PhilosophySection | Homepage |
| `HomeInfo` | — | HomeInfoSection | Homepage |
| `LocationMap` | — | LocationMap | Location |
| `TransportInfo` | — | TransportInfo | Location |
| `BusinessHours` | — | BusinessHours | Location |
| `TelemedicineHero` | — | TelemedicineHeroSection | Telemedicine |
| `PageIntro` | — | PageIntroSection | Page |
| `DoctorList` | — | DoctorListSection | Page |
| `ProgramList` | — | ProgramListSection | Page |
| `DiagnosisList` | — | DiagnosisListSection | Page |
| `StepGuide` | — | StepGuideSection | Guide |
| `AdaptationPeriod` | — | AdaptationPeriodSection | Guide |
| `SideEffectsGrid` | — | SideEffectsGridSection | Guide |
| `RulesChecklist` | — | RulesChecklistSection | Guide |
| `InquiryCTA` | — | InquiryCTASection | CTA |
| `Bridge` | `BridgeSection`, `bridge`, `herobridgesection` | HeroBridgeSection | Decorative |
| `NarrativeFlow` | `narrative-flow`, `narrativeflow` | NarrativeFlowSection | Decorative |
| `RawHtml` | `rawhtml` | RawHtmlSection | Utility |

---

## Program Page Sections

These sections are commonly used in `programs.sections` JSON.

### Hero

Program hero banner with title, stats, and CTA.

```jsonc
{
  "type": "Hero",
  "title": "교통사고 한방치료",
  "subtitle": "자동차보험 한의원 진료",
  "description": "교통사고 후유증을 근본부터 치료합니다.",
  "image": "/images/programs/traffic-hero.jpg",
  "stats": [                          // optional
    { "label": "치료 경력", "value": "15년+" },
    { "label": "누적 환자", "value": "10,000+" }
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ✅ | — |
| `subtitle` | string | ✅ | — |
| `description` | string | ✅ | — |
| `image` | string | ✅ | — |
| `stats` | `{label, value}[]` | ❌ | `[]` |

---

### Problem

Symptom/problem cards with icons. Mobile carousel, desktop grid.

```jsonc
{
  "type": "Problem",
  "title": "이런 증상으로 고통받고 계신가요?",
  "subtitle": "교통사고 후 나타나는 대표적인 증상들",
  "cards": [
    { "title": "목/허리 통증", "description": "급정거 시 경추와 요추에 가해지는 충격", "icon": "🔴" },
    { "title": "두통/어지러움", "description": "경추 손상으로 인한 만성 두통", "icon": "🟡" }
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ✅ | — |
| `subtitle` | string | ✅ | — |
| `cards` | `{title, description, icon}[]` | ✅ | — |

---

### Solution

Treatment solution with image and feature highlights.

```jsonc
{
  "type": "Solution",
  "title": "한방 통합치료로 해결합니다",
  "subtitle": "근본 원인을 찾아 맞춤 치료",
  "image": "/images/programs/solution.jpg",
  "tagline": "15년 전문 치료",                    // optional badge
  "features": [                                   // optional
    { "title": "침구치료", "description": "경혈 자극으로 통증 완화", "icon": "📌" }
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ✅ | — |
| `subtitle` | string | ✅ | — |
| `image` | string | ✅ | — |
| `tagline` | string | ❌ | — |
| `features` | `{title, description, icon}[]` | ❌ | — |

---

### Mechanism

Step-by-step treatment mechanism explanation.

```jsonc
{
  "type": "Mechanism",
  "title": "치료 원리",
  "steps": [
    { "title": "진단", "description": "정밀 진단으로 손상 부위 파악" },
    { "title": "치료", "description": "침, 추나, 약침 복합 치료" },
    { "title": "회복", "description": "재활 운동 지도 및 관리" }
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ✅ | — |
| `steps` | `{title, description}[]` | ✅ | — |

---

### Process

Treatment process/flow steps with numbered badges.

```jsonc
{
  "type": "Process",
  "title": "진료 과정",
  "steps": [
    { "title": "접수", "description": "보험 서류 확인 및 접수" },
    { "title": "진단", "description": "X-ray, 이학적 검사" },
    { "title": "치료", "description": "맞춤 한방 치료 시작" },
    { "title": "관리", "description": "정기 follow-up 및 재활" }
  ],
  "image": "/images/programs/process.jpg"         // optional
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ✅ | — |
| `steps` | `{title, description}[]` | ✅ | — |
| `image` | string | ❌ | — |

---

### TreatableConditions

Grid of treatable conditions with modal detail.

```jsonc
{
  "type": "TreatableConditions",
  "title": "치료 가능 질환",
  "subtitle": "다양한 교통사고 후유증을 치료합니다",
  "conditions": [
    { "name": "경추 염좌", "description": "급정거 등 외력에 의한 경추 인대 손상" },
    { "name": "요추 디스크", "description": "충격으로 인한 추간판 돌출" }
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ✅ | — |
| `subtitle` | string | ✅ | — |
| `conditions` | `{name, description}[]` | ✅ | — |

---

### FeatureHighlight

Single feature spotlight with badge and image.

```jsonc
{
  "type": "FeatureHighlight",
  "title": "15년 교통사고 전문 치료 경험",
  "description": "연간 2,000건 이상의 교통사고 환자를 치료한 **풍부한 임상 경험**으로 최적의 치료를 제공합니다.",
  "badge": "🏆",                                  // optional icon/emoji
  "image": "/images/programs/feature.jpg",         // optional
  "align": "left",                                 // "left" | "right" | "center" (default: "center")
  "background": "soft"                             // "soft" | "white" | "default" (default: "soft")
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ✅ | — |
| `description` | string | ✅ | Supports `**bold**` markdown |
| `badge` | string | ❌ | — |
| `image` | string | ❌ | — |
| `align` | `"left" \| "right" \| "center"` | ❌ | `"center"` |
| `background` | `"soft" \| "white" \| "default"` | ❌ | `"soft"` |

---

### SolutionTypes

⚠️ **Common mistake**: Agents often generate `{icon, title, description}` — this is WRONG.

Treatment type cards with feature lists and diagnosis patterns.

```jsonc
{
  "type": "SolutionTypes",
  "title": "체질별 맞춤 치료",
  "subtitle": "환자 유형에 따른 최적 치료법",       // optional
  "types": [
    {
      "title": "급성기 환자",
      "features": ["통증 3일 이내", "부종 동반", "운동 제한"],
      "pattern": "사고 직후 ~ 2주",
      "solution": {                                // optional
        "title": "집중 치료",
        "description": "매일 침구+약침 치료로 급성 염증 제어"
      }
    },
    {
      "title": "아급성기 환자",
      "features": ["통증 지속 2주+", "만성화 경향", "일상 불편"],
      "pattern": "2주 ~ 3개월",
      "solutionTitle": "복합 치료",                // alternative flat format
      "solutionDescription": "추나+한약 병행으로 구조적 회복"
    }
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ✅ | — |
| `subtitle` | string | ❌ | — |
| `types` | array | ✅ | — |
| `types[].title` | string | ✅ | — |
| `types[].features` | `string[]` | ✅ | **Must be string array, NOT objects** |
| `types[].pattern` | string | ✅ | Diagnosis pattern description |
| `types[].solution` | `{title, description}` | ❌ | Nested solution info |
| `types[].solutionTitle` | string | ❌ | Flat alternative to `solution.title` |
| `types[].solutionDescription` | string | ❌ | Flat alternative to `solution.description` |

**Layout**: 4 items → 2×2 grid, 3 items → 3-column, 2 items → 2-column.

---

### DoctorIntro

Doctor profile with image and credentials.

```jsonc
{
  "type": "DoctorIntro",
  "title": "담당 의료진",
  "doctorId": "staff-xyz",                         // fetches from DB if provided
  "doctorName": "김민기",
  "role": "대표원장",
  "subtitle": "한방재활의학과 전문의",
  "content": "15년간 교통사고 환자를 전문적으로 치료해왔습니다.",
  "image": "/images/staff/doctor-kim.jpg",
  "doctors": []                                    // optional: multiple doctors grid
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ❌ | — |
| `doctorId` | string | ❌ | Fetches from DB |
| `doctorName` | string | ❌ | — |
| `role` | string | ❌ | — |
| `subtitle` | string | ❌ | — |
| `content` | string | ❌ | — |
| `image` | string | ❌ | — |
| `doctors` | array | ❌ | Multiple doctor grid |

**Best practice**: Provide `doctorId` and let the component fetch from DB for consistency.

---

### FAQ

Frequently asked questions with accordion.

```jsonc
{
  "type": "FAQ",
  "title": "자주 묻는 질문",
  "programId": "traffic-accident",                 // optional: fetches topic-linked FAQs
  "items": [
    { "q": "치료 기간은 얼마나 걸리나요?", "a": "평균 4~8주이며 증상에 따라 달라집니다." },
    { "q": "자동차보험으로 진료 가능한가요?", "a": "네, 자동차보험 한의원 진료가 가능합니다." }
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ✅ | — |
| `items` | `{q, a}[]` | ✅ | — |
| `programId` | string | ❌ | Links topic FAQs from DB |

---

### Pricing

Treatment pricing plans with comparison.

```jsonc
{
  "type": "Pricing",
  "title": "치료 비용",
  "subtitle": "합리적인 가격의 맞춤 치료",
  "plans": [
    {
      "name": "기본 치료",
      "price": 50000,
      "duration": "1회",
      "features": ["침구치료", "부항", "물리치료"]
    },
    {
      "name": "집중 치료",
      "price": 150000,
      "originalPrice": 200000,                     // optional: strikethrough
      "duration": "4회 패키지",
      "features": ["침구치료", "추나요법", "약침", "한약"],
      "isBest": true                               // optional: highlight badge
    }
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ✅ | — |
| `subtitle` | string | ✅ | — |
| `plans` | array | ✅ | — |
| `plans[].name` | string | ✅ | — |
| `plans[].price` | number | ✅ | — |
| `plans[].originalPrice` | number | ❌ | Discount display |
| `plans[].duration` | string | ✅ | — |
| `plans[].features` | `string[]` | ✅ | — |
| `plans[].isBest` | boolean | ❌ | `false` |

---

### Gallery

Image gallery with hover captions.

```jsonc
{
  "type": "Gallery",
  "title": "한의원 시설",
  "subtitle": "쾌적한 치료 환경",                  // optional
  "images": [
    { "url": "/images/gallery/lobby.jpg", "caption": "접수 공간" },
    { "url": "/images/gallery/room.jpg", "caption": "치료실" }
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ✅ | — |
| `subtitle` | string | ❌ | — |
| `images` | `{url, caption?}[]` | ✅ | — |

---

### YouTube

Embedded YouTube video.

```jsonc
{
  "type": "YouTube",
  "title": "치료 영상",
  "description": "교통사고 한방치료 과정을 소개합니다.",  // optional
  "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ❌ | `"동영상"` |
| `description` | string | ❌ | — |
| `youtubeUrl` | string | ✅ | Full YouTube URL |

---

### RelatedDiagnosis

Links to related self-diagnosis tools. **Conditional** — renders nothing if no related diagnosis found.

```jsonc
{
  "type": "RelatedDiagnosis",
  "title": "관련 자가진단",                         // optional
  "subtitle": "증상을 미리 체크해보세요",           // optional
  "programId": "traffic-accident",                 // auto-linked if omitted
  "diagnosisId": "stress-check"                    // optional: specific diagnosis
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ❌ | i18n default |
| `subtitle` | string | ❌ | — |
| `programId` | string | ❌ | Inherited from page |
| `diagnosisId` | string | ❌ | — |

---

### RelatedReviews

Shows patient reviews for this program. **Conditional** — renders nothing if no reviews.

```jsonc
{
  "type": "RelatedReviews",
  "title": "환자 후기",                             // optional
  "subtitle": "실제 치료 후기를 확인하세요",         // optional
  "category": "traffic-accident",                  // optional: review category filter
  "programId": "traffic-accident"                  // auto-linked
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ❌ | i18n default |
| `subtitle` | string | ❌ | — |
| `category` | string | ❌ | Category filter |
| `programId` | string | ❌ | Inherited from page |

---

### RelatedPosts

Blog/column posts related to program. **Conditional** — renders nothing if no posts.

```jsonc
{
  "type": "RelatedPosts",
  "title": "관련 글",                               // optional
  "subtitle": "더 알아보기",                         // optional
  "category": "traffic-accident"                   // optional: post category filter
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ❌ | i18n default |
| `subtitle` | string | ❌ | — |
| `category` | string | ❌ | Category filter |

---

## Homepage Sections

Used in `homepage_sections` table.

### MainHero

Full-screen homepage hero with slideshow or video.

```jsonc
{
  "type": "MainHero",
  "mainHeading": "자연이 치유하는 한의원",
  "subHeading": "15년 전통의 한방 치료",
  "description": "몸과 마음의 균형을 되찾아드립니다.",
  "ctaText": "진료 예약",                           // optional
  "ctaLink": "/intake",                            // optional
  "theme": "dark",                                 // "light" | "dark" (optional)
  "images": [                                      // optional: slideshow
    { "url": "/images/hero/slide1.jpg", "alt": "한의원 전경" }
  ],
  "videoUrl": "/videos/hero.mp4",                  // optional: background video
  "posterUrl": "/images/hero/poster.jpg"           // optional: video poster
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `mainHeading` | string | ❌ | — |
| `subHeading` | string | ❌ | — |
| `description` | string | ❌ | — |
| `ctaText` | string | ❌ | — |
| `ctaLink` | string | ❌ | — |
| `theme` | `"light" \| "dark"` | ❌ | — |
| `images` | `{url, alt?}[]` | ❌ | — |
| `videoUrl` | string | ❌ | — |
| `posterUrl` | string | ❌ | — |

---

### ServiceTiles

3-column service menu tiles.

```jsonc
{
  "type": "ServiceTiles",
  "title": "주요 진료",
  "description": "우리 한의원의 특화 진료",
  "items": [                                       // from data.items
    { "icon": "🏥", "title": "교통사고", "description": "자동차보험 한방치료", "link": "/programs/traffic-accident" },
    { "icon": "💊", "title": "한방다이어트", "description": "체질별 맞춤 감량", "link": "/programs/diet" }
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ❌ | — |
| `description` | string | ❌ | — |
| `items` | `{icon, title, description, link?}[]` | ❌ | Hardcoded 3-item fallback |

---

### Philosophy

Clinic philosophy with doctor profile.

```jsonc
{
  "type": "Philosophy",
  "heading": "치료 철학",
  "subHeading": "한의학의 근본",
  "description": "자연의 치유력을 되살리는 한방 치료를 추구합니다.",
  "doctorSelector": "representative"               // optional: which doctor to feature
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `heading` | string | ❌ | — |
| `subHeading` | string | ❌ | — |
| `description` | string | ❌ | — |
| `doctorSelector` | string | ❌ | Auto-selects representative doctor |

---

### HomeInfo

Homepage info grid: notices, hours, contact.

```jsonc
{
  "type": "HomeInfo"
}
```

No required data fields — fetches notices from DB and reads settings for hours/contact.

---

## Location Page Sections

### LocationMap

Map with address and navigation links.

```jsonc
{
  "type": "LocationMap",
  "title": "오시는 길",
  "address": "서울시 서초구 잠원로 24",
  "mapSearchKeyword": "반포자이한의원",              // TMap search
  "lat": "37.5065",                                // optional: coordinates
  "lng": "127.0180"
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ❌ | i18n default |
| `address` | string | ❌ | From settings |
| `mapSearchKeyword` | string | ❌ | — |
| `lat` | string | ❌ | — |
| `lng` | string | ❌ | — |

---

### TransportInfo

Public transportation directions.

```jsonc
{
  "type": "TransportInfo",
  "title": "교통 안내",
  "items": [
    { "type": "지하철", "icon": "🚇", "description": "3호선 잠원역 3번 출구\n도보 5분" },
    { "type": "버스", "icon": "🚌", "description": "잠원역 정류장\n400, 401, 740" },
    { "type": "자동차", "icon": "🚗", "description": "건물 지하주차장\n2시간 무료" }
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ❌ | i18n default |
| `items` | `{type, icon, description}[]` | ❌ | i18n default (subway/bus/car) |

---

### BusinessHours

Clinic operating hours grid.

```jsonc
{
  "type": "BusinessHours",
  "title": "진료 시간",
  "row1_label": "평일", "row1_value": "09:00 - 18:00",
  "row2_label": "토요일", "row2_value": "09:00 - 13:00",
  "row3_label": "일요일", "row3_value": "휴진",
  "row4_label": "공휴일", "row4_value": "휴진",
  "notes": "점심시간 12:30-14:00\n야간진료 매주 수요일",
  "ctaText": "예약하기",                            // optional
  "ctaLink": "/intake"                             // optional
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ❌ | — |
| `row1_label` ~ `row4_label` | string | ❌ | From settings |
| `row1_value` ~ `row4_value` | string | ❌ | From settings |
| `notes` | string | ❌ | Newline-separated list |
| `ctaText` | string | ❌ | — |
| `ctaLink` | string | ❌ | — |

---

## Guide Sections

Used in programs with step-by-step patient guides (e.g., medication instructions).

### StepGuide

```jsonc
{
  "type": "StepGuide",
  "stepNumber": "Step 01",
  "title": "복용 방법",
  "steps": [
    { "title": "아침 공복", "description": "식전 30분에 1포 복용" },
    { "title": "저녁 식전", "description": "저녁 식사 30분 전 1포 복용" }
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `stepNumber` | string | ❌ | `"Step 01"` |
| `title` | string | ❌ | `"단계별 가이드"` |
| `steps` | `{title, description}[]` | ❌ | `[]` |

---

### AdaptationPeriod

```jsonc
{
  "type": "AdaptationPeriod",
  "icon": "⚠️",
  "title": "적응기 안내",
  "description": "처음 복용 시 다음과 같은 반응이 나타날 수 있습니다.",
  "schedule": [
    { "day": "1~3일", "instruction": "반포만 복용", "highlight": "절대 무리하지 마세요" },
    { "day": "4~7일", "instruction": "정상 복용 시작" }
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `icon` | string | ❌ | `"⚠️"` |
| `title` | string | ❌ | `"적응기 안내"` |
| `description` | string | ❌ | `""` |
| `schedule` | `{day, instruction, highlight?}[]` | ❌ | `[]` |

---

### SideEffectsGrid

```jsonc
{
  "type": "SideEffectsGrid",
  "stepNumber": "Step 02",                         // optional header
  "title": "부작용 대처",
  "description": "다음 증상이 나타나면 복용을 중단하고 연락하세요.",
  "items": [
    { "title": "소화 불량", "description": "복용량을 반으로 줄여보세요" },
    { "title": "발진", "description": "즉시 복용 중단 후 내원" }
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `stepNumber` | string | ❌ | — |
| `title` | string | ❌ | `"부작용 대처"` |
| `description` | string | ❌ | `""` |
| `items` | `{title, description}[]` | ❌ | `[]` |

---

### RulesChecklist

```jsonc
{
  "type": "RulesChecklist",
  "title": "꼭 지켜주세요",
  "subtitle": "치료 효과를 높이기 위해",            // optional
  "rules": [
    { "title": "금주", "description": "치료 기간 동안 음주를 삼가세요" },
    { "title": "충분한 수면", "description": "하루 7시간 이상 수면" }
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ❌ | `"꼭 지켜주세요"` |
| `subtitle` | string | ❌ | `""` |
| `rules` | `{title, description}[]` | ❌ | `[]` |

---

## Utility Sections

### InquiryCTA

Simple call-to-action block.

```jsonc
{
  "type": "InquiryCTA",
  "title": "궁금한 점이 있으신가요?",
  "description": "편하게 문의해주세요.",
  "ctaText": "문의하기",
  "ctaLink": "/intake"
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ❌ | `"궁금한 점이 있으신가요?"` |
| `description` | string | ❌ | `""` |
| `ctaText` | string | ❌ | `"문의하기"` |
| `ctaLink` | string | ❌ | `"/intake"` |

---

### Bridge

Decorative divider section with Korean medicine symbolism.

```jsonc
{
  "type": "Bridge",
  "title": "한의학의 근본",
  "description": "사람을 살리는 어진 기술"
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ❌ | Fallback text |
| `description` | string | ❌ | Fallback text |

---

### NarrativeFlow

3-step narrative cards with connecting arrows.

```jsonc
{
  "type": "NarrativeFlow",
  "title": "치료 여정",
  "subtitle": "세 단계로 건강을 되찾습니다",
  "steps": [
    { "number": 1, "title": "정밀 진단", "description": "체질과 증상을 종합 분석" },
    { "number": 2, "title": "맞춤 치료", "description": "개인별 최적 처방" },
    { "number": 3, "title": "건강 회복", "description": "지속적 관리와 예방" }
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ❌ | Hardcoded default |
| `subtitle` | string | ❌ | Hardcoded default |
| `steps` | `{number, title, description}[]` | ❌ | 3-step default |

---

### PageIntro

Simple page title + description header.

```jsonc
{
  "type": "PageIntro",
  "title": "소개",
  "description": "우리 한의원을 소개합니다.",
  "align": "center"                                // "center" | "left"
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ❌ | `"페이지 제목"` |
| `description` | string | ❌ | `"페이지 설명"` |
| `align` | `"center" \| "left"` | ❌ | `"center"` |

---

### RawHtml

Pass-through raw HTML (use with caution).

```jsonc
{
  "type": "RawHtml",
  "content": "<div class='custom'>Custom HTML here</div>"
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `content` | string | ✅ | — |

---

## Auto-Populated Sections

These sections fetch data from DB and require minimal JSON configuration:

| Type | DB Source | Minimal JSON |
|------|----------|--------------|
| `DoctorList` | `staff` table | `{"type": "DoctorList"}` |
| `ProgramList` | `programs` table | `{"type": "ProgramList"}` |
| `DiagnosisList` | `survey_templates` table | `{"type": "DiagnosisList"}` |
| `HomeInfo` | `notices` + settings | `{"type": "HomeInfo"}` |

---

## Common Patterns

### Recommended Program Section Order
```jsonc
[
  { "type": "Hero", ... },
  { "type": "FeatureHighlight", ... },     // 1-2 highlights
  { "type": "Problem", ... },
  { "type": "SolutionTypes", ... },
  { "type": "Solution", ... },
  { "type": "Mechanism", ... },
  { "type": "Process", ... },
  { "type": "DoctorIntro", ... },
  { "type": "TreatableConditions", ... },
  { "type": "Pricing", ... },
  { "type": "Gallery", ... },
  { "type": "FAQ", ... },
  { "type": "YouTube", ... },
  { "type": "RelatedPosts", ... },
  { "type": "RelatedReviews", ... },
  { "type": "RelatedDiagnosis", ... }
]
```

### Recommended Homepage Section Order
```jsonc
[
  { "type": "MainHero", ... },
  { "type": "Bridge", ... },
  { "type": "ServiceTiles", ... },
  { "type": "Philosophy", ... },
  { "type": "NarrativeFlow", ... },
  { "type": "ProgramList" },
  { "type": "DoctorList" },
  { "type": "HomeInfo" }
]
```

### Recommended Location Page Sections
```jsonc
[
  { "type": "LocationMap", ... },
  { "type": "BusinessHours", ... },
  { "type": "TransportInfo", ... }
]
```

---

## Known Pitfalls

1. **SolutionTypes `features` must be `string[]`** — NOT `{icon, title, description}[]`
2. **Conditional sections** (RelatedDiagnosis, RelatedReviews, RelatedPosts) render nothing if no matching data in DB — safe to include always
3. **`doctorId` in DoctorIntro** — prefer DB reference over inline data for consistency
4. **`programId` in FAQ** — enables topic-linked FAQ items from DB
5. **Image paths** — use `/images/...` for R2-hosted, or full URL for external
6. **`type` key is case-sensitive for most** — use PascalCase from the Type Key column (aliases exist but PascalCase is canonical)
