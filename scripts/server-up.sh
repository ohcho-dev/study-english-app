#!/bin/bash
# 배포 서버(Server + Admin) 외부 접근 활성화

set -e

PROJECT_ID="gen-lang-client-0737324328"
REGION="us-central1"

echo "🟢 배포 서버를 활성화합니다..."

# Ingress 열기
gcloud run services update study-english-server \
  --ingress=all \
  --region="$REGION" \
  --project="$PROJECT_ID"

gcloud run services update study-english-admin \
  --ingress=all \
  --region="$REGION" \
  --project="$PROJECT_ID"

# 외부 접근 허용 (allUsers)
gcloud run services add-iam-policy-binding study-english-server \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --member="allUsers" \
  --role="roles/run.invoker"

gcloud run services add-iam-policy-binding study-english-admin \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --member="allUsers" \
  --role="roles/run.invoker"

echo ""
echo "✅ 서버 활성화 완료!"
echo "🔗 Server: https://study-english-server-963239184273.$REGION.run.app"
echo "🔗 Admin:  https://study-english-admin-963239184273.$REGION.run.app"
