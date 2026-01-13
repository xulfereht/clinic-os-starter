#!/bin/bash
# Deploy UI Translations System to Production
# Created: 2025-12-29

set -e

echo "🚀 UI 번역 시스템 프로덕션 배포"
echo "================================"

# 1. Git commit & push
echo ""
echo "📦 Step 1: 코드 커밋 & 푸시"
git add .
git status
git commit -m "feat: Add UI translations admin editor and DB-first lookup

- Add getUITextAsync() and loadUITranslations() to i18n.ts
- Create /admin/translations/ui.astro editor page
- Create /api/admin/translations/ui.ts API endpoint
- Add UI translations card to dashboard
- Migration files: 0400, 0401, 0402, 0403" || echo "Nothing to commit"

git push

# 2. Deploy to Cloudflare
echo ""
echo "☁️  Step 2: Cloudflare 배포"
npm run deploy

# 3. Run DB migrations
echo ""
echo "🗃️  Step 3: DB 마이그레이션 실행"

echo "Running 0400_migrate_ui_translations.sql..."
npx wrangler d1 execute brd-clinic-db --remote --file=migrations/0400_migrate_ui_translations.sql

echo "Running 0401_migrate_ui_translations_part2.sql..."
npx wrangler d1 execute brd-clinic-db --remote --file=migrations/0401_migrate_ui_translations_part2.sql

echo "Running 0402_complete_vietnamese_translations.sql..."
npx wrangler d1 execute brd-clinic-db --remote --file=migrations/0402_complete_vietnamese_translations.sql

echo "Running 0403_complete_legacy_translations.sql..."
npx wrangler d1 execute brd-clinic-db --remote --file=migrations/0403_complete_legacy_translations.sql

echo ""
echo "✅ 배포 완료!"
echo "   - Admin: https://brd-clinic.pages.dev/admin/translations/ui"
