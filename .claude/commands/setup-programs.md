# /setup-programs — Program Page Configuration

> **Role**: Program Builder
> **Cognitive mode**: Use the tone established by the homepage as the baseline to configure each program page's sections.

Runs **after** /setup-homepage. The homepage tone becomes the standard for each program.

## Prerequisites

- `/plan-site` completed (`.agent/site-plan.yaml` with program structure)
- `/setup-homepage` completed (tone baseline established)
- Images ready

## Procedure

### Step 1 — Verify program list

```bash
cat .agent/site-plan.yaml | grep -A 5 "programs:"
```

### Step 2 — Staff registration

Check if medical staff linked to programs exist in DB:

```bash
npx wrangler d1 execute DB_NAME --local --command \
  "SELECT id, name, title FROM staff;"
```

If missing, register:

```bash
npx wrangler d1 execute DB_NAME --local --command \
  "INSERT INTO staff (id, name, title, bio, image, sort_order) \
   VALUES ('staff-hong', '홍길동', '대표원장', '경희대 한의과대학 졸업...', '/local/assets/enhanced/doctor-intro.png', 1);"
```

### Step 3 — Create programs

Create each program in DB based on site-plan.yaml:

```bash
# Program INSERT
npx wrangler d1 execute DB_NAME --local --command \
  "INSERT OR REPLACE INTO programs (slug, name, description, doctor_id, sections, sort_order, is_active) \
   VALUES ('chuna', '추나/체형교정', '바른 체형, 건강한 삶을 위한 한방 추나치료', 'staff-hong', \
   '[{\"type\":\"hero\",\"title\":\"추나/체형교정\",\"description\":\"...\",\"image\":\"/local/assets/generated/program-chuna-hero.png\"}, \
     {\"type\":\"problem\",\"title\":\"이런 증상이 있으신가요?\",\"cards\":[\"만성 허리통증\",\"거북목\",\"골반 불균형\"]}, \
     {\"type\":\"mechanism\",\"title\":\"치료 원리\",\"image\":\"/local/assets/generated/program-chuna-mechanism.png\"}, \
     {\"type\":\"solution\",\"title\":\"치료 방법\",\"image\":\"/local/assets/generated/program-chuna-solution.png\"}, \
     {\"type\":\"doctor_intro\"}, \
     {\"type\":\"faq\",\"items\":[]}, \
     {\"type\":\"related_posts\"}]', \
   1, 1);"
```

**Section composition principles** (per content-bootstrap.md):
- Hero != DoctorIntro (use different photos)
- Problem: no image needed (card-style)
- Mechanism: different angle from Hero
- Solution: flat-lay/editorial style
- FAQ: 3~5 items, can add more later
- RelatedPosts: auto-matched by category

### Step 4 — Blog category mapping

Map imported blog post categories to program slugs:

```bash
npx wrangler d1 execute DB_NAME --local --command \
  "UPDATE posts SET category = 'chuna' \
   WHERE (title LIKE '%추나%' OR title LIKE '%교정%' OR title LIKE '%허리%' OR title LIKE '%목%') \
   AND is_sample = 0 AND category IS NULL;"
```

Show mapping results to user for confirmation:

```
📂 블로그 카테고리 매핑 결과
  추나/체형교정: 15건
  비염치료: 8건
  소화기: 6건
  미분류 (일반 건강정보): 16건

맞으시면 적용하겠습니다.
```

### Step 5 — Build + verify

```bash
npm run build && npm run dev
```

Check each program page in browser:
- `http://localhost:4321/programs/chuna`
- `http://localhost:4321/programs/rhinitis`
- ...

### Step 6 — Report

```
📋 프로그램 구성 완료

생성: 4개 프로그램
  1. /programs/chuna — 추나/체형교정 (Hero+Problem+Mechanism+Solution+FAQ)
  2. /programs/rhinitis — 비염치료
  3. /programs/digestive — 소화기질환
  4. /programs/general — 일반진료

블로그 매핑: 45건 중 29건 매핑 완료

추천 다음 단계:
  → /setup-skin (스킨 적용)
  → npm run deploy (배포)
```

## Triggers

- "프로그램 만들어줘", "진료 프로그램 설정"
- "프로그램 페이지", "진료 페이지 구성"

## All user-facing output in Korean.
