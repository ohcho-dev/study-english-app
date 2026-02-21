#!/bin/bash
# 배포 서버(Server + Admin) 외부 접근 차단

set -e

PROJECT_ID="gen-lang-client-0737324328"
REGION="us-central1"

echo "🔴 배포 서버를 비활성화합니다..."

gcloud run services update study-english-server \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --no-allow-unauthenticated

gcloud run services update study-english-admin \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --no-allow-unauthenticated

echo ""
echo "🔒 서버 비활성화 완료! 외부 접근이 차단되었습니다."
