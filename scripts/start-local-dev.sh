#!/bin/bash
# 로컬 전체 개발 환경 실행 (Server + Admin)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_ROOT/apps/server"

echo "🚀 로컬 개발 환경을 시작합니다..."
echo "==================================================="

# --- Docker 자동 시작 ---
if ! docker info > /dev/null 2>&1; then
    echo "🐳 Docker가 실행되고 있지 않습니다. Docker Desktop을 시작합니다..."
    open -a Docker
    echo "⏳ Docker 시작 대기 중..."
    while ! docker info > /dev/null 2>&1; do
        sleep 2
    done
    echo "✅ Docker 시작 완료!"
fi

# --- 사용 중인 포트 정리 ---
kill_port() {
    local port=$1
    local pid=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo "⚠️  포트 $port 사용 중 (PID: $pid) → 종료합니다"
        kill -9 $pid 2>/dev/null
        sleep 1
    fi
}

kill_port 8000
kill_port 3000

# --- Docker DB + Redis ---
echo "🐳 Docker 컨테이너 시작 (PostgreSQL + Redis)..."
cd "$SERVER_DIR"
docker compose up -d db redis

# DB 준비 대기
echo "⏳ DB 시작 대기 중..."
sleep 3

# --- Server ---
echo "🟢 Server 시작 중 (port 8000)..."
cd "$SERVER_DIR"

# 마이그레이션
poetry run alembic upgrade head 2>/dev/null || echo "⚠️  마이그레이션 스킵 (이미 최신)"

# 서버 백그라운드 실행
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
SERVER_PID=$!

echo "⏳ Server 시작 대기 중..."
sleep 3

# --- Admin ---
echo "🟢 Admin 시작 중 (port 3000)..."
cd "$PROJECT_ROOT"

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
