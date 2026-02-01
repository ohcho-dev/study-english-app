# 📦 백엔드 라이브러리 및 유틸리티 가이드

> **적용 범위:** `apps/server` (FastAPI 백엔드 서버)
> **작성일:** 2026-02-01

---

## 1. 핵심 라이브러리

### 1.1 Framework & Server

| 라이브러리 | 버전 | 용도 | 설치 |
|------------|------|------|------|
| **FastAPI** | 0.109+ | 웹 프레임워크 | `poetry add fastapi` |
| **Uvicorn** | 0.27+ | ASGI 서버 | `poetry add uvicorn[standard]` |
| **Pydantic** | 2.0+ | 데이터 검증 | FastAPI와 함께 설치됨 |
| **pydantic-settings** | 2.0+ | 환경 변수 관리 | `poetry add pydantic-settings` |

```python
# 사용 예시
from fastapi import FastAPI, Depends
from pydantic import BaseModel
from pydantic_settings import BaseSettings

app = FastAPI(title="Study English API")

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    
    class Config:
        env_file = ".env"
```

### 1.2 Database

| 라이브러리 | 버전 | 용도 | 설치 |
|------------|------|------|------|
| **SQLAlchemy** | 2.0+ | ORM | `poetry add sqlalchemy` |
| **asyncpg** | 0.29+ | PostgreSQL 비동기 드라이버 | `poetry add asyncpg` |
| **Alembic** | 1.13+ | DB 마이그레이션 | `poetry add alembic` |

```python
# 사용 예시
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
```

### 1.3 Authentication

| 라이브러리 | 버전 | 용도 | 설치 |
|------------|------|------|------|
| **python-jose** | 3.3+ | JWT 토큰 | `poetry add python-jose[cryptography]` |
| **passlib** | 1.7+ | 비밀번호 해싱 | `poetry add passlib[bcrypt]` |
| **authlib** | 1.3+ | OAuth 클라이언트 | `poetry add authlib` |
| **httpx** | 0.26+ | HTTP 클라이언트 | `poetry add httpx` |

```python
# JWT 사용 예시
from jose import JWTError, jwt
from datetime import datetime, timedelta

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=30)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

def verify_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
```

### 1.4 AI / LangChain

| 라이브러리 | 버전 | 용도 | 설치 |
|------------|------|------|------|
| **langchain** | 0.1+ | AI 프레임워크 | `poetry add langchain` |
| **langchain-openai** | 0.0.5+ | OpenAI 통합 | `poetry add langchain-openai` |
| **langchain-google-genai** | 0.0.6+ | Gemini 통합 | `poetry add langchain-google-genai` |
| **langgraph** | 0.0.50+ | 에이전트 워크플로우 | `poetry add langgraph` |
| **openai** | 1.10+ | OpenAI SDK | `poetry add openai` |

```python
# LangChain 사용 예시
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema.output_parser import StrOutputParser

llm = ChatOpenAI(model="gpt-4", temperature=0)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful English tutor."),
    ("human", "{question}")
])

chain = prompt | llm | StrOutputParser()

async def get_ai_response(question: str) -> str:
    return await chain.ainvoke({"question": question})
```

### 1.5 Cache

| 라이브러리 | 버전 | 용도 | 설치 |
|------------|------|------|------|
| **redis** | 5.0+ | Redis 클라이언트 | `poetry add redis` |

```python
# Redis 사용 예시
import redis.asyncio as redis

redis_client = redis.from_url(settings.REDIS_URL)

async def cache_set(key: str, value: str, expire: int = 3600):
    await redis_client.set(key, value, ex=expire)

async def cache_get(key: str) -> str | None:
    return await redis_client.get(key)
```

---

## 2. 유틸리티 라이브러리

### 2.1 개발 도구

| 라이브러리 | 용도 | 설치 |
|------------|------|------|
| **ruff** | 린터 + 포매터 | `poetry add ruff --group dev` |
| **mypy** | 타입 체커 | `poetry add mypy --group dev` |
| **pytest** | 테스트 | `poetry add pytest pytest-asyncio --group dev` |
| **pytest-cov** | 커버리지 | `poetry add pytest-cov --group dev` |

### 2.2 유용한 유틸리티

| 라이브러리 | 용도 | 설치 |
|------------|------|------|
| **python-multipart** | 파일 업로드 | `poetry add python-multipart` |
| **python-dateutil** | 날짜 처리 | `poetry add python-dateutil` |
| **tenacity** | 재시도 로직 | `poetry add tenacity` |
| **structlog** | 구조화된 로깅 | `poetry add structlog` |

```python
# tenacity 재시도 예시
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10)
)
async def call_external_api():
    # 외부 API 호출
    pass
```

---

## 3. pyproject.toml 예시

```toml
[tool.poetry]
name = "study-english-server"
version = "0.1.0"
description = "AI English Learning Service Backend"
authors = ["Your Name <you@example.com>"]

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.109.0"
uvicorn = {extras = ["standard"], version = "^0.27.0"}
pydantic-settings = "^2.1.0"
sqlalchemy = "^2.0.25"
asyncpg = "^0.29.0"
alembic = "^1.13.1"
python-jose = {extras = ["cryptography"], version = "^3.3.0"}
passlib = {extras = ["bcrypt"], version = "^1.7.4"}
authlib = "^1.3.0"
httpx = "^0.26.0"
redis = "^5.0.1"
langchain = "^0.1.0"
langchain-openai = "^0.0.5"
langchain-google-genai = "^0.0.6"
langgraph = "^0.0.50"
python-multipart = "^0.0.6"
tenacity = "^8.2.3"
structlog = "^24.1.0"

[tool.poetry.group.dev.dependencies]
ruff = "^0.1.14"
mypy = "^1.8.0"
pytest = "^7.4.4"
pytest-asyncio = "^0.23.3"
pytest-cov = "^4.1.0"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]
ignore = ["E501"]

[tool.mypy]
python_version = "3.11"
strict = true
ignore_missing_imports = true

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

---

## 4. Docker 설정

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Poetry 설치
RUN pip install poetry
RUN poetry config virtualenvs.create false

# 의존성 설치
COPY pyproject.toml poetry.lock ./
RUN poetry install --no-dev --no-interaction

# 앱 복사
COPY app ./app

# 실행
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/studyenglish
      - REDIS_URL=redis://redis:6379
      - SECRET_KEY=your-secret-key
    depends_on:
      - db
      - redis
    volumes:
      - ./app:/app/app  # 개발용 핫리로드

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=studyenglish
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

---

## 5. 스크립트 명령어

```bash
# 개발 서버 실행
poetry run uvicorn app.main:app --reload --port 8000

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

# Docker 실행
docker-compose up -d
```

---

## 6. 체크리스트

새 라이브러리 추가 시:

- [ ] `poetry add` 명령어로 설치
- [ ] `pyproject.toml`에 추가 확인
- [ ] 사용 예시 및 패턴 문서화
- [ ] 필요시 환경 변수 추가 (`.env.example`)
