# /write-blog — Blog Post Writing

> **Role**: Blog Writer
> **Cognitive mode**: Write as the clinic owner. Use their voice, their expertise, their perspective. The reader should not be able to tell AI wrote this.

Writes blog posts based on writer persona + clinic data.
The goal is to produce posts that read as if the clinic director wrote them personally.

## Prerequisites

- `/analyze-content` completed (`.agent/style-card.yaml` with `writer_persona` section required)
- `/discover-edge` completed (`.agent/edge-profile.yaml` — clinic strengths, target patients)
- Existing blog posts in DB are a plus (for reference)

## Procedure

### Step 1 — Load persona + context

```bash
# Writer persona
cat .agent/style-card.yaml 2>/dev/null

# Clinic strengths/targets
cat .agent/edge-profile.yaml 2>/dev/null

# Existing blog titles (avoid duplicates + style reference)
npx wrangler d1 execute DB --local --command \
  "SELECT title, category, slug FROM posts WHERE type='blog' AND is_sample=0 ORDER BY created_at DESC LIMIT 20;"

# Program list (for treatment-related posts)
npx wrangler d1 execute DB --local --command \
  "SELECT slug, name, description FROM programs WHERE is_active=1;"
```

### Step 2 — Topic selection

If user specified a topic → go directly to Step 3.

If no topic given, recommend 3~5 based on:

```
📝 블로그 주제 추천

기존 블로그에서 다루지 않은 주제 중,
이 한의원의 강점과 맞는 것들을 추천합니다:

1. "겨울철 어깨 통증, 왜 더 심해질까?" (통증 — 계절성)
2. "추나 치료 전 꼭 알아야 할 5가지" (추나 — FAQ형)
3. "직장인 만성 두통, 한의원에서 어떻게 치료할까?" (타겟 맞춤)
4. "치료 후기: 3개월간의 체형교정 기록" (후기형)
5. "한약, 꼭 먹어야 하나요?" (일반 궁금증 해소)

어떤 주제로 쓸까요? 또는 원하는 주제를 말씀해주세요.
```

**Topic recommendation criteria:**
- Related to primary programs in edge-profile.yaml
- Topics not yet covered in existing blog
- Matches target patient search intent
- Seasonally/temporally relevant (reference current date)

### Step 3 — Outline design

Follow the persona's `structure` pattern to create an outline:

```
📋 글 구조

제목: "겨울철 어깨 통증, 왜 더 심해질까?"
카테고리: 통증
예상 분량: 1,200~1,500자

1. 도입 — 공감 (증상 묘사, 계절 변화 연결)
2. 원인 — 한의학적 설명 (기혈 순환, 근막 긴장)
3. 자가 체크 — 독자 참여 (3가지 체크포인트)
4. 치료법 — 이 한의원에서 하는 치료 (추나, 침, 한약)
5. 생활 관리 — 집에서 할 수 있는 것 (스트레칭, 온열)
6. 마무리 — 내원 유도 (자연스럽게)

이 구조로 쓸까요?
```

### Step 4 — Write the post

**Writing rules:**

1. **Strict persona adherence**
   - `voice`: Follow speech style and address forms exactly
   - `sentence_style`: Match sentence length and rhythm
   - `vocabulary`: Match technical term usage level
   - `signature_patterns`: Reflect intro/closing patterns
   - `do_not`: Never use anti-patterns

2. **SEO basics**
   - Include core keyword in title (naturally)
   - Place related keywords in subheadings (h2/h3)
   - Generate separate meta description (~120 chars)
   - Include image alt text

3. **Medical advertising compliance**
   - No definitive claims about treatment effects ("완치됩니다" ❌ → "도움이 될 수 있습니다" ✅)
   - No comparisons with other hospitals/clinics
   - No patient personal information
   - Caution with non-covered treatment pricing
   - If uncertain → run `/review-compliance`

4. **Length guide**
   - Naver blog optimal: 1,200~2,000 chars
   - Too short hurts SEO, too long causes bounce
   - Mark 3~5 image insertion points

### Step 5 — Image selection

```bash
# Check available images
cat .agent/asset-metadata.json 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
for img in data.get('images',[]):
    if img.get('category') in ['treatment','interior','equipment','doctor']:
        print(f\"{img['filename']:40s} {img['category']:15s} {img.get('description','')}\")
"
```

Suggest images matching post content. If none available:
- Match from existing blog-imported images
- Suggest new image generation via `/generate-scenes`
- Text-only is also fine (user's choice)

### Step 6 — User review

Show the draft and collect feedback:

```
📝 블로그 초안

제목: 겨울철 어깨 통증, 왜 더 심해질까?
카테고리: 통증
분량: 1,380자

---
(글 전문)
---

메타 디스크립션:
  "겨울이면 어깨 통증이 심해지는 이유와 한의원 치료법을 알려드립니다."

이미지 삽입 포인트:
  [1] 도입부 — 어깨 통증 이미지
  [3] 치료법 — 침 치료 사진
  [5] 스트레칭 — 설명 이미지

수정할 부분이 있으면 말씀해주세요.
```

**Common feedback handling:**
- "좀 더 친근하게" → adjust persona tone
- "이 부분 전문적으로" → increase medical depth
- "너무 길어" → trim paragraphs
- "이 치료법 빼줘" → remove that content

### Step 7 — Save to DB

Save as draft after user approval:

```bash
npx wrangler d1 execute DB --local --command \
  "INSERT INTO posts (slug, title, content, excerpt, type, category, status, locale, created_at, updated_at)
   VALUES (
     '{slug}',
     '{title}',
     '{content_html}',
     '{meta_description}',
     'blog',
     '{category}',
     'draft',
     'ko',
     datetime('now'),
     datetime('now')
   );"
```

```
✅ 블로그 글 저장 완료 (draft 상태)

제목: 겨울철 어깨 통증, 왜 더 심해질까?
상태: draft (관리자 페이지에서 publish로 변경)
확인: /admin/posts 에서 검수

발행 전 체크:
  → /review-compliance (의료광고 심의 검토)
  → 관리자 페이지에서 이미지 첨부 + publish
```

## Batch Mode

When planning multiple posts at once:

```
"블로그 5편 써줘" →
  1. 주제 5개 추천 → 승인
  2. 각 글 아웃라인 일괄 표시 → 수정
  3. 순차 작성 (각 글마다 간단 확인)
  4. 전체 draft 저장
```

## Integration

| Skill | Relationship |
|-------|-------------|
| `/analyze-content` | Provides writer_persona (required input) |
| `/discover-edge` | Provides strengths/targets (used for topic recommendations) |
| `/review-compliance` | Medical advertising compliance review after writing |
| `/curate-images` | Image matching from asset-metadata |
| `/generate-scenes` | Generate needed images |
| `/plan-content` | Long-term blog planning via blog-strategy mode |

## Triggers

- "블로그 써줘", "블로그 작성", "글 써줘"
- "칼럼 써줘", "포스팅 작성"
- "이 주제로 블로그", "블로그 5편"

## All user-facing output in Korean.
