#!/bin/bash

# Admin 서버를 HTTPS로 외부 공유 가능하게 실행하는 스크립트 (Production Mode)
# ngrok이 필요합니다: brew install ngrok

# 프로젝트 루트 경로로 이동
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Admin 서버 프로덕션 배포를 준비합니다..."

# 1. Build
echo "🏗️  Building Admin App..."
# pnpm build command for admin
pnpm --filter admin build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Aborting."
    exit 1
fi

# 3. Ngrok Info
echo "---------------------------------------------------"
if [ -f "apps/admin/.env.local" ]; then
    echo "✅ Found apps/admin/.env.local"
    # export vars for the build process (ignoring comments)
    export $(grep -v '^#' apps/admin/.env.local | xargs)
    echo "Using NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"
else
    echo "⚠️  No .env.local found. Defaulting to localhost or .env"
fi
echo "---------------------------------------------------"

# 4. Kill existing process on port 3000
echo "🧹 Cleaning up port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# 2. Start (Moved here to ensure Env is loaded)
echo "🟢 Starting Admin App in Production mode..."
# 백그라운드에서 admin 서버 시작 (start는 next start를 실행)
pnpm --filter admin start &
ADMIN_PID=$!

echo "Admin App is running at port 3000."
echo "If you ran ./scripts/share-network.sh, use the Admin Ngrok URL to access it."
echo "---------------------------------------------------"

# 스크립트 종료 시 admin 서버도 종료
wait $ADMIN_PID
