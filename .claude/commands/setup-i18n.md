# /setup-i18n — Multilingual Configuration

> **Role**: Internationalization Manager
> **Cognitive mode**: Language-first expansion. Select target languages → configure i18n → create translations → add language selector → verify SEO.

Configures multilingual support for international patients.
Language selection → i18n configuration → translation file generation → language selector UI → SEO verification.

## When to Use

- Onboarding Tier 2 (Content)
- When the clinic serves foreign patients
- When English/Chinese/Japanese pages are needed
- When setting up multilingual support

## Prerequisites

- `/setup-clinic-info` completed (base content)
- `/setup-homepage` recommended (translate after homepage is configured)

## Supported Languages

| Code | Language | Priority |
|------|----------|----------|
| `ko` | Korean (default) | Required |
| `en` | English | High |
| `ja` | Japanese | Medium |
| `zh-hans` | Simplified Chinese | Medium |
| `vi` | Vietnamese | Low |

## Procedure

### Step 1 — Language Selection

```bash
# Check current i18n config
echo "=== Check current i18n settings ==="
grep -A 20 "i18n" astro.config.mjs 2>/dev/null || echo "Check astro.config.mjs for i18n settings"

# Check existing locale files
ls src/content/i18n/ 2>/dev/null || echo "No i18n content"
ls public/locales/ 2>/dev/null || echo "No locale files"
```

**Language Selection Prompt:**
```
🌍 Multilingual Configuration

Default language: Korean (fixed)

Select languages to add (multiple allowed):
  ☑️ English
  ☐ Japanese
  ☐ Simplified Chinese
  ☐ Vietnamese

Selected languages: en
```

### Step 2 — i18n Configuration

**Update astro.config.mjs:**
```bash
# Backup current config
cp astro.config.mjs astro.config.mjs.backup

# Check if i18n already configured
if grep -q "i18n" astro.config.mjs; then
  echo "i18n already configured, updating only"
else
  echo "New i18n setup required"
fi
```

**Configuration Example:**
```javascript
// astro.config.mjs
export default defineConfig({
  // ... other config
  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en', 'ja', 'zh-hans'],
    routing: {
      prefixDefaultLocale: false, // /ko/about → /about
      strategy: 'pathname'
    },
    fallback: {
      en: 'ko',
      ja: 'ko',
      'zh-hans': 'ko'
    }
  }
});
```

**Auto-update Script:**
```bash
# This would require careful editing of astro.config.mjs
# For now, provide manual instructions
echo ""
echo "📋 Add the following to astro.config.mjs:"
echo ""
cat << 'EOF'
  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en'],
    routing: {
      prefixDefaultLocale: false
    },
    fallback: {
      en: 'ko'
    }
  }
EOF
```

### Step 3 — Translation Structure

