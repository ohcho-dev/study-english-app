#!/bin/bash
# Server + Admin 전체를 GCP Cloud Run에 배포하는 스크립트

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 전체 배포를 시작합니다 (Server + Admin)..."
echo "==================================================="

# 1. Server 배포
echo ""
echo "📦 [1/2] Server 배포..."
echo "---------------------------------------------------"
bash "$SCRIPT_DIR/deploy-server.sh"

# 2. Admin 배포
echo ""
echo "📦 [2/2] Admin 배포..."
echo "---------------------------------------------------"
bash "$SCRIPT_DIR/deploy-admin.sh"

echo ""
echo "==================================================="
echo "✅ 전체 배포 완료!"
echo ""
echo "🔗 Server: https://study-english-server-963239184273.us-central1.run.app"
echo "📚 API Docs: https://study-english-server-963239184273.us-central1.run.app/docs"
echo "🔗 Admin:  https://study-english-admin-963239184273.us-central1.run.app"
echo "==================================================="
