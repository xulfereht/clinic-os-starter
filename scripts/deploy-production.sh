#!/bin/bash
set -e

echo "🔨 프로덕션 빌드 중..."
npm run build

echo ""
echo "🚀 프로덕션 배포 중..."
echo "   (Git 외부 디렉토리에서 실행하여 프로덕션으로 배포)"
echo ""

# 프로덕션 배포 (현재 디렉토리에서 실행)
npx wrangler pages deploy dist --project-name=brd-clinic

echo ""
echo "✅ 배포 완료!"
echo ""
echo "🌍 확인하기:"
echo "   - https://brd-clinic.pages.dev"
echo "   - https://www.baekrokdam.com"
echo ""
