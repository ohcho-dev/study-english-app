# Study English API Server

AI 영어 학습 서비스 백엔드 API 서버 (FastAPI)

## 기술 스택

- **Framework**: FastAPI 0.109+
- **Database**: PostgreSQL + SQLAlchemy 2.0 (async)
- **Cache**: Redis
- **AI**: LangChain + Google Gemini
- **Auth**: JWT + OAuth (Kakao/Naver/Google)

## 프로젝트 구조

```
apps/server/
├── app/
│   ├── api/              # API 라우트
│   │   ├── deps.py       # 공통 의존성
│   │   └── v1/           # v1 API
│   ├── core/             # 핵심 설정
│   │   ├── config.py     # 환경 변수
│   │   ├── database.py   # DB 연결
│   │   ├── security.py   # JWT
│   │   └── exceptions.py # 커스텀 예외
│   ├── models/           # SQLAlchemy 모델
│   ├── schemas/          # Pydantic 스키마
│   ├── services/         # 비즈니스 로직
│   └── main.py           # 앱 진입점
├── migrations/           # Alembic 마이그레이션
├── tests/                # 테스트
├── docker-compose.yml    # 로컬 개발 환경
└── pyproject.toml        # Poetry 의존성
```

## 시작하기

### 1. 환경 설정

```bash
# 환경 변수 파일 생성
cp .env.example .env

# 필요한 값 수정 (특히 SECRET_KEY, API 키 등)
```

### 2. 의존성 설치

```bash
# Poetry 설치 (없는 경우)
pip install poetry

# 의존성 설치
poetry install
```

### 3. 개발 서버 실행

**방법 1: 직접 실행 (로컬 DB 필요)**

```bash
poetry run uvicorn app.main:app --reload --port 8000
```

**방법 2: Docker Compose (권장)**

```bash
docker-compose up -d
```

### 4. API 문서 확인

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health Check: http://localhost:8000/health

## 개발 명령어

```bash
# 린트 체크
poetry run ruff check app

# 포맷팅
poetry run ruff format app

# 타입 체크
poetry run mypy app

# 테스트
poetry run pytest tests/ -v

# 마이그레이션 생성
poetry run alembic revision --autogenerate -m "description"

# 마이그레이션 적용
poetry run alembic upgrade head
```

## API 엔드포인트

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/health` | GET | 헬스 체크 |
| `/docs` | GET | Swagger UI |
| `/api/v1/...` | - | v1 API (개발 중) |

## 관련 문서

- [아키텍처 설계](../../docs/plan/architecture.md)
- [데이터 스키마](../../docs/plan/data-schema.md)
- [코드 컨벤션](../../.gemini/rules/server/code-convention.md)
- [개발 프로세스](../../.gemini/rules/server/dev-process.md)