**Create Translation Directories:**
```bash
# Create i18n content directory structure
mkdir -p src/content/i18n/en
mkdir -p src/content/i18n/ja
mkdir -p src/content/i18n/zh-hans

# Create translation files
for LANG in en ja zh-hans; do
  mkdir -p "src/content/i18n/${LANG}"

  # Navigation
cat > "src/content/i18n/${LANG}/nav.json" << EOF
{
  "home": "${LANG == 'en' ? 'Home' : LANG == 'ja' ? 'ホーム' : LANG == 'zh-hans' ? '首页' : 'Trang chủ'}",
  "about": "${LANG == 'en' ? 'About' : LANG == 'ja' ? 'about' : LANG == 'zh-hans' ? '关于' : 'Giới thiệu'}",
  "programs": "${LANG == 'en' ? 'Programs' : LANG == 'ja' ? '治療メニュー' : LANG == 'zh-hans' ? '治疗项目' : 'Dịch vụ'}",
  "blog": "${LANG == 'en' ? 'Blog' : LANG == 'ja' ? 'ブログ' : LANG == 'zh-hans' ? '博客' : 'Blog'}",
  "contact": "${LANG == 'en' ? 'Contact' : LANG == 'ja' ? 'contact' : LANG == 'zh-hans' ? '联系' : 'Liên hệ'}",
  "reservation": "${LANG == 'en' ? 'Book Now' : LANG == 'ja' ? 'ご予約' : LANG == 'zh-hans' ? '预约' : 'Đặt lịch'}"
}
EOF

  # Common UI elements
cat > "src/content/i18n/${LANG}/common.json" << EOF
{
  "loading": "${LANG == 'en' ? 'Loading...' : LANG == 'ja' ? '読み込み中...' : LANG == 'zh-hans' ? '加载中...' : 'Đang tải...'}",
  "readMore": "${LANG == 'en' ? 'Read More' : LANG == 'ja' ? '詳しく見る' : LANG == 'zh-hans' ? '阅读更多' : 'Xem thêm'}",
  "submit": "${LANG == 'en' ? 'Submit' : LANG == 'ja' ? '送信' : LANG == 'zh-hans' ? '提交' : 'Gửi'}",
  "cancel": "${LANG == 'en' ? 'Cancel' : LANG == 'ja' ? 'キャンセル' : LANG == 'zh-hans' ? '取消' : 'Hủy'}",
  "close": "${LANG == 'en' ? 'Close' : LANG == 'ja' ? '閉じる' : LANG == 'zh-hans' ? '关闭' : 'Đóng'}",
  "phone": "${LANG == 'en' ? 'Phone' : LANG == 'ja' ? '電話' : LANG == 'zh-hans' ? '电话' : 'Điện thoại'}",
  "address": "${LANG == 'en' ? 'Address' : LANG == 'ja' ? '住所' : LANG == 'zh-hans' ? '地址' : 'Địa chỉ'}",
  "hours": "${LANG == 'en' ? 'Hours' : LANG == 'ja' ? '診療時間' : LANG == 'zh-hans' ? '营业时间' : 'Giờ làm việc'}"
}
EOF
done

echo "✅ Translation file structure created"
find src/content/i18n -type f | sort
```

### Step 4 — Core Content Translation

**Get Clinic Info for Translation:**
```bash
# Fetch clinic info from DB
CLINIC_INFO=$(npx wrangler d1 execute DB --local --json --command \
  "SELECT key, value FROM site_settings WHERE category IN ('general', 'contact') AND key IN ('site_name', 'site_description');")

echo "=== Content requiring translation ==="
echo "$CLINIC_INFO"
```

**Homepage Translation Template:**
```bash
# Create homepage translations
for LANG in en ja zh-hans; do
  cat > "src/content/i18n/${LANG}/home.json" << EOF
{
  "hero": {
    "title": "[TRANSLATE] {clinic_name}",
    "subtitle": "[TRANSLATE] {clinic_description}",
    "ctaPrimary": "[TRANSLATE] 예약하기",
    "ctaSecondary": "[TRANSLATE] 자세히 보기"
  },
  "about": {
    "title": "[TRANSLATE] 원장 소개",
    "content": "[TRANSLATE] {doctor_bio}"
  },
  "programs": {
    "title": "[TRANSLATE] 치료 프로그램",
    "viewAll": "[TRANSLATE] 전체 보기"
  },
  "contact": {
    "title": "[TRANSLATE] 오시는 길",
    "mapLabel": "[TRANSLATE] 지도 보기"
  }
}
EOF
done

echo ""
echo "📋 Translation instructions:"
echo "  1. Translate items marked with [TRANSLATE] into the target language"
echo "  2. Keep variables in {variable} format"
echo "  3. Remove [TRANSLATE] markers after translation is complete"
```

### Step 5 — Language Selector UI

