#!/bin/bash
# 서버 실행 스크립트

# 프로젝트 루트 경로로 이동
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_ROOT/apps/server"

cd "$SERVER_DIR" || { echo "❌ Server directory not found: $SERVER_DIR"; exit 1; }

# Docker 컨테이너 실행 (PostgreSQL + Redis)
echo "🐳 Starting Docker containers..."
docker compose up -d db redis

# 의존성 설치 (lock 파일 갱신 포함)
echo "📦 Installing dependencies..."
poetry lock --no-update 2>/dev/null || poetry lock
poetry install

# 마이그레이션 처리
MIGRATIONS_DIR="$SERVER_DIR/migrations/versions"
if [ -z "$(ls -A $MIGRATIONS_DIR 2>/dev/null)" ]; then
    # 첫 실행: 마이그레이션 파일 생성
    echo "🔧 First run detected. Creating initial migration..."
    poetry run alembic revision --autogenerate -m "create initial tables"
fi

# 마이그레이션 적용
echo "🔄 Applying migrations..."
poetry run alembic upgrade head

# 서버 실행
echo "🚀 Starting server at http://localhost:8000"
echo "📚 API docs: http://localhost:8000/docs"
poetry run uvicorn app.main:app --reload --port 8000
