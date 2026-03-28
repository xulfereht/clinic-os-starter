# /setup-i18n — 다국어 설정

> **Role**: Internationalization Manager
> **Cognitive mode**: Language-first expansion. Select target languages → configure i18n → create translations → add language selector → verify SEO.

외국인 환자 대응을 위한 다국어 설정을 구성합니다.
언어 선택 → i18n 구성 → 번역 파일 생성 → 언어 선택 UI 추가 → SEO 검증까지 진행합니다.

## When to Use

- Onboarding Tier 2 (Content)
- "외국인 환자가 올 수 있어요"
- "영어/중국어 페이지가 필요해요"
- "다국어 지원"

## Prerequisites

- `/setup-clinic-info` 완료 (기본 콘텐츠)
- `/setup-homepage` 권장 (홈페이지 구성 완료 후 번역)

## Supported Languages

| Code | Language | Priority |
|------|----------|----------|
| `ko` | 한국어 (기본) | Required |
| `en` | English | High |
| `ja` | 日本語 | Medium |
| `zh-hans` | 简体中文 | Medium |
| `vi` | Tiếng Việt | Low |

## Procedure

### Step 1 — Language Selection

```bash
# Check current i18n config
echo "=== 현재 i18n 설정 확인 ==="
grep -A 20 "i18n" astro.config.mjs 2>/dev/null || echo "astro.config.mjs에서 i18n 설정 확인"

# Check existing locale files
ls src/content/i18n/ 2>/dev/null || echo "i18n 콘텐츠 없음"
ls public/locales/ 2>/dev/null || echo "locale 파일 없음"
```

**Language Selection Prompt:**
```
🌍 다국어 설정

기본 언어: 한국어 (고정)

추가할 언어를 선택하세요 (중복 선택 가능):
  ☑️ English (영어)
  ☐ 日本語 (일본어)
  ☐ 简体中文 (중국어 간체)
  ☐ Tiếng Việt (베트남어)

선택한 언어: en
```

### Step 2 — i18n Configuration

**Update astro.config.mjs:**
```bash
# Backup current config
cp astro.config.mjs astro.config.mjs.backup

# Check if i18n already configured
if grep -q "i18n" astro.config.mjs; then
  echo "i18n 이미 설정됨, 업데이트만 진행"
else
  echo "i18n 신규 설정 필요"
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
echo "📋 astro.config.mjs에 다음을 추가하세요:"
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

echo "✅ 번역 파일 구조 생성 완료"
find src/content/i18n -type f | sort
```

### Step 4 — Core Content Translation

**Get Clinic Info for Translation:**
```bash
# Fetch clinic info from DB
CLINIC_INFO=$(npx wrangler d1 execute DB --local --json --command \
  "SELECT key, value FROM site_settings WHERE category IN ('general', 'contact') AND key IN ('site_name', 'site_description');")

echo "=== 번역이 필요한 콘텐츠 ==="
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
echo "📋 번역 방법:"
echo "  1. [TRANSLATE] 표시된 부분을 해당 언어로 번역"
echo "  2. 변수는 {variable} 형태로 유지"
echo "  3. 번역 완료 후 [TRANSLATE] 표시 제거"
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

echo "✅ 언어 선택기 컴포넌트 생성 완료"
```

**Add to Header:**
```bash
echo ""
echo "📋 Header에 언어 선택기 추가:"
echo ""
cat << 'EOF'
// src/components/layout/Header.astro 또는 BaseLayout.astro
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
echo "📋 SEO 컴포넌트에 hreflang 추가:"
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

echo "✅ i18n 테이블 생성 완료"
```

### Step 8 — Verification

```bash
echo "=== 다국어 설정 검증 ==="

# Check i18n config
echo ""
echo "⚙️  i18n 설정:"
grep -A 10 "i18n:" astro.config.mjs 2>/dev/null || echo "astro.config.mjs 확인 필요"

# Check translation files
echo ""
echo "📝 번역 파일:"
find src/content/i18n -type f 2>/dev/null | head -20

# Check DB
echo ""
echo "🗄️  DB 테이블:"
npx wrangler d1 execute DB --local --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%trans%';"

# Test routes
echo ""
echo "🔗 테스트 URL:"
echo "  한국어: http://localhost:4321/"
echo "  English: http://localhost:4321/en/"
echo "  日本語: http://localhost:4321/ja/"
echo "  简体中文: http://localhost:4321/zh-hans/"

echo ""
echo "🌐 SEO 확인:"
echo "  hreflang 태그가 <head>에 포함되어 있는지 확인하세요."
echo "  Google Search Console에서 다국어 설정을 확인할 수 있습니다."
```

**완료 보고서:**
```
✅ 다국어 설정 완료

🌍 지원 언어:
   한국어 (ko): 기본
   English (en): ✅
   日本語 (ja): ${JA_STATUS}
   简体中文 (zh-hans): ${ZH_STATUS}

⚙️ 설정:
   astro.config.mjs: i18n 구성 완료
   기본 언어: ko
   전략: pathname

📝 번역 파일:
   src/content/i18n/{locale}/
   ├── nav.json
   ├── common.json
   └── home.json

🎨 UI:
   언어 선택기: ✅
   헤더에 추가 필요

🔍 SEO:
   hreflang 태그: 설정 필요
   og:locale: 설정 필요

📊 다음 단계:
  1. 모든 [TRANSLATE] 항목 번역
  2. Header에 LanguageSelector 추가
  3. SEO 컴포넌트에 hreflang 적용
  4. 빌드 및 테스트

관리자:
  → /admin/i18n — 번역 관리
```

## Integration

| Skill | Relationship |
|-------|-------------|
| `/setup-homepage` | 홈페이지 번역 |
| `/write-blog` | 블로그 다국어 |
| `/setup-programs` | 프로그램 다국어 |
| `/optimize-aeo` | hreflang SEO |

## URL Structure

```
/                 → 한국어 (기본)
/en/              → English
/en/about/        → About (English)
/ja/              → 日本語
/ja/about/        → About (日本語)
```

## Triggers

- "다국어", "영어 페이지", "중국어"
- "외국인 환자", "translation"
- "i18n", "국제화"

## Safety

- 기본 언어(ko)는 항상 fallback
- 번역 없을 때는 기본 언어 표시
- 페이지 없을 때 404 대신 redirect

## All user-facing output in Korean.
