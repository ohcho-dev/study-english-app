#!/bin/bash

# Admin 서버를 개발 모드(Dev Mode)로 외부 공유 가능하게 실행하는 스크립트
# ngrok이 필요합니다: brew install ngrok
# 주의: 이 스크립트는 로컬에서 Admin App을 실행합니다. ngrok은 별도로 실행되어야 합니다 (예: ./scripts/share-network.sh).

# 프로젝트 루트 경로로 이동
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Admin 서버 개발 모드(Dev Mode)를 준비합니다..."

# 1. Kill existing process on port 3000
echo "🧹 Cleaning up port 3000..."
# lsof가 없거나 실패해도 스크립트가 중단되지 않도록 함
if lsof -ti:3000 >/dev/null; then
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    echo "   - Killed process on port 3000."
else
    echo "   - Port 3000 is free."
fi

# 1.1 Remove stale Next.js lock file
LOCK_FILE="apps/admin/.next/dev/lock"
if [ -f "$LOCK_FILE" ]; then
    echo "🔓 Removing stale lock file: $LOCK_FILE"
    rm "$LOCK_FILE"
fi

# 2. Env Load
echo "---------------------------------------------------"
if [ -f "apps/admin/.env.local" ]; then
    echo "✅ Found apps/admin/.env.local"
    # export vars for the process (ignoring comments)
    export $(grep -v '^#' apps/admin/.env.local | xargs)
    echo "Using NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"
else
    echo "⚠️  No .env.local found. Defaulting to localhost or .env"
fi
echo "---------------------------------------------------"

# 3. Start Dev Server
echo "🟢 Starting Admin App in Dev mode..."
# pnpm dev 실행
pnpm --filter admin dev
