#!/bin/bash

# Cloudflare Pages Production Branch 설정 스크립트
# Direct Upload 프로젝트의 production_branch를 'main'으로 설정

ACCOUNT_ID="1bff59c068ac8ba9421d8cc58e9400b7"
PROJECT_NAME="brd-clinic"
PRODUCTION_BRANCH="main"

# API Token이 필요합니다
# 아래 단계를 따라 토큰을 생성하세요:
#
# 1. https://dash.cloudflare.com/profile/api-tokens 접속
# 2. "Create Token" 클릭
# 3. "Custom token" 선택
# 4. 권한 설정:
#    - Account → Cloudflare Pages → Edit
# 5. "Continue to summary" → "Create Token"
# 6. 생성된 토큰을 복사하여 아래 변수에 붙여넣기

API_TOKEN="Tlm9n8C1KatrMTtomM3uaU1mHXFGOfFYY2V2nrXK"

# API Token이 설정되지 않았는지 확인
if [ "$API_TOKEN" = "YOUR_API_TOKEN_HERE" ]; then
    echo "❌ API Token이 설정되지 않았습니다!"
    echo ""
    echo "다음 단계를 따라 API Token을 생성하세요:"
    echo "1. https://dash.cloudflare.com/profile/api-tokens 접속"
    echo "2. 'Create Token' 클릭"
    echo "3. 'Custom token' → 'Get started' 클릭"
    echo "4. Token name: 'Pages Production Branch Update'"
    echo "5. Permissions:"
    echo "   - Account → Cloudflare Pages → Edit"
    echo "6. 'Continue to summary' → 'Create Token'"
    echo "7. 생성된 토큰을 복사하여 이 스크립트의 API_TOKEN 변수에 붙여넣기"
    echo ""
    exit 1
fi

echo "🔧 Cloudflare Pages Production Branch 설정 중..."
echo ""
echo "Account ID: $ACCOUNT_ID"
echo "Project: $PROJECT_NAME"
echo "Production Branch: $PRODUCTION_BRANCH"
echo ""

# API 호출
RESPONSE=$(curl -s -w "\n%{http_code}" --request PATCH \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/$PROJECT_NAME" \
  --header "Authorization: Bearer $API_TOKEN" \
  --header "Content-Type: application/json" \
  --data "{\"production_branch\":\"$PRODUCTION_BRANCH\"}")

# HTTP 상태 코드와 응답 분리
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# 결과 확인
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Production branch가 '$PRODUCTION_BRANCH'로 성공적으로 설정되었습니다!"
    echo ""
    echo "이제 다음 명령으로 프로덕션 배포가 가능합니다:"
    echo "  npm run build"
    echo "  npx wrangler pages deploy dist --project-name=$PROJECT_NAME"
    echo ""
    echo "배포 후 https://brd-clinic.pages.dev 에서 최신 버전을 확인할 수 있습니다."
else
    echo "❌ 설정 실패 (HTTP $HTTP_CODE)"
    echo ""
    echo "응답:"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    exit 1
fi
