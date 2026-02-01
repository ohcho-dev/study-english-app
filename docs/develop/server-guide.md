# 서버 실행 가이드

## 빠른 시작

```bash
# 서버 실행 (Docker + 마이그레이션 + 서버 한 번에)
sh scripts/start-server.sh
```

### API 문서
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 사전 준비

### 1. Poetry 설치
```bash
pip install poetry
```

### 2. 의존성 설치
```bash
cd apps/server && poetry install
```

### 3. 환경 변수 설정
```bash
cd apps/server && cp .env.example .env
```

---

## 데이터베이스

### Docker 컨테이너 관리
```bash
cd apps/server

# 시작
docker compose up -d db redis

# 상태 확인
docker compose ps

# 중지 (데이터 유지)
docker compose stop

# 삭제 (데이터 유지)
docker compose down

# 완전 초기화 (데이터 삭제)
docker compose down -v
```

### Alembic 마이그레이션

| 명령어 | 설명 |
|--------|------|
| `poetry run alembic upgrade head` | 모든 마이그레이션 실행 |
| `poetry run alembic revision --autogenerate -m "설명"` | 마이그레이션 생성 |
| `poetry run alembic downgrade -1` | 롤백 |
| `poetry run alembic history` | 히스토리 확인 |

**첫 마이그레이션 생성:**
```bash
cd apps/server
poetry run alembic revision --autogenerate -m "create initial tables"
poetry run alembic upgrade head
```

---

## 개발 명령어

| 명령어 | 설명 |
|--------|------|
| `poetry run uvicorn app.main:app --reload` | 개발 서버 |
| `poetry run ruff check app` | 린트 체크 |
| `poetry run ruff format app` | 코드 포맷팅 |
| `poetry run mypy app` | 타입 체크 |
| `poetry run pytest tests/ -v` | 테스트 실행 |

---

## API 엔드포인트

| 모듈 | 경로 | 설명 |
|------|------|------|
| Variables | `/api/v1/variables` | Feature Flags |
| Prompts | `/api/v1/prompts` | AI 프롬프트 |
| Scenarios | `/api/v1/scenarios` | 학습 시나리오 |
| Logs | `/api/v1/logs` | 이벤트 로그 |
| Analytics | `/api/v1/analytics` | 분석 대시보드 |
