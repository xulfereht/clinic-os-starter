# /frontend-code — Frontend Code Implementation

> **Role**: Frontend Developer
> **Cognitive mode**: Design-aware Astro/Tailwind coder. Extracts visual identity from references, translates it into production code within Clinic-OS safe zones.

This skill writes actual frontend code — not just data objects. It can create pages, sections, custom skins, components, and CSS from scratch or from reference inspiration.

## When to Use

- Homepage needs more than a preset swap (custom layout, new sections, unique design)
- A reference site inspires the design direction and you want to replicate its feel
- Custom skin creation beyond the 9 built-in skins
- Page overrides that require structural changes (not just text)
- Plugin pages that need polished UI
- Any time `/setup-homepage` hits its ceiling (data-only edits aren't enough)

## Safe Zones (HARD)

**You CAN write/modify:**
```
src/pages/_local/**              — page overrides
src/plugins/local/**             — local plugins
src/plugins/custom-homepage/pages/index.astro  — active homepage
src/skins/local/**               — custom skins
src/lib/local/**                 — helper functions
public/local/**                  — static assets
```

**You CANNOT touch:**
```
src/pages/        (core pages)
src/components/   (core components — USE them, don't edit them)
src/layouts/      (core layouts — IMPORT them)
src/skins/        (built-in skins — READ for reference, don't modify)
src/lib/          (core lib — IMPORT from it)
src/styles/       (global styles)
```

**Import rules (MUST follow in all generated code):**
```astro
import BaseLayout from "@components/layout/BaseLayout.astro";       ✅
import SectionRenderer from "@components/common/SectionRenderer.astro"; ✅
import { getClinicSettings } from "@lib/clinic";                    ✅
import Something from "../../components/Something.astro";           ❌ NEVER
```

## Procedure

### Step 1 — Understand the request

Classify the task:

| Type | Example | Output location |
|------|---------|----------------|
| **Homepage custom** | "Make it look like this site" | `custom-homepage/pages/index.astro` |
| **Page override** | "I want a different doctors page" | `src/pages/_local/{path}.astro` |
| **New page** | "Create a landing page" | `src/plugins/local/{id}/pages/` |
| **Custom skin** | "Make a skin with this site's colors" | `src/skins/local/{name}/` |
| **Section add** | "Add a timeline section to homepage" | `custom-homepage/pages/index.astro` |
| **Component** | "Reusable FAQ accordion" | `src/lib/local/{name}.astro` |

### Step 2 — Reference analysis (optional, when reference URL provided)

When the user provides a reference website:

```
1. Fetch the page with WebFetch
2. Extract design characteristics:
   - Color palette (primary, secondary, accent, background, text)
   - Typography (serif vs sans, weight hierarchy, size scale)
   - Layout pattern (hero style, grid vs list, whitespace usage)
   - Visual rhythm (section spacing, divider style)
   - Interaction patterns (hover effects, scroll animations, transitions)
   - Overall mood (minimal, luxurious, clinical, warm, editorial)
3. Document as a design brief
```

**Design brief format:**
```yaml
# .agent/design-brief.yaml
reference: "https://example.com"
extracted_at: "2026-03-25"

palette:
  primary: "#2d3436"
  accent: "#e17055"
  background: "#fafafa"
  surface: "#ffffff"
  text_main: "#2d3436"
  text_muted: "#636e72"
  border: "#dfe6e9"

typography:
  heading_family: "'Noto Serif KR', serif"
  body_family: "'Pretendard', sans-serif"
  heading_weight: "700"
  body_weight: "400"
  scale: "text-base → text-lg → text-2xl → text-4xl → text-6xl"

layout:
  hero_style: "fullscreen-image-overlay"  # or split, text-only, video, etc.
  max_width: "max-w-6xl"
  section_spacing: "py-20 md:py-32"
  grid_pattern: "2-col asymmetric"

mood: "editorial-warm"
special_elements:
  - "floating badge on hero"
  - "horizontal scroll carousel"
  - "reveal-on-scroll animations"

adaptation_notes: |
  When implementing in Clinic-OS:
  - Use CSS variables (--accent, --bg-body, etc.)
  - Use SectionRenderer for compatible section types
  - Write custom HTML inline for custom sections
  - Place images in public/local/
```

**Multiple references**: When multiple URLs are given, analyze each and create a "best of" combination.

### Step 3 — Design decisions

Before coding, present key decisions to the user:

```
🎨 디자인 방향 확인

컬러: 레퍼런스의 따뜻한 톤 기반 (#e17055 accent)
타이포: Noto Serif KR (제목) + Pretendard (본문)
히어로: 풀스크린 이미지 + 하단 텍스트 오버레이
레이아웃: 와이드 (max-w-6xl), 넉넉한 여백

섹션 구성:
1. 풀스크린 히어로 (레퍼런스 스타일)
2. 강점 배지
3. 원장 소개 (2단 그리드, 이미지 좌측)
4. 프로그램 카드 (3열 그리드)
5. 진료 후기
6. 진료시간/연락처

이 방향으로 진행할까요?
```

### Step 4 — Write code

**Coding principles:**

1. **Tailwind 4 CSS variables** — compatible with Clinic-OS skin system:
   ```html
   <!-- ✅ skin-aware -->
   <div class="bg-[color:var(--bg-body,#faf7f2)] text-[color:var(--text-main,#161616)]">

   <!-- ✅ also OK for custom sections that don't need skin compat -->
   <div class="bg-stone-50 text-gray-900">
   ```

2. **Mobile-first responsive** — 80%+ of Korean clinic patients use mobile:
   ```html
   <div class="px-4 md:px-6 lg:px-8">
   <h1 class="text-3xl md:text-5xl lg:text-7xl">
   <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
   ```

3. **Korean typography** — break-keep, Noto Serif KR for headings:
   ```html
   <h2 class="break-keep" style="font-family: 'Noto Serif KR', serif;">
     원인을 정확히 찾아<br class="md:hidden"/>치료합니다
   </h2>
   ```

4. **Scroll animations** — subtle, performant:
   ```html
   <div class="reveal-on-scroll">...</div>

   <style>
   .reveal-on-scroll {
     opacity: 0; transform: translateY(20px);
     transition: opacity 0.8s ease, transform 0.8s ease;
   }
   .reveal-on-scroll.revealed { opacity: 1; transform: translateY(0); }
   </style>

   <script>
   const obs = new IntersectionObserver(
     (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('revealed'); }),
     { threshold: 0.1 }
   );
   document.querySelectorAll('.reveal-on-scroll').forEach(el => obs.observe(el));
   </script>
   ```

5. **Mix SectionRenderer and custom HTML freely**:
   ```astro
   <!-- Custom hero (inline HTML) -->
   <section class="min-h-screen ...">
     ...custom design...
   </section>

   <!-- Reuse existing section type -->
   <SectionRenderer sections={[{ type: "NarrativeFlow", ... }]} settings={settings} />

   <!-- Another custom section -->
   <section class="py-20 ...">
     ...custom design...
   </section>

   <!-- Standard HomeInfo -->
   <SectionRenderer sections={[{ type: "HomeInfo" }]} settings={settings} />
   ```

6. **Empty data = hidden section**:
   ```astro
   {credentials.length > 0 && (
     <section>...</section>
   )}
   ```

7. **Image paths** — always under `public/local/`:
   ```
   /local/homepage/hero-bg.jpg
   /local/homepage/doctor.jpg
   /local/assets/enhanced/cert-01.jpg
   ```

### Step 5 — Custom skin (when needed)

If the design requires colors/typography beyond existing skins, create a local skin:

```
src/skins/local/{skinName}/
├── skin.css              — CSS custom properties + overrides
└── sections/             — (optional) section-specific overrides
    └── Hero.astro
```

**skin.css template:**
```css
/*
 * Custom Skin: {skinName}
 * Generated from reference: {url}
 * Created by /frontend-code
 */

:root[data-skin="{skinName}"] {
  /* Core palette */
  --accent: #e17055;
  --accent-soft: rgba(225, 112, 85, 0.1);
  --bg-body: #fafafa;
  --bg-surface: #ffffff;
  --text-main: #2d3436;
  --text-muted: #636e72;
  --text-subtle: #b2bec3;
  --border-subtle: #dfe6e9;

  /* Hero */
  --skin-hero-glow: rgba(225, 112, 85, 0.08);

  /* Cards */
  --skin-panel-border: var(--border-subtle);
  --skin-panel-shadow: 0 4px 20px rgba(0,0,0,0.06);
}

:root[data-skin="{skinName}"] body {
  font-family: 'Pretendard', -apple-system, sans-serif;
  color: var(--text-main);
  background-color: var(--bg-body);
}

:root[data-skin="{skinName}"] h1,
:root[data-skin="{skinName}"] h2,
:root[data-skin="{skinName}"] h3 {
  font-family: 'Noto Serif KR', serif;
}
```

**Activate the skin:**
```sql
INSERT OR REPLACE INTO site_settings (category, key, value)
VALUES ('branding', 'skin', '{skinName}');
```

**Register the skin** (add to the skin loader so it gets picked up):
```bash
# The skin loader auto-discovers skins in src/skins/ and src/skins/local/
# Just creating the directory with skin.css is enough
```

### Step 6 — Build and verify

```bash
npm run build
npm run dev
# Open http://localhost:4321
```

Check:
- [ ] Mobile responsive (resize browser to 375px width)
- [ ] Images load correctly
- [ ] Skin variables apply
- [ ] Links work (localizedPath for i18n)
- [ ] Empty sections are hidden
- [ ] Scroll animations trigger
- [ ] No console errors

### Step 7 — Iterate with user

Show the result and collect feedback. Common iterations:
- "Add more whitespace" → increase py/px values
- "Make fonts bigger" → bump text-* scale
- "Change the color" → adjust CSS variables in skin or inline
- "Reorder these sections" → move HTML blocks
- "Add a new section" → write new section HTML
- "Make it like this part of the reference" → WebFetch specific element, adapt

Each iteration: edit → build → verify → show.

### Step 8 — Report

```
🎨 프론트엔드 구현 완료

파일:
  custom-homepage/pages/index.astro (12개 섹션)
  src/skins/local/warmClinic/skin.css (커스텀 스킨)
  public/local/homepage/ (이미지 8장)

디자인:
  레퍼런스: https://example-clinic.com
  컬러: warm coral (#e17055) + cream (#faf7f2)
  타이포: Noto Serif KR (제목) + Pretendard (본문)
  히어로: 풀스크린 이미지 오버레이

Next steps:
  → /setup-programs (프로그램 페이지)
  → npm run deploy (배포)
```

## Integration with Other Skills

| Skill | Relationship |
|-------|-------------|
| `/analyze-content` | style-card.yaml → tone & manner reference |
| `/discover-edge` | edge-profile.yaml → copy direction, USP |
| `/write-copy` | Copy text → insert into data objects |
| `/setup-homepage` | Preset-based data modification (this skill goes beyond that) |
| `/curate-images` | asset-metadata.json → image path reference |
| `/setup-skin` | Existing skin selection (this skill can create new skins) |
| `/plan-content` | site-plan.yaml → section structure reference |
| `/review-compliance` | Completed copy → medical advertising review |

## Available Section Types (SectionRenderer)

These section types are available via SectionRenderer — use them when they fit, write custom HTML when they don't:

```
Hero, MainHero, NarrativeFlow, ServiceTiles, YouTube,
HomeInfo, LocationMap, BusinessHours, DoctorIntro,
FeatureHighlight, Process, FAQ, ProgramHero,
ReviewCarousel, BlogPreview, IntakeForm, StressCheck
```

Read existing skin section files in `src/skins/*/sections/` for implementation reference.

## Design Quality Checklist

Before presenting to the user, verify:

- **Visual hierarchy**: Is the most important content the most prominent?
- **Whitespace**: Enough breathing room between sections? (py-20+ on desktop)
- **Consistency**: Same border-radius, shadow style, spacing rhythm throughout?
- **Typography scale**: Clear hierarchy from h1 → h2 → h3 → body → caption?
- **Color contrast**: Text readable on all backgrounds? (WCAG AA minimum)
- **Image quality**: No pixelated images? Proper aspect ratios?
- **Korean text**: break-keep applied? No orphan characters on key headings?
- **CTA visibility**: Primary call-to-action button is obvious and accessible?
- **Loading performance**: Images lazy-loaded (except hero)? No unnecessary JS?

## Starter Kit Note

For starter kit repos (has `core/` directory), prefix all paths:
```
core/src/pages/_local/          (NOT src/pages/_local/)
core/src/plugins/local/         (NOT src/plugins/local/)
core/src/skins/local/           (NOT src/skins/local/)
core/public/local/              (NOT public/local/)
```

## Triggers

- "이 사이트처럼 만들어줘", "레퍼런스", "디자인 참고"
- "홈페이지 코드 수정", "섹션 추가", "레이아웃 바꿔"
- "커스텀 스킨 만들어", "색감 바꿔", "디자인 바꿔"
- "페이지 오버라이드", "새 페이지 만들어"
- "이쁘게 만들어줘", "디자인 다듬어"

## All user-facing output in Korean.
