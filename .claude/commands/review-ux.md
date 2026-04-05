# /review-ux — UI/UX Quality Review

> **Role**: Senior UI/UX Quality Auditor
> **Cognitive mode**: Systematic, evidence-based visual audit. Every finding must include a screenshot crop, computed CSS values, and a concrete fix. No subjective opinions — only measurable issues.

Catches visual issues that code review and build checks miss: contrast failures, broken images, text collisions, empty sections, skin misapplication.

## When to Use

- After `/setup-skin`, `/setup-homepage`, `/setup-programs` (auto-trigger recommended)
- Before `npm run deploy` (final pre-deploy check)
- User reports visual problems
- After any theme_config or skin CSS change

## Prerequisites

- Site running (deployed URL or `npm run dev`)
- Playwright installed (`npx playwright --version`)

## Procedure

### Step 1 — Collect target pages

```javascript
// Get all visible program slugs from DB
const programs = await db.prepare(
  "SELECT id FROM programs WHERE is_visible=1 ORDER BY order_index"
).all();

const targets = [
  { name: 'home', path: '/' },
  { name: 'blog', path: '/blog' },
  { name: 'location', path: '/location' },
  { name: 'intake', path: '/intake' },
  ...programs.results.map(p => ({ name: p.id, path: `/programs/${p.id}` }))
];
```

### Step 2 — Automated audit (Playwright)

Run this script for EVERY target page, at BOTH viewports:

```javascript
const { chromium } = require('playwright');
const VIEWPORTS = [
  { name: 'desktop', width: 1400, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];

for (const vp of VIEWPORTS) {
  for (const target of targets) {
    await page.setViewportSize(vp);
    await page.goto(BASE_URL + target.path, { waitUntil: 'networkidle' });

    // === CHECK 1: Contrast Ratio ===
    // Find ALL elements with background-color and check text contrast
    const contrastIssues = await page.evaluate(() => {
      function luminance(r, g, b) {
        const [rs, gs, bs] = [r, g, b].map(c => {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }
      function contrastRatio(l1, l2) {
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      }
      function parseRgb(str) {
        const m = str.match(/(\d+)/g);
        return m ? m.map(Number) : null;
      }

      const issues = [];
      document.querySelectorAll('a, button, p, h1, h2, h3, h4, span, li, td, th, label').forEach(el => {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || cs.opacity === '0' || cs.display === 'none') return;

        const fgRgb = parseRgb(cs.color);
        const bgRgb = parseRgb(cs.backgroundColor);
        if (!fgRgb || !bgRgb || cs.backgroundColor === 'rgba(0, 0, 0, 0)') return;

        const fgL = luminance(...fgRgb);
        const bgL = luminance(...bgRgb);
        const ratio = contrastRatio(fgL, bgL);

        // WCAG AA: 4.5:1 for normal text, 3:1 for large text (18px+ or 14px+ bold)
        const fontSize = parseFloat(cs.fontSize);
        const isBold = parseInt(cs.fontWeight) >= 700;
        const isLarge = fontSize >= 18 || (fontSize >= 14 && isBold);
        const threshold = isLarge ? 3.0 : 4.5;

        if (ratio < threshold) {
          issues.push({
            text: el.textContent?.trim()?.substring(0, 30),
            tag: el.tagName,
            fg: cs.color,
            bg: cs.backgroundColor,
            ratio: Math.round(ratio * 100) / 100,
            threshold,
            y: Math.round(rect.y),
            classes: el.className?.toString()?.substring(0, 50)
          });
        }
      });
      return issues;
    });

    // === CHECK 2: Broken Images ===
    const brokenImages = await page.evaluate(() => {
      return [...document.querySelectorAll('img')]
        .filter(img => img.src && !img.src.startsWith('data:') && (!img.complete || img.naturalWidth === 0))
        .map(img => ({ src: img.src.replace(location.origin, ''), alt: img.alt }));
    });

    // === CHECK 3: Empty Sections ===
    const emptySections = await page.evaluate(() => {
      return [...document.querySelectorAll('section')]
        .filter(sec => {
          const text = sec.textContent?.trim();
          return sec.getBoundingClientRect().height < 20 || (text && text.length < 10);
        })
        .map(sec => ({ classes: sec.className?.substring(0, 50), h: sec.getBoundingClientRect().height }));
    });

    // === CHECK 4: Transparent/Invisible Buttons ===
    const invisibleButtons = await page.evaluate(() => {
      return [...document.querySelectorAll('a, button')]
        .filter(el => {
          const text = el.textContent?.trim();
          if (!text || text.length < 2) return false;
          const cs = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || cs.display === 'none') return false;
          return cs.backgroundColor === 'rgba(0, 0, 0, 0)' &&
                 (el.className?.includes('btn') || text.includes('예약') || text.includes('상담'));
        })
        .map(el => ({
          text: el.textContent?.trim()?.substring(0, 30),
          classes: el.className?.substring(0, 60)
        }));
    });

    // === CHECK 5: Skin Application ===
    const skinCheck = await page.evaluate(() => {
      const root = document.documentElement;
      return {
        skin: root.getAttribute('data-skin'),
        skinV2: root.getAttribute('data-skin-v2'),
        accent: getComputedStyle(root).getPropertyValue('--accent')?.trim(),
      };
    });

    // === CHECK 6: Hardcoded Fallback Leak ===
    const fallbackLeak = await page.evaluate(() => {
      const body = document.body.textContent || '';
      const leaks = [];
      if (body.includes('샘플한의원')) leaks.push('샘플한의원');
      if (body.includes('02-0000-0000')) leaks.push('02-0000-0000');
      if (body.includes('테헤란로 123')) leaks.push('테헤란로 123');
      if (body.includes('홍길동')) leaks.push('홍길동');
      if (body.includes('sample-clinic')) leaks.push('sample-clinic');
      return leaks;
    });

    // Screenshot
    await page.screenshot({ path: `/tmp/ux-audit-${target.name}-${vp.name}.png` });
  }
}
```

