#!/bin/bash
# Server만 GCP Cloud Run에 배포하는 스크립트

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_ROOT/apps/server"

PROJECT_ID="gen-lang-client-0737324328"
SERVICE_NAME="study-english-server"
REGION="us-central1"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🚀 Server 배포를 시작합니다..."
echo "---------------------------------------------------"

# 1. Build
echo "🏗️  Docker 이미지 빌드 중... (3~5분 소요)"
cd "$SERVER_DIR"
gcloud builds submit --tag "$IMAGE" --project="$PROJECT_ID"

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
echo "✅ Server 배포 완료!"
echo "🔗 URL: https://$SERVICE_NAME-963239184273.$REGION.run.app"
echo "📚 API Docs: https://$SERVICE_NAME-963239184273.$REGION.run.app/docs"
echo "---------------------------------------------------"
