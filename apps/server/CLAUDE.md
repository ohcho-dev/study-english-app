# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Server app.

## Overview

FastAPI 기반 백엔드 서버. AI 파이프라인 실행, 대화 관리, 인증, 콘텐츠 관리 API 제공.

## Commands

```bash
# 의존성
poetry install

# 로컬 인프라 (PostgreSQL + Redis)
docker-compose up -d

# DB 마이그레이션
poetry run alembic upgrade head                          # 적용
poetry run alembic revision --autogenerate -m "설명"     # 생성
poetry run alembic downgrade -1                          # 롤백

# 개발 서버
poetry run uvicorn app.main:app --reload                 # http://localhost:8000

# 테스트
poetry run pytest                        # 전체
poetry run pytest tests/api/             # API 테스트만
poetry run pytest tests/services/        # 서비스 테스트만
poetry run pytest -k "test_name"         # 특정 테스트

# 코드 품질
poetry run ruff check .                  # 린트
poetry run ruff check . --fix            # 린트 자동 수정
poetry run mypy .                        # 타입 체크
```

## Architecture

### 레이어드 아키텍처

```
app/
├── main.py              # FastAPI 앱 엔트리 (CORS, 라우트 등록, lifespan)
├── api/
│   ├── v1/router.py     # v1 메인 라우터 (sub-router 통합)
│   ├── v1/*.py          # 엔드포인트 모듈별 라우터
│   └── deps.py          # 의존성 주입 (DB 세션, 인증)
├── core/
│   ├── config.py        # Pydantic Settings (.env 로딩)
│   ├── database.py      # SQLAlchemy async 엔진/세션
│   ├── security.py      # JWT 생성/검증, bcrypt
│   └── exceptions.py    # 커스텀 예외 (NotFound, Unauthorized, Forbidden, BadRequest, Conflict)
├── models/              # SQLAlchemy ORM 모델 (TimestampMixin, UUIDMixin)
├── schemas/             # Pydantic 요청/응답 스키마
├── services/            # 비즈니스 로직
│   ├── ai_lab/          # 파이프라인, 실험, 체인 빌더, TTS, 벤치마크
│   ├── conversation/    # My Turn, RUN0, 템플릿, 세션, STT/TTS, WebRTC
│   └── ai/              # AI 유틸리티
├── static/audio/        # TTS 출력 파일 (런타임 생성)
├── scripts/
│   └── init_access_control.py  # 초기 계정/권한 시딩 (Docker 시작 시 실행)
└── migrations/          # Alembic 마이그레이션 버전
```

### API 엔드포인트 구조

Prefix: `/api/v1`

| 모듈 | 경로 | 용도 |
|------|------|------|
| auth | `/auth` | 로그인, OAuth, JWT, 계정 관리 |
| conversations | `/conversations` | 템플릿, 세션, My Turn, RUN0 |
| ai_lab | `/ai-lab` | 파이프라인 설계 & 실험 실행 |
| prompts | `/prompts` | AI 프롬프트 CRUD |
| scenarios | `/scenarios` | 학습 시나리오 관리 |
| themes | `/themes` | 학습 테마 관리 |
| variables | `/variables` | 실험 변수 (A/B 테스트) |
| audio | `/audio` | TTS/STT 엔드포인트 |
| logs | `/logs` | 실험 로그 조회 |
| analytics | `/analytics` | 분석 데이터 |
| admin | `/admin` | 관리자 작업 |

Swagger UI: `/docs`, ReDoc: `/redoc`, Health: `/health`

### 의존성 주입 (deps.py)

```python
# 타입 별칭으로 깔끔한 엔드포인트 시그니처
DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUserId = Annotated[str, Depends(get_current_user_id)]
CurrentAccount = Annotated[object, Depends(get_current_account)]
AdminAccount = Annotated[object, Depends(require_admin)]
```

### 서비스 레이어 패턴

