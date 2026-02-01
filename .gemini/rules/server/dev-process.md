# 백엔드 서버 개발 사고 프레임워크

> **⚠️ 중요**: 모든 백엔드 API 및 서비스 구현 시 이 프레임워크를 반드시 따릅니다.
> **적용 범위:** `apps/server` (FastAPI 백엔드 서버)

---

## Phase 1: 요청 분석 및 기획

### 1.1 사용자 요청 이해

- 이 API의 **핵심 목적**은 무엇인가?
- 누가 이 API를 호출하는가? (모바일 앱, 관리자, 내부 서비스)
- 필요한 **입력/출력 데이터**는 무엇인가?
- **인증/권한**이 필요한가? (public, user, admin)

### 1.2 기존 코드 확인

- 이미 구현된 **유사한 API**가 있는가? (`app/api/` 확인)
- 재사용 가능한 **서비스**가 있는가? (`app/services/` 확인)
- 관련된 **모델**이 이미 정의되어 있는가? (`app/models/` 확인)
- 필요한 **스키마**가 있는가? (`app/schemas/` 확인)

### 1.3 구현 범위 정의

- **새로 만들어야 할 것**: 라우터, 서비스, 모델, 스키마
- **수정해야 할 것**: 기존 파일 목록
- **재사용할 것**: import할 모듈 목록

---

## Phase 2: 레이어 분석 (계층형 아키텍처)

### 2.1 레이어 결정 기준

각 코드가 어느 레이어에 속하는지 판단합니다:

| 레이어 | 책임 | 위치 |
|--------|------|------|
| **Router (API)** | HTTP 요청 파싱, 응답 반환 | `app/api/` |
| **Service** | 비즈니스 로직, AI 호출, 계산 | `app/services/` |
| **Repository** | DB 쿼리, 데이터 접근 | `app/repositories/` |
| **Model** | SQLAlchemy ORM 모델 | `app/models/` |
| **Schema** | Pydantic 요청/응답 스키마 | `app/schemas/` |
| **Core** | 설정, 보안, DB 연결 | `app/core/` |

### 2.2 의존성 방향 확인

**핵심 규칙: 상위 레이어만 하위 레이어를 import**

```
Router → Service → Repository → Model
             ↓
          Schema
```

- ❌ `Model`에서 `Service` import 금지
- ❌ `Service`에서 `Router` import 금지
- ✅ `Router`에서 `Service`, `Schema` import 가능
- ✅ `Service`에서 `Repository`, `Schema` import 가능

### 2.3 폴더 구조

```
apps/server/
├── app/
│   ├── api/                      # API 라우트
│   │   ├── __init__.py
│   │   ├── deps.py               # 공통 의존성 (get_db, get_current_user)
│   │   ├── v1/                   # 버전별 API
│   │   │   ├── __init__.py
│   │   │   ├── router.py         # 메인 라우터
│   │   │   ├── experiments.py    # 🧪 실험 관리
│   │   │   ├── variables.py      # 🧪 변수 관리 (Feature Flags)
│   │   │   ├── cohorts.py        # 🧪 코호트 관리
│   │   │   ├── prompts.py        # 🧪 AI 프롬프트
│   │   │   ├── scenarios.py      # 📦 시나리오 (콘텐츠)
│   │   │   ├── analytics.py      # 🧪 분석 대시보드
│   │   │   ├── users.py          # ⚙️ 사용자
│   │   │   └── themes.py         # ⚙️ 테마
│   │   ├── auth/
│   │   │   └── oauth.py
│   │   └── ai/
│   │       └── chat.py           # AI 스트리밍 채팅
│   ├── core/                     # 핵심 설정
│   │   ├── config.py             # 환경 변수 (Pydantic Settings)
│   │   ├── database.py           # DB 연결
│   │   ├── security.py           # JWT, 비밀번호 해싱
│   │   └── exceptions.py         # 커스텀 예외
│   ├── models/                   # SQLAlchemy 모델
│   │   ├── __init__.py
│   │   ├── base.py               # Base 클래스
│   │   ├── user.py
│   │   ├── experiment.py         # 🧪 experiments, experiment_variables
│   │   ├── cohort.py             # 🧪 user_cohorts
│   │   ├── experiment_log.py     # 🧪 experiment_logs
│   │   ├── ai_prompt.py          # 🧪 ai_prompts, ai_prompt_versions
│   │   ├── scenario.py           # 📦 scenarios, scenario_steps
│   │   └── theme.py              # ⚙️ themes, theme_versions
│   ├── schemas/                  # Pydantic 스키마
│   │   ├── __init__.py
│   │   ├── common.py             # 공통 스키마 (Pagination, Response)
│   │   ├── user.py
│   │   ├── experiment.py
│   │   ├── prompt.py
│   │   ├── scenario.py
│   │   └── theme.py
│   ├── services/                 # 비즈니스 로직
│   │   ├── __init__.py
│   │   ├── experiment_service.py # 🧪 실험 생성/관리
│   │   ├── variable_service.py   # 🧪 변수 조회/수정
│   │   ├── cohort_service.py     # 🧪 코호트 배정
│   │   ├── prompt_service.py     # 🧪 프롬프트 관리
│   │   ├── scenario_service.py   # 📦 시나리오 CRUD
│   │   ├── analytics_service.py  # 🧪 분석/통계
│   │   └── ai/
│   │       ├── __init__.py
│   │       ├── agent.py          # LangChain 에이전트
│   │       └── chains.py         # LangChain 체인
│   ├── repositories/             # 데이터 접근 (선택)
│   │   └── experiment_repository.py
│   └── main.py                   # FastAPI 앱 진입점
├── migrations/                   # Alembic 마이그레이션
│   ├── versions/
│   ├── env.py
│   └── alembic.ini
├── tests/
│   ├── conftest.py
│   ├── api/
│   └── services/
├── scripts/                      # 유틸리티 스크립트
│   └── seed_data.py
├── Dockerfile
├── docker-compose.yml
├── pyproject.toml
└── README.md
```