### Step 3 — Report

Format findings by severity:

```
🎨 UI/UX Quality Review — {site_name}

Scanned: {N} pages × 2 viewports = {total} screens

📊 Skin status
  data-skin: {value} | v2: {value} | --accent: {value}

🔴 CRITICAL (deploy blocker)
  [{page}:{viewport}] Contrast fail: "{text}" — ratio {ratio} < {threshold}
    fg: {color} bg: {bg} → fix: {fix suggestion}
  [{page}] Broken image: {src}
  [{page}] Fallback leak: "샘플한의원" detected

🟡 WARNING
  [{page}:{viewport}] Transparent button: "{text}"
  [{page}] Empty section: {classes}

✅ PASSED
  - Image loading: {n}/{total} OK
  - Mobile layout: OK
  - Skin applied: OK

📋 Fix task list (by priority):
  1. [file] [fix description]
  2. ...
```

### Step 4 — Button Consistency Audit (btn--primary consistency)

Dedicated check to verify `btn--primary` renders consistently across all pages.
This step catches rendering inconsistencies that repeatedly occur with TW4 + CSS variable combinations.

```javascript
// === CHECK 7: btn--primary consistency ===
const btnPrimaryAudit = await page.evaluate(() => {
  const btns = document.querySelectorAll('.btn--primary, [class*="btn--primary"]');
  return Array.from(btns).map(el => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || cs.display === 'none') return null;
    return {
      text: el.textContent?.trim()?.substring(0, 30),
      color: cs.color,
      bg: cs.backgroundColor,
      borderColor: cs.borderColor,
      class: el.className?.toString()?.substring(0, 80),
      isWhiteText: cs.color === 'rgb(255, 255, 255)' || cs.color === 'rgb(255, 253, 248)',
      hasAccentBg: !cs.backgroundColor.includes('rgba(0, 0, 0, 0)') &&
                   !cs.backgroundColor.includes('rgb(255, 255, 255)') &&
                   !cs.backgroundColor.includes('rgb(248, 245, 240)'),
    };
  }).filter(Boolean);
});

// All btn--primary MUST have: accent bg + white text
// Any deviation = skin selector conflict
const inconsistent = btnPrimaryAudit.filter(b => !b.isWhiteText || !b.hasAccentBg);
```

**Detection patterns:**

