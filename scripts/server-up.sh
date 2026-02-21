#!/bin/bash
# 배포 서버(Server + Admin) 외부 접근 활성화

set -e

PROJECT_ID="gen-lang-client-0737324328"
REGION="us-central1"

echo "🟢 배포 서버를 활성화합니다..."

gcloud run services update study-english-server \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --allow-unauthenticated

gcloud run services update study-english-admin \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --allow-unauthenticated

echo ""
echo "✅ 서버 활성화 완료!"
echo "🔗 Server: https://study-english-server-963239184273.$REGION.run.app"
echo "🔗 Admin:  https://study-english-admin-963239184273.$REGION.run.app"
