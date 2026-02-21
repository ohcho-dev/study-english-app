#!/bin/bash
# 로컬 전체 개발 환경 실행 (Server + Admin)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_ROOT/apps/server"

echo "🚀 로컬 개발 환경을 시작합니다..."
echo "==================================================="

# 1. Docker DB + Redis
echo "🐳 Docker 컨테이너 시작 (PostgreSQL + Redis)..."
cd "$SERVER_DIR"
docker compose up -d db redis

# 2. Server (백그라운드)
echo "🟢 Server 시작 중 (port 8000)..."
cd "$SERVER_DIR"

# 마이그레이션
poetry run alembic upgrade head 2>/dev/null || echo "⚠️  마이그레이션 스킵 (이미 최신)"

# 서버 백그라운드 실행
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
SERVER_PID=$!

echo "⏳ Server 시작 대기 중..."
sleep 3

# 3. Admin
echo "🟢 Admin 시작 중 (port 3000)..."
cd "$PROJECT_ROOT"

# .env.local 설정 (로컬 서버 사용)
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > apps/admin/.env.local

pnpm --filter admin dev &
ADMIN_PID=$!

echo ""
echo "==================================================="
echo "✅ 로컬 개발 환경 준비 완료!"
echo ""
echo "🔗 Server: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo "🔗 Admin:  http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services."
echo "==================================================="

# 종료 시 정리
cleanup() {
    echo ""
    echo "🧹 서비스 종료 중..."
    kill $SERVER_PID 2>/dev/null
    kill $ADMIN_PID 2>/dev/null
    echo "✅ 종료 완료"
}

trap cleanup EXIT INT TERM
wait
