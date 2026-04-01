# /setup-programs — Program Page Configuration

> **Role**: Program Builder
> **Cognitive mode**: Use the tone established by the homepage as the baseline to configure each program page's sections.

Runs **after** /setup-homepage. The homepage tone becomes the standard for each program.

## When to Use

- After homepage setup — "프로그램 페이지 만들어"
- Adding a new program — "진료 프로그램 추가"
- Updating program content — "프로그램 내용 수정"
- Pipeline step — part of the setup-homepage → setup-programs flow

## Prerequisites

- `/plan-content` completed (`.agent/site-plan.yaml` with program structure)
- `/setup-homepage` completed (tone baseline established)
- Images ready

## Data Sources

- `.agent/site-plan.yaml` — program structure with blog_post_ids and content_seeds
- `.agent/pipeline-context.yaml` — pipeline state
- `.agent/references.yaml` — competitor program analysis (if available)
- `.agent/style-card.yaml` — writer persona for tone consistency
- **`docs/SECTION_SCHEMAS.md`** — **MUST READ before generating any section JSON.** Canonical Props schema for every section component. Wrong JSON shape = broken rendering.

## Procedure

### Step 1 — Verify program list

```bash
cat .agent/site-plan.yaml | grep -A 5 "programs:"

# Full pipeline context
cat .agent/site-plan.yaml 2>/dev/null
cat .agent/pipeline-context.yaml 2>/dev/null
cat .agent/references.yaml 2>/dev/null
cat .agent/style-card.yaml 2>/dev/null
```

### Step 2 — Staff registration

Check if medical staff linked to programs exist in DB:

```bash
npx wrangler d1 execute DB --local --command \
  "SELECT id, name, title FROM staff;"
```

If missing, register:

```bash
npx wrangler d1 execute DB --local --command \
  "INSERT INTO staff (id, name, title, bio, image, sort_order) \
   VALUES ('staff-hong', '홍길동', '대표원장', '경희대 한의과대학 졸업...', '/local/assets/enhanced/doctor-intro.png', 1);"
```

### Step 3 — Create programs

> **⚠️ MANDATORY: Read `docs/SECTION_SCHEMAS.md` first.**
> Every section in the JSON array must match the exact Props schema documented there.
> Common mistakes: SolutionTypes `features` must be `string[]` (not objects), type keys use PascalCase.

Create each program in DB based on site-plan.yaml.
Section JSON must conform to `docs/SECTION_SCHEMAS.md` — use PascalCase type keys:

```bash
# Program INSERT — section types MUST match SECTION_SCHEMAS.md
npx wrangler d1 execute DB --local --command \
  "INSERT OR REPLACE INTO programs (slug, name, description, doctor_id, sections, sort_order, is_active) \
   VALUES ('chuna', '추나/체형교정', '바른 체형, 건강한 삶을 위한 한방 추나치료', 'staff-hong', \
   '[{\"type\":\"Hero\",\"title\":\"추나/체형교정\",\"subtitle\":\"...\",\"description\":\"...\",\"image\":\"/local/assets/generated/program-chuna-hero.png\"}, \
     {\"type\":\"Problem\",\"title\":\"이런 증상이 있으신가요?\",\"subtitle\":\"...\",\"cards\":[{\"title\":\"만성 허리통증\",\"description\":\"...\",\"icon\":\"🔴\"}]}, \
     {\"type\":\"Mechanism\",\"title\":\"치료 원리\",\"steps\":[{\"title\":\"진단\",\"description\":\"...\"}]}, \
     {\"type\":\"Solution\",\"title\":\"치료 방법\",\"subtitle\":\"...\",\"image\":\"/local/assets/generated/program-chuna-solution.png\"}, \
     {\"type\":\"DoctorIntro\",\"doctorId\":\"staff-hong\"}, \
     {\"type\":\"FAQ\",\"title\":\"자주 묻는 질문\",\"items\":[{\"q\":\"...\",\"a\":\"...\"}]}, \
     {\"type\":\"RelatedPosts\"}]', \
   1, 1);"
```

