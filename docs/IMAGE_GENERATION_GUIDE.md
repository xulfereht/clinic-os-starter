# AI 이미지 생성 가이드

Clinic-OS는 온보딩, 블로그, 프로그램 페이지 등에서 AI 이미지를 자동 생성할 수 있습니다.

## 1. 개요

에이전트가 온보딩 중 프로그램 페이지, 히어로 배너, OG 이미지 등을 꾸밀 때 맥락에 맞는 이미지를 자동 생성합니다.

**지원 이미지 타입:**
- 진료 프로그램 대표 이미지
- 히어로 배너 (16:9)
- OG/소셜 미리보기 이미지 (1200x630)
- 블로그 글 썸네일
- 의료진 프로필 플레이스홀더

## 2. 무료 체험 (30회)

별도 설정 없이 바로 사용 가능합니다. 클리닉당 **30회 무료** 이미지 생성이 제공됩니다.

- HQ 서버를 통해 자동으로 프록시됩니다
- 쿼터 잔여량 확인: 이미지 생성 시 응답에 `used`/`quota` 포함
- 30회 소진 후에는 BYOK 설정이 필요합니다

## 3. BYOK 설정 (무제한)

Google의 Gemini API 키를 직접 설정하면 **무제한**으로 이미지를 생성할 수 있습니다.

### 3-1. API 키 발급

