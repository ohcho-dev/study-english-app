#!/bin/bash
# Admin만 GCP Cloud Run에 배포하는 스크립트

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ADMIN_DIR="$PROJECT_ROOT/apps/admin"

PROJECT_ID="gen-lang-client-0737324328"
SERVICE_NAME="study-english-admin"
REGION="us-central1"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"
SERVER_URL="https://study-english-server-963239184273.$REGION.run.app"

echo "🚀 Admin 배포를 시작합니다..."
echo "---------------------------------------------------"

# 1. Build (with Server URL)
echo "🏗️  Docker 이미지 빌드 중... (3~5분 소요)"
cd "$ADMIN_DIR"
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions="_NEXT_PUBLIC_API_URL=$SERVER_URL" \
  --project="$PROJECT_ID"

if [ $? -ne 0 ]; then
    echo "❌ 빌드 실패. 배포를 중단합니다."
    exit 1
fi

# 2. Deploy
echo "🚀 Cloud Run에 배포 중..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --project="$PROJECT_ID"

echo "---------------------------------------------------"
echo "✅ Admin 배포 완료!"
echo "🔗 URL: https://$SERVICE_NAME-963239184273.$REGION.run.app"
echo "---------------------------------------------------"