**Create Language Selector Component:**
```bash
mkdir -p src/components/i18n

cat > src/components/i18n/LanguageSelector.astro << 'EOF'
---
interface Props {
  currentLocale: string;
}

const { currentLocale } = Astro.props;

const languages = [
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'zh-hans', name: '简体中文', flag: '🇨🇳' }
];

const currentLang = languages.find(l => l.code === currentLocale) || languages[0];
---

<div class="language-selector relative">
  <button
    type="button"
    class="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
    aria-expanded="false"
    aria-haspopup="true"
    data-language-toggle
  >
    <span>{currentLang.flag}</span>
    <span class="text-sm">{currentLang.name}</span>
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
    </svg>
  </button>

  <div
    class="language-menu absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg py-2 hidden z-50"
    data-language-menu
  >
    {languages.map(lang => (
      <a
        href={`/${lang.code !== 'ko' ? lang.code + '/' : ''}${Astro.url.pathname.replace(/^\/(en|ja|zh-hans)\//, '/').replace(/^\//, '')}`}
        class={`flex items-center gap-2 px-4 py-2 hover:bg-gray-100 transition-colors ${lang.code === currentLocale ? 'bg-gray-50 font-medium' : ''}`}
      >
        <span>{lang.flag}</span>
        <span class="text-sm">{lang.name}</span>
      </a>
    ))}
  </div>
</div>

<script>
  const toggle = document.querySelector('[data-language-toggle]');
  const menu = document.querySelector('[data-language-menu]');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', (!isExpanded).toString());
      menu.classList.toggle('hidden');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        toggle.setAttribute('aria-expanded', 'false');
        menu.classList.add('hidden');
      }
    });
  }
</script>
EOF

echo "✅ Language selector component created"
```

**Add to Header:**
```bash
echo ""
echo "📋 Add language selector to header:"
echo ""
cat << 'EOF'
// src/components/layout/Header.astro or BaseLayout.astro
---
import LanguageSelector from '@components/i18n/LanguageSelector.astro';
const { currentLocale = 'ko' } = Astro.props;
---

<header>
  <!-- ... other header content ... -->
  <LanguageSelector currentLocale={currentLocale} />
</header>
EOF
```

### Step 6 — SEO / hreflang Tags

**Create SEO Helper:**
```bash
cat > src/lib/i18n-seo.ts << 'EOF'
interface HreflangEntry {
  href: string;
  hreflang: string;
}

export function generateHreflangs(
  path: string,
  locales: string[],
  defaultLocale: string,
  siteUrl: string
): HreflangEntry[] {
  const cleanPath = path.replace(/^\/(en|ja|zh-hans)\//, '/').replace(/^\//, '');

  const hreflangs: HreflangEntry[] = locales.map(locale => ({
    href: `${siteUrl}/${locale === defaultLocale ? '' : locale + '/'}${cleanPath}`,
    hreflang: locale
  }));

  // Add x-default
  hreflangs.push({
    href: `${siteUrl}/${cleanPath}`,
    hreflang: 'x-default'
  });

  return hreflangs;
}

export const localeMetadata: Record<string, { name: string; ogLocale: string }> = {
  'ko': { name: '한국어', ogLocale: 'ko_KR' },
  'en': { name: 'English', ogLocale: 'en_US' },
  'ja': { name: '日本語', ogLocale: 'ja_JP' },
  'zh-hans': { name: '简体中文', ogLocale: 'zh_CN' }
};
EOF
```

**Update SEO Component:**
```bash
echo ""
echo "📋 Add hreflang to SEO component:"
echo ""
cat << 'EOF'
// src/components/seo/SEO.astro
---
import { generateHreflangs } from '@lib/i18n-seo';

interface Props {
  title: string;
  description: string;
  currentLocale: string;
}

const { title, description, currentLocale } = Astro.props;
const siteUrl = Astro.site?.toString() || 'https://example.com';
const locales = ['ko', 'en', 'ja', 'zh-hans'];
const hreflangs = generateHreflangs(Astro.url.pathname, locales, 'ko', siteUrl);
---

<!-- hreflang tags -->
{hreflangs.map(({ href, hreflang }) => (
  <link rel="alternate" hreflang={hreflang} href={href} />
))}

<!-- Open Graph locale -->
<meta property="og:locale" content={currentLocale === 'ko' ? 'ko_KR' : currentLocale === 'en' ? 'en_US' : currentLocale === 'ja' ? 'ja_JP' : 'zh_CN'} />
EOF
```

### Step 7 — Database Schema

```bash
# Create i18n tables migration
MIGRATION_NAME="$(date +%Y%m%d)_i18n_support.sql"

cat > "migrations/${MIGRATION_NAME}" << 'EOF'
-- I18n Support Tables

-- Page translations
CREATE TABLE IF NOT EXISTS page_translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_path TEXT NOT NULL,
  locale TEXT NOT NULL,
  title TEXT,
  description TEXT,
  content JSON,
  is_published INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(page_path, locale)
);

