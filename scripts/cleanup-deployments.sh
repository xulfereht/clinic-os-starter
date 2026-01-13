#!/bin/bash

# Cloudflare Pages 이전 배포 정리 스크립트
# 최근 프로덕션 배포 2개와 최근 Preview 배포 5개만 유지하고 나머지 삭제

PROJECT_NAME="brd-clinic"

echo "🗑️  이전 배포 정리 중..."

# 배포 목록을 JSON으로 가져오기
DEPLOYMENTS=$(npx wrangler pages deployment list --project-name=$PROJECT_NAME --json)

# 프로덕션 배포 ID 목록 (오래된 순)
PRODUCTION_IDS=$(echo "$DEPLOYMENTS" | jq -r '.[] | select(.Environment == "Production") | .Id' | tail -n +3)

# Preview 배포 ID 목록 (오래된 순, 최근 5개 제외)
PREVIEW_IDS=$(echo "$DEPLOYMENTS" | jq -r '.[] | select(.Environment == "Preview") | .Id' | tail -n +6)

# 프로덕션 배포 삭제 (최근 2개 유지)
if [ ! -z "$PRODUCTION_IDS" ]; then
  echo "📦 오래된 프로덕션 배포 삭제 중..."
  echo "$PRODUCTION_IDS" | while read -r deployment_id; do
    if [ ! -z "$deployment_id" ]; then
      echo "  삭제: $deployment_id"
      npx wrangler pages deployment delete $deployment_id --project-name=$PROJECT_NAME --yes
    fi
  done
else
  echo "✅ 삭제할 프로덕션 배포 없음"
fi

# Preview 배포 삭제 (최근 5개 유지)
if [ ! -z "$PREVIEW_IDS" ]; then
  echo "🔍 오래된 Preview 배포 삭제 중..."
  echo "$PREVIEW_IDS" | while read -r deployment_id; do
    if [ ! -z "$deployment_id" ]; then
      echo "  삭제: $deployment_id"
      npx wrangler pages deployment delete $deployment_id --project-name=$PROJECT_NAME --yes
    fi
  done
else
  echo "✅ 삭제할 Preview 배포 없음"
fi

echo "🎉 배포 정리 완료!"