```python
class TemplateService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_templates(self, skip: int, limit: int) -> list[Template]:
        result = await self.db.execute(
            select(Template).offset(skip).limit(limit)
        )
        return list(result.scalars().all())
```

- 생성자에서 `AsyncSession` 주입
- 모든 메서드 async/await
- SQLAlchemy 2.0 `select()` API 사용 (레거시 `query()` 사용 금지)
- Stateless — 상태 저장 없음

## ORM 모델 패턴

```python
# 공통 Mixin
class TimestampMixin:   # created_at, updated_at (자동)
class UUIDMixin:        # id = UUID primary key
```

주요 모델 카테고리:
- **Account, PagePermission** — 인증/권한
- **ConversationTemplate, ConversationParticipant** — 대화 템플릿
- **ConversationSession, ConversationTurn, SessionMetrics** — 대화 세션/턴
- **Pipeline, PipelineAgent, PipelineLog** — AI Lab 파이프라인
- **Theme, ThemeVersion, AIPrompt, AIPromptVersion** — 콘텐츠 버저닝
- **Experiment, ExperimentVariable, UserCohort** — A/B 테스트
- **Scenario, ScenarioStep** — 학습 시나리오

## 인증 & 보안

- JWT (python-jose): `create_access_token()`, `create_refresh_token()`, `verify_token()`
- 비밀번호: bcrypt (passlib)
- Bearer 토큰 → 헤더에서 추출 → DB에서 Account 조회
- 역할: `admin` (전체 접근), `tester` (라우트별 제한)
- 초기 계정: username `admin`, password `admin123` (init_access_control.py에서 생성)

## 환경 변수

```bash
# 앱
APP_NAME, DEBUG, API_V1_PREFIX

# 데이터베이스
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/studyenglish

# 캐시
REDIS_URL=redis://localhost:6379

# JWT
SECRET_KEY, ALGORITHM=HS256, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS

# OAuth
KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET
NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# AI & Cloud
GOOGLE_AI_API_KEY              # Gemini API
GOOGLE_CLOUD_STT_TTS_API_KEY   # Speech/TTS
GOOGLE_CLOUD_PROJECT            # GCP 프로젝트
OPENAI_API_KEY                  # OpenAI (선택)

# 스토리지
GCS_BUCKET_NAME                 # GCS 버킷 (없으면 로컬 static/audio 사용)

# CORS
CORS_ORIGINS                    # 추가 origin (쉼표 구분)
```

설정 파일: `.env`, `.env.local` (Pydantic Settings로 로딩)

## 코드 컨벤션

- **Type hints**: 모든 함수에 파라미터 타입 + 리턴 타입 명시
- **Async/await**: 모든 DB I/O는 비동기
- **Pydantic 스키마**: Base → Create → Update → Response 패턴으로 분리
- **라우터**: 반드시 `response_model` 지정
- **Docstrings**: Google Style
- **네이밍**: 파일 `snake_case.py`, 클래스 `PascalCase`, 함수/변수 `snake_case`, 상수 `UPPER_SNAKE_CASE`
- **ruff**: line-length 100, 룰 E/F/I/N/W/UP
- **mypy**: strict 모드, ignore_missing_imports
- **pytest**: asyncio_mode auto, testpaths `tests/`

## 앱 라이프사이클

- **시작 시**: 오래된 대화 세션 정리 + 주기적 정리 백그라운드 태스크 (30분 간격)
- **CORS**: localhost:3000 + Cloud Run Admin URL 기본 허용
- **Static Files**: `/static` → `app/static/` (TTS 오디오)
- **예외 처리**: 전역 핸들러에서 CORS 헤더 보존

## Docker

```bash
# 로컬 개발 (PostgreSQL 15 + Redis 7)
docker-compose up -d

# 프로덕션 (Dockerfile)
# Base: python:3.11-slim + ffmpeg
# 시작: alembic upgrade head → init_access_control → uvicorn
# Cloud Run: PORT 환경변수 사용 (기본 8080)
```