---

## Phase 3: 코드 작성 규칙

### 3.1 Router (API) 작성

```python
# app/api/v1/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.api.deps import get_db, get_current_user
from app.schemas.user import UserResponse, UserCreate, UserUpdate
from app.services.user_service import UserService
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """사용자 조회
    
    Args:
        user_id: 조회할 사용자 ID
        
    Returns:
        사용자 정보
        
    Raises:
        HTTPException: 사용자를 찾을 수 없는 경우 404
    """
    service = UserService(db)
    user = await service.get_by_id(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """사용자 생성"""
    service = UserService(db)
    return await service.create(data)
```

### 3.2 Service 작성

```python
# app/services/user_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    """사용자 관련 비즈니스 로직"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_id(self, user_id: UUID) -> User | None:
        """ID로 사용자 조회"""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_email(self, email: str) -> User | None:
        """이메일로 사용자 조회"""
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def create(self, data: UserCreate) -> User:
        """사용자 생성"""
        user = User(**data.model_dump())
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
    
    async def update(self, user: User, data: UserUpdate) -> User:
        """사용자 수정"""
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)
        
        await self.db.commit()
        await self.db.refresh(user)
        return user
```

### 3.3 Model 작성

```python
# app/models/user.py
from sqlalchemy import Column, String, Integer, Enum, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.models.base import Base


class User(Base):
    """사용자 모델"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    
    # OAuth
    provider = Column(String(20), nullable=False)  # kakao, naver, google
    provider_id = Column(String(255), nullable=False)
    
    # Role & Level
    role = Column(Enum("user", "admin", name="user_role"), default="user")
    level = Column(Integer, default=1)
    xp = Column(Integer, default=0)
    
    # Timestamps
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    progress = relationship("UserProgress", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("UserSettings", back_populates="user", uselist=False)
    
    def __repr__(self) -> str:
        return f"<User {self.email}>"
```

### 3.4 Schema 작성

```python
# app/schemas/user.py
from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"


# 기본 필드 (공통)
class UserBase(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)


# 생성용
class UserCreate(UserBase):
    provider: str
    provider_id: str


# 수정용
class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    avatar_url: str | None = None


# 응답용
class UserResponse(UserBase):
    id: UUID
    avatar_url: str | None
    role: UserRole
    level: int
    xp: int
    created_at: datetime
    
    class Config:
        from_attributes = True  # ORM 모드


# 리스트 응답용
class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    size: int
```

### 3.5 Core 설정

```python
# app/core/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """환경 변수 설정"""
    
    # App
    APP_NAME: str = "Study English API"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    
    # Database
    DATABASE_URL: str
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # OAuth
    KAKAO_CLIENT_ID: str = ""
    KAKAO_CLIENT_SECRET: str = ""
    NAVER_CLIENT_ID: str = ""
    NAVER_CLIENT_SECRET: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    
    # AI
    OPENAI_API_KEY: str = ""
    GOOGLE_AI_API_KEY: str = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
```

---

## Phase 4: 검증

### 4.1 타입 체크

```bash
# mypy로 타입 검사
mypy app --ignore-missing-imports
```

### 4.2 린트 체크

```bash
# ruff로 린트 검사
ruff check app
ruff format app --check
```

### 4.3 테스트

```bash
# pytest 실행
pytest tests/ -v

# 커버리지 포함
pytest tests/ --cov=app --cov-report=html
```

### 4.4 코드 컨벤션 체크리스트

- [ ] 모든 함수에 Type Hints가 있는가?
- [ ] Docstring이 작성되어 있는가? (Google Style)
- [ ] response_model이 지정되어 있는가?
- [ ] 비즈니스 로직이 Service 레이어에 있는가?
- [ ] 의존성 주입(Depends)을 사용하는가?
- [ ] 적절한 HTTP 상태 코드를 반환하는가?
- [ ] 에러 처리가 되어 있는가?

---

## 빠른 참조

### Import 경로

```python
from app.api.deps import get_db, get_current_user
from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse
from app.services.user_service import UserService
```

### 레이어 순서

```
Router → Service → Repository → Model
```

### 주요 의존성

```python
# DB 세션
db: AsyncSession = Depends(get_db)

# 현재 사용자
current_user: User = Depends(get_current_user)

# 관리자 전용
admin_user: User = Depends(get_admin_user)
```