**Section composition principles** (per content-bootstrap.md):
- Hero != DoctorIntro (use different photos)
- Problem: no image needed (card-style)
- Mechanism: different angle from Hero
- Solution: flat-lay/editorial style
- FAQ: 3~5 items, can add more later
- RelatedPosts: auto-matched by category (해당 카테고리 블로그 1개 이상일 때만 추가)
- **FeatureHighlight**: blog_coverage가 "rich"(5+) 또는 "adequate"(2-4)일 때 추가 — 블로그에서 핵심 치료 원리를 추출하여 심층 설명
- **SolutionTypes**: 치료 방법/도구가 3개 이상 분류 가능할 때 추가 — 치료 수단별 카드
- **DoctorIntro**: staff 테이블에 의료진이 등록된 경우만 추가. staff가 0명이면 이 섹션을 생성하지 않고 경고 출력
- **doctor_ids 연결**: Step 2에서 staff INSERT 완료 후 반드시 `SELECT id FROM staff WHERE is_active=1 ORDER BY order_index`로 ID를 확인하고, Step 3의 programs INSERT에 해당 ID를 doctor_ids 컬럼에 JSON 배열로 설정

**Blog content → Program sections:**

For each program in `site-plan.yaml`, check `blog_post_ids` and `blog_coverage`:

If `blog_coverage` is "rich" (5+ posts) or "adequate" (2-4 posts):
```bash
# Read matched blog posts for this program
npx wrangler d1 execute DB --local --command \
  "SELECT title, content FROM posts WHERE id IN ({blog_post_ids}) AND length(COALESCE(content,'')) > 200;"
```

Use blog content to generate section data:
- **Problem cards**: Extract symptoms/conditions mentioned in blog posts → 3-4 cards with icon + title + description
- **Mechanism cards**: Extract treatment methods/principles from blogs → 3-4 explanation cards
- **FAQ items**: Extract questions patients commonly ask from blog context → 3-5 Q&A pairs
- **Solution features**: Extract benefits/results mentioned → 3-4 feature cards

Use `content_seeds` from site-plan.yaml as starting points for section copy.

Apply `writer_persona` from style-card.yaml:
- Match the voice style (합니다체, honorific level)
- Use similar sentence length and structure
- Incorporate `representative_sentences` patterns

If `blog_coverage` is "thin" (0-1 posts):
- Use generic but on-brand section content
- Note in the output: "블로그 데이터 부족 — 일반 콘텐츠 사용. /write-blog로 관련 글을 작성하면 보강 가능."

### Step 4 — Blog category mapping

Map imported blog post categories to program slugs:

```bash
npx wrangler d1 execute DB --local --command \
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

### Step 4.5 — Medical compliance check (자동)

프로그램 sections JSON을 DB에 저장하기 **전에** 모든 텍스트를 의료광고법 기준으로 검사합니다.
이 체크는 /write-copy의 Medical Compliance Auto-Check 패턴과 동일합니다.

**🔴 즉시 수정 (DB 저장 전 반드시 교체):**
- "OO전문" (전문의 자격 없이) → "OO 중심 진료"
- "완치/100% 효과/반드시" → 삭제 또는 "개선을 목표로"
- "최고/최초/유일" → 삭제
- 치료효과 보장 ("치료합니다/제거합니다") → "돕습니다/도움이 됩니다"
- 비교 광고 ("다른 OO과 달리") → 자사 강점만 기술
- 학술지 "인정/확인" → "게재/보고"

**🟡 수정 권고 (사용자에게 알림):**
- 공포 유발 단정 ("~하면 만성이 됩니다") → "~될 수 있습니다"
- "필수적/핵심" → "주요하게 활용되는"

> 한의사 전문의 제도 존재 (8개 분과). 전문의 자격 보유 시 "OO과 전문의" 표시 가능.
> 자격 없이 "OO전문" 표방은 의료법 위반.
> 참조: 의료법 제56조, 대한한의사협회 의료광고심의(ad.akom.org)

### Step 4.6 — Tone consistency check

After creating all programs, verify consistency:
1. Read homepage hero copy (from index.astro data or site-plan.yaml)
2. Compare with program hero/subtitle tone
3. Ensure `writer_persona.voice` is consistent across all programs
4. If mismatch detected: adjust program copy to match homepage tone

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

Recommended next steps:
  → /setup-skin (스킨 적용)
  → npm run deploy (배포)
```

### Step 7 — Onboarding state sync

After successful build (Step 5), mark the onboarding feature as done.
This runs regardless of entry point (demo, delegated, onboarding, standalone).

```bash
npm run onboarding:done -- --feature=program-management --note="setup-programs 완료"
```

> Skip silently if onboarding-state.json doesn't exist.

### Step 8 — Update pipeline context

Update `.agent/pipeline-context.yaml`:
```yaml
programs:
  count: {N}
  blog_sourced: {N}  # programs where blog content informed sections
  generic: {N}       # programs with thin/no blog data
  tone_consistent: true
  completed_at: "{ISO date}"
```

## Triggers

- "프로그램 만들어줘", "진료 프로그램 설정"
- "프로그램 페이지", "진료 페이지 구성"

## All user-facing output in Korean.
