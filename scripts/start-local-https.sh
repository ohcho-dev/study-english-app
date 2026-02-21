#!/bin/bash
# Admin을 HTTPS로 실행 (같은 네트워크 모바일 테스트용)
# 마이크 접근 권한은 https:// 또는 localhost에서만 동작합니다.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_ROOT/apps/server"

# 로컬 IP 가져오기
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "unknown")

echo "🔒 HTTPS 로컬 개발 환경을 시작합니다..."
echo "==================================================="

# 1. Docker DB + Redis
echo "🐳 Docker 컨테이너 시작 (PostgreSQL + Redis)..."
cd "$SERVER_DIR"
docker compose up -d db redis

# 2. Server (백그라운드)
echo "🟢 Server 시작 중 (port 8000)..."
cd "$SERVER_DIR"
poetry run alembic upgrade head 2>/dev/null || echo "⚠️  마이그레이션 스킵"
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
SERVER_PID=$!

sleep 3

# 3. Admin (HTTPS 모드)
echo "🔒 Admin HTTPS 시작 중 (port 3000)..."
cd "$PROJECT_ROOT"

# .env.local 설정
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > apps/admin/.env.local

pnpm --filter admin dev:https &
ADMIN_PID=$!

echo ""
echo "==================================================="
echo "✅ HTTPS 로컬 개발 환경 준비 완료!"
echo ""
echo "🔗 Server: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "🔒 Admin (로컬):  https://localhost:3000"
echo "📱 Admin (모바일): https://$LOCAL_IP:3000"
echo ""
echo "⚠️  모바일에서 접속 시 '안전하지 않은 연결' 경고 → '고급 → 계속' 클릭"
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