1. [Google AI Studio](https://aistudio.google.com)에 접속
2. 좌측 메뉴에서 **"Get API Key"** 클릭
3. **"Create API Key"** 버튼으로 키 생성
4. 생성된 키를 복사 (AIza... 로 시작)

> Google AI Studio 계정은 무료이며, Gemini API는 무료 tier를 제공합니다.

### 3-2. wrangler.toml에 설정

```toml
[vars]
GEMINI_API_KEY = "AIzaSy..."
```

### 3-3. 또는 Cloudflare Dashboard에서 설정

1. [Cloudflare Dashboard](https://dash.cloudflare.com) 접속
2. Pages > 해당 프로젝트 > Settings > Environment Variables
3. `GEMINI_API_KEY` 변수 추가
4. Production과 Preview 모두에 설정

설정 후 재배포하면 자동으로 BYOK 모드로 전환됩니다.

## 4. 활용처

이 키 하나로 다음 모든 기능을 사용할 수 있습니다:

| 기능 | 설명 |
|------|------|
| 온보딩 이미지 | 프로그램/의료진 페이지 자동 꾸미기 |
| 블로그 썸네일 | 글 작성 시 자동 썸네일 생성 |
| 프로그램 페이지 | 진료 프로그램 대표 이미지 |
| OG 이미지 | SNS 공유 시 미리보기 이미지 |
| 히어로 배너 | 홈페이지 상단 배너 이미지 |

## 5. 사용법

에이전트가 온보딩 중 자동으로 호출하지만, 직접 실행도 가능합니다.

### 기본 사용

```bash
# 프로그램 히어로 (진료과목 지정 → 검증된 골드 스탠다드 프롬프트 사용)
node scripts/generate-image.js \
  --template program --name "소화기 치료" --category digestive \
  --save-path "images/programs/digestive/hero.png"

# 블로그 썸네일
node scripts/generate-image.js \
  --template blog --title "봄철 알레르기 관리법" --category skin \
  --save-path "images/blog/spring-allergy.png"

# 히어로 배너 (변형 선택: zen, modern, nature)
node scripts/generate-image.js \
  --template hero --variant zen \
  --save-path "images/hero/main.png"

# 메커니즘 다이어그램
node scripts/generate-image.js \
  --template mechanism --name "피부 치료" --category skin \
  --save-path "images/programs/skin/mechanism.png"

# 의료진 프로필 플레이스홀더
node scripts/generate-image.js \
  --template staff --name "김원장" --role "대표원장" \
  --save-path "images/staff/director.png"
```

### 스타일 변경

```bash
# 수묵화 스타일로 생성
node scripts/generate-image.js \
  --template hero --style inkWash \
  --save-path "images/hero/main.png"

# 사용 가능한 스타일 목록 보기
node scripts/generate-image.js --list-styles
```

### 일관성 유지 (seed 옵션)

같은 프로그램의 여러 이미지(히어로, 메커니즘, 솔루션)를 비슷한 톤으로 생성하려면 `--seed` 값을 통일하세요:

```bash
node scripts/generate-image.js --template program --category digestive --seed 42 --save-path "images/programs/digestive/hero.png"
node scripts/generate-image.js --template mechanism --category digestive --seed 42 --save-path "images/programs/digestive/mechanism.png"
node scripts/generate-image.js --template solution --category digestive --seed 42 --save-path "images/programs/digestive/solution.png"
```

### 커스텀 프롬프트

```bash
node scripts/generate-image.js \
  --prompt "Close-up of dried Korean herbs and roots on warm wooden surface. Overhead flat-lay. Soft natural lighting. Editorial food photography. No text." \
  --aspect "16:9" \
  --save-path "images/custom/herbs.png"
```

> **자동 품질 보호:** `negativePrompt`가 모든 요청에 자동 적용되어 텍스트, 워터마크, 저품질 결과물을 필터링합니다.

## 6. 프롬프트 가이드라인

> 상세 레퍼런스: `scripts/lib/image-prompt-guide.js`

### 템플릿 타입과 권장 비율

| 템플릿 | 용도 | 기본 비율 | 카테고리 지원 |
|--------|------|-----------|---------------|
| `program` | 프로그램 히어로 | 16:9 | digestive, skin, pain, neuro, head, women, pediatric, wellness |
| `hero` | 홈페이지 배너 | 16:9 | variant: zen, modern, nature |
| `blog` | 블로그 썸네일 | 16:9 | herbalMedicine, acupuncture, lifestyle, exercise, nutrition |
| `og` | SNS 미리보기 | 16:9 | - |
| `staff` | 의료진 프로필 | 3:4 | - |
| `mechanism` | 메커니즘 도해 | 1:1 | 위 카테고리 동일 |
| `solution` | 치료/제품 사진 | 1:1 | 위 카테고리 동일 |
| `process` | 단계 인포그래픽 | 16:9 | 위 카테고리 동일 |

### 프롬프트 작성 규칙

**필수:**
- `No text, no watermark, no logos` — 이미지에 텍스트 절대 포함 금지
- Korean aesthetic — 한국적 미니멀리즘 + 따뜻한 분위기
- High quality, professional

**인물 이미지:**
- Faceless composition — 얼굴 노출 금지 (손, 뒷모습, 실루엣만)
- 편안하고 고급스러운 의류 (베이지, 크림, 화이트 계열)

**커스텀 프롬프트 구조:**
```
[주요 피사체] + [배경/환경] + [조명] + [색감/분위기] + [스타일] + [제약조건]
```

예시:
```
A close-up of dried Korean herbs and roots arranged on a warm wooden surface.
Korean-style minimalist interior. Soft, warm sunlight through sheer curtains.
Warm amber and beige tones. Editorial food photography style.
No text, no watermark. Faceless if person included.
```

### 카테고리별 컬러 팔레트

| 카테고리 | 주요 색상 | 보조 색상 | 분위기 |
|---------|----------|----------|--------|
| digestive | 따뜻한 앰버 | 부드러운 베이지 | 따뜻하고 편안한 |
| skin | 민트 그린 | 깨끗한 화이트 | 깔끔하고 상쾌한 |
| pain | 부드러운 블루 | 중성 그레이 | 차분하고 안정된 |
| neuro | 깊은 인디고 | 소프트 바이올렛 | 평화롭고 고요한 |
| women | 소프트 로즈 | 따뜻한 피치 | 포근하고 돌봄 |
| pediatric | 밝은 옐로우 | 프레시 그린 | 활기차고 밝은 |
| wellness | 골든 | 어스 브라운 | 활력 있고 안정된 |

### 다른 스타일이 필요할 때

기본 스타일은 "소프트 자연광 사진"이지만, 병원 브랜드에 따라 다른 분위기가 필요할 수 있습니다.

**내장 대안 스타일 (--style 옵션):**

| 스타일 | 이름 | 적합한 용도 |
|--------|------|------------|
| `inkWash` | 수묵화/동양화 | 전통적 한의원 브랜드, 고급 이미지 |
| `watercolor` | 수채화 | 소아과, 여성건강, 부드러운 블로그 |
| `minimalVector` | 미니멀 벡터 | 인포그래픽, 프로세스 도해 |
| `cinematic` | 시네마틱 | 히어로 배너, 임팩트 있는 랜딩 |
| `render3d` | 3D 렌더 | 메커니즘 다이어그램, 제품 |
| `editorial` | 에디토리얼 매거진 | 프리미엄 브랜드, 라이프스타일 |
| `flatLay` | 플랫 레이 | 한약재 나열, 제품 구성 |

```bash
# 수묵화 스타일 히어로 배너
node scripts/generate-image.js --template hero --style inkWash --save-path "images/hero/main.png"

# 사용 가능한 전체 스타일 목록 보기
node scripts/generate-image.js --list-styles
```

**완전히 커스텀 스타일을 원할 때:**

`--prompt`로 직접 프롬프트를 작성하되, 아래 구조를 따르면 품질이 안정됩니다:

```
[주요 피사체] + [배경/환경] + [조명 설명] + [색감/분위기] + [원하는 스타일 키워드] + "No text, no watermark."
```

스타일 키워드 예시:
- 사진: `professional photography`, `soft focus`, `bokeh`, `macro`, `35mm lens`
- 일러스트: `digital illustration`, `vector art`, `flat design`, `line art`
- 회화: `oil painting`, `watercolor`, `ink wash`, `gouache`
- 3D: `3D render`, `isometric`, `glassmorphism`, `clay render`
- 분위기: `warm`, `cool`, `dramatic`, `serene`, `vibrant`, `muted`

> 팁: 한 사이트 내에서 스타일을 통일하면 전문성이 높아 보입니다. 예를 들어 모든 프로그램 이미지를 `watercolor` 스타일로, 블로그는 `editorial` 스타일로 통일하는 식입니다.

## 7. 트러블슈팅

### "image_quota_exceeded" 오류
무료 30회를 모두 사용한 경우입니다. 섹션 3의 BYOK 설정을 진행하세요.

### "Gemini API error" 오류
- API 키가 올바른지 확인하세요
- Google AI Studio에서 키가 활성 상태인지 확인
- Imagen API가 해당 리전에서 사용 가능한지 확인

### "No image data returned" 오류
- 프롬프트에 금지된 콘텐츠가 포함되었을 수 있습니다
- 사람의 실제 사진을 요청하는 프롬프트는 거부될 수 있습니다
- 프롬프트를 수정하여 다시 시도하세요

### 이미지 생성 실패 시 온보딩 진행
이미지 생성 실패는 온보딩을 차단하지 않습니다. 실패 시 placeholder로 진행하고 나중에 이미지를 교체할 수 있습니다.
