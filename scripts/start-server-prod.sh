#!/bin/bash
# 서버 프로덕션 모드 실행 스크립트

# 프로젝트 루트 경로로 이동
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_ROOT/apps/server"

cd "$SERVER_DIR" || { echo "❌ Server directory not found: $SERVER_DIR"; exit 1; }

# Docker 컨테이너 실행 (PostgreSQL + Redis)
echo "🐳 Starting Docker containers..."
docker compose up -d db redis

# 의존성 설치 (필요시)
echo "📦 Checking dependencies..."
poetry install --only main

# 마이그레이션 적용
echo "🔄 Applying migrations..."
poetry run alembic upgrade head

# 서버 실행 (Production Mode)
echo "🚀 Starting server in PRODUCTION mode at http://0.0.0.0:8000"
echo "⚙️  Workers: 4"
echo "📚 Docs: Disabled in production recommended (but available at /docs)"

# workers 설정으로 멀티 프로세스 실행, reload 비활성화
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