-- Navigation translations
CREATE TABLE IF NOT EXISTS nav_translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nav_key TEXT NOT NULL,
  locale TEXT NOT NULL,
  label TEXT NOT NULL,
  UNIQUE(nav_key, locale)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_page_trans_path ON page_translations(page_path);
CREATE INDEX IF NOT EXISTS idx_page_trans_locale ON page_translations(locale);
CREATE INDEX IF NOT EXISTS idx_nav_trans_key ON nav_translations(nav_key);
CREATE INDEX IF NOT EXISTS idx_nav_trans_locale ON nav_translations(locale);
EOF

# Apply migration
npx wrangler d1 execute DB --local --file="migrations/${MIGRATION_NAME}"

echo "✅ i18n tables created"
```

### Step 8 — Verification

```bash
echo "=== Multilingual setup verification ==="

# Check i18n config
echo ""
echo "⚙️  i18n settings:"
grep -A 10 "i18n:" astro.config.mjs 2>/dev/null || echo "Check astro.config.mjs"

# Check translation files
echo ""
echo "📝 Translation files:"
find src/content/i18n -type f 2>/dev/null | head -20

# Check DB
echo ""
echo "🗄️  DB tables:"
npx wrangler d1 execute DB --local --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%trans%';"

# Test routes
echo ""
echo "🔗 Test URLs:"
echo "  Korean: http://localhost:4321/"
echo "  English: http://localhost:4321/en/"
echo "  Japanese: http://localhost:4321/ja/"
echo "  Chinese: http://localhost:4321/zh-hans/"

echo ""
echo "🌐 SEO check:"
echo "  Verify hreflang tags are included in <head>."
echo "  Use Google Search Console to verify multilingual settings."
```

**Completion report:**
```
✅ Multilingual setup complete

🌍 Supported languages:
   Korean (ko): Default
   English (en): ✅
   Japanese (ja): ${JA_STATUS}
   Chinese (zh-hans): ${ZH_STATUS}

⚙️ Configuration:
   astro.config.mjs: i18n configured
   Default language: ko
   Strategy: pathname

📝 Translation files:
   src/content/i18n/{locale}/
   ├── nav.json
   ├── common.json
   └── home.json

🎨 UI:
   Language selector: ✅
   Needs to be added to header

🔍 SEO:
   hreflang tags: Setup needed
   og:locale: Setup needed

📊 Next steps:
  1. Translate all [TRANSLATE] items
  2. Add LanguageSelector to header
  3. Apply hreflang to SEO component
  4. Build and test

Admin:
  → /admin/i18n — Translation management
```

## Integration

| Skill | Relationship |
|-------|-------------|
| `/setup-homepage` | Homepage translation |
| `/write-blog` | Multilingual blog |
| `/setup-programs` | Multilingual programs |
| `/optimize-aeo` | hreflang SEO |

## URL Structure

```
/                 → Korean (default)
/en/              → English
/en/about/        → About (English)
/ja/              → Japanese
/ja/about/        → About (Japanese)
```

## Triggers

- "다국어", "영어 페이지", "중국어"
- "외국인 환자", "translation"
- "i18n", "국제화"

## Safety

- Default language (ko) always serves as fallback
- When translation is missing, display default language
- Redirect instead of 404 when page doesn't exist

## Onboarding State Sync

After i18n config and translations are set up, mark the onboarding feature as done.
This runs regardless of entry point (demo, delegated, onboarding, standalone).

```bash
npm run onboarding:done -- --feature=multilingual --note="setup-i18n completed"
```

> Skip silently if onboarding-state.json doesn't exist.

## All user-facing output in Korean.