| Symptom | Cause | Fix |
|---------|-------|-----|
| btn--primary has white text + transparent bg | `bg-[color:var(--accent)]` TW4 misparse | Add `.btn.btn--primary { background: #accent !important }` to skin.css |
| btn--primary has accent text + white bg | Another selector overriding (e.g. `.section a[href*="map"]`) | Add `:not(.btn--primary)` to that selector |
| Text inside btn--primary is accent-strong | `[class*="text-"][class*="accent-strong"]` over-matching | Replace with exact selector (see below) |

```javascript
// === CHECK 8: TW4 CSS Variable Resolution ===
const tw4VarCheck = await page.evaluate(() => {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const vars = {
    accent: cs.getPropertyValue('--accent').trim(),
    accentSoft: cs.getPropertyValue('--accent-soft').trim(),
    accentStrong: cs.getPropertyValue('--accent-strong').trim(),
    textOnAccent: cs.getPropertyValue('--text-on-accent').trim(),
    bgBody: cs.getPropertyValue('--bg-body').trim(),
    bgSurface: cs.getPropertyValue('--bg-surface').trim(),
  };

  // Find all elements where computed color ≠ expected variable value
  const mismatches = [];
  document.querySelectorAll('[class*="text-on-accent"]').forEach(el => {
    const computed = getComputedStyle(el).color;
    // text-on-accent should be white-ish
    if (!computed.match(/rgb\(25[0-5], 25[0-5], 25[0-5]\)/) &&
        !computed.match(/rgb\(255, 255, 255\)/)) {
      mismatches.push({
        text: el.textContent?.trim()?.substring(0, 30),
        expected: vars.textOnAccent,
        actual: computed,
        class: el.className?.toString()?.substring(0, 80),
      });
    }
  });
  return { vars, mismatches };
});
```

**Over-matching detection rules:**

These patterns are **forbidden** in skin.css (over-matching risk):
```css
/* ❌ Dangerous: also catches hover:bg-[...accent-strong] classes */
[class*="text-"][class*="accent-strong"] { color: ... }

/* ✅ Safe: matches exact TW4 class name */
[class*="text-accent-strong"],
[class*="text-\[color\:var\(--accent-strong"] { color: ... }
```

### Step 5 — Auto-fix (when possible)

| Issue Type | Auto-fixable | Method |
|-----------|-------------|--------|
| Contrast fail (accent bg + dark text) | ✅ | Add `color: #fff !important` to skin.css |
| Transparent btn--primary | ✅ | Add bg gradient to skin.css |
| btn--primary over-matching | ✅ | Add `:not(.btn--primary)` to the causing selector |
| TW4 text-on-accent misparse | ✅ | Add `[class*="text-on-accent"] { color: #fff !important }` to skin.css |
| Broken image (path error) | ✅ | Check DB path → add to _routes.json exclude |
| Fallback leak ("샘플한의원") | ✅ | Regenerate config.ts (`writeConfigTs()`) |
| Empty section (no DB data) | ⚠️ Manual | Notify that data input is needed |
| skinV2 not active | ✅ | Add skinSystemVersion:2 to DB theme_config |
| clinics↔site_settings mismatch | ✅ | Sync clinics table (see below) |

**clinics table sync (CHECK 9):**
```javascript
// Compare clinics.address vs site_settings.address
// Check clinics.logo_url status
// → On mismatch, update clinics with site_settings values
```

**After auto-fix, always re-run verification** — execute Step 2 again to confirm fixes.

### Step 6 — Contrast Ratio Reference Table

| Ratio | WCAG Level | Application |
|-------|-----------|-------------|
| ≥ 7.0 | AAA | Optimal |
| ≥ 4.5 | AA (normal text) | **Minimum standard** |
| ≥ 3.0 | AA (large text 18px+) | Headings, large buttons |
| < 3.0 | Fail | 🔴 Fix immediately |

## Severity Rules

- **🔴 CRITICAL**: contrast < 3.0, broken images, fallback leak, transparent CTA — **deploy blocker**
- **🟡 WARNING**: contrast 3.0~4.5, empty sections, font fallback — **fix recommended**
- **✅ PASS**: contrast ≥ 4.5, all images loaded, skin applied — **no issues**

## Triggers

- "UI 점검", "UX 리뷰", "시각 품질 확인", "가독성 체크"
- "버튼이 안 보여", "글씨가 안 보여", "이미지가 깨져", "색이 이상해"
- "사이트 점검", "배포 전 확인", "contrast 체크"

## All user-facing output in Korean.
