# 🐍 Python/FastAPI 코드 컨벤션

> **적용 범위:** `apps/server` (FastAPI 백엔드 서버)
> **작성일:** 2026-02-01

---

## 1. 프로젝트 구조

```
apps/server/
├── app/
│   ├── api/                    # API 라우트
│   │   ├── v1/                 # 버전별 API
│   │   │   ├── __init__.py
│   │   │   ├── router.py       # 메인 라우터
│   │   │   ├── experiments.py  # 🧪 실험 관리
│   │   │   ├── variables.py    # 🧪 변수 관리
│   │   │   ├── cohorts.py      # 🧪 코호트 관리
│   │   │   ├── prompts.py      # 🧪 AI 프롬프트
│   │   │   ├── scenarios.py    # 📦 시나리오
│   │   │   ├── analytics.py    # 🧪 분석 대시보드
│   │   │   ├── users.py        # ⚙️ 사용자
│   │   │   └── themes.py       # ⚙️ 테마
│   │   ├── auth/               # 인증 API
│   │   │   └── oauth.py
│   │   └── ai/                 # AI 스트리밍 API
│   │       └── chat.py
│   ├── core/                   # 핵심 설정
│   │   ├── config.py           # 환경 변수
│   │   ├── database.py         # DB 연결
│   │   ├── security.py         # JWT, OAuth
│   │   └── exceptions.py       # 커스텀 예외
│   ├── models/                 # SQLAlchemy 모델
│   │   ├── base.py             # Base 클래스
│   │   ├── user.py
│   │   ├── experiment.py       # 🧪 실험, 변수
│   │   ├── cohort.py           # 🧪 코호트
│   │   ├── experiment_log.py   # 🧪 로그
│   │   ├── ai_prompt.py        # 🧪 프롬프트
│   │   ├── scenario.py         # 📦 시나리오
│   │   └── theme.py            # ⚙️ 테마
│   ├── schemas/                # Pydantic 스키마
│   │   ├── common.py           # 공통 (페이지네이션 등)
│   │   ├── user.py
│   │   ├── experiment.py
│   │   ├── prompt.py
│   │   ├── scenario.py
│   │   └── theme.py
│   ├── services/               # 비즈니스 로직
│   │   ├── experiment_service.py
│   │   ├── variable_service.py
│   │   ├── prompt_service.py
│   │   ├── scenario_service.py
│   │   ├── analytics_service.py
│   │   └── ai/
│   │       ├── agent.py        # LangChain 에이전트
│   │       └── chains.py       # LangChain 체인
│   └── main.py                 # FastAPI 앱 진입점
├── migrations/                 # Alembic 마이그레이션
├── tests/                      # 테스트
├── Dockerfile
├── docker-compose.yml
├── pyproject.toml              # Poetry 의존성
└── README.md
```

---

## 2. 네이밍 규칙

### 파일명

| 타입 | 규칙 | 예시 |
|------|------|------|
| 모듈 | snake_case | `user_service.py` |
| 라우트 | snake_case (복수형) | `users.py`, `themes.py` |
| 모델 | snake_case (단수형) | `user.py`, `theme.py` |

### 변수/함수명

| 타입 | 규칙 | 예시 |
|------|------|------|
| 변수 | snake_case | `user_name`, `is_active` |
| 함수 | snake_case | `get_user`, `create_theme` |
| 클래스 | PascalCase | `User`, `ThemeService` |
| 상수 | UPPER_SNAKE_CASE | `DATABASE_URL`, `SECRET_KEY` |

---

## 3. 함수 정의 규칙

### ✅ Type Hints 필수

```python
# ✅ 올바른 방식
async def get_user(user_id: UUID) -> User:
    ...

# ❌ 잘못된 방식
async def get_user(user_id):
    ...
```

### ✅ Docstring 작성 (Google Style)

```python
async def create_user(data: UserCreate) -> User:
    """사용자를 생성합니다.
    
    Args:
        data: 사용자 생성 데이터
        
    Returns:
        생성된 사용자 객체
        
    Raises:
        HTTPException: 이메일 중복 시 400 에러
    """
    ...
```

---

## 4. API 라우트 규칙

### Router 정의

```python
# app/api/v1/users.py
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.user import UserResponse, UserCreate
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    service: UserService = Depends()
) -> UserResponse:
    """사용자 조회"""
    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

### 응답 모델 규칙

```python
# ✅ response_model 항상 지정
@router.get("/", response_model=list[UserResponse])

# ❌ response_model 생략 금지
@router.get("/")
```

---

## 5. Pydantic 스키마 규칙

### 스키마 분리

```python
# app/schemas/user.py
from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime

# 기본 필드 (공통)
class UserBase(BaseModel):
    email: EmailStr
    name: str

# 생성용
class UserCreate(UserBase):
    pass

# 수정용
class UserUpdate(BaseModel):
    name: str | None = None

# 응답용
class UserResponse(UserBase):
    id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True  # ORM 모드
```

---

## 6. SQLAlchemy 모델 규칙

```python
# app/models/user.py
from sqlalchemy import Column, String, Integer, Enum, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    role = Column(Enum("user", "admin", name="user_role"), default="user")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    progress = relationship("UserProgress", back_populates="user")
```

---

## 7. 서비스 레이어 규칙

```python
# app/services/user_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate

class UserService:
    def __init__(self, db: AsyncSession = Depends(get_db)):
        self.db = db
    
    async def get_by_id(self, user_id: UUID) -> User | None:
        return await self.db.get(User, user_id)
    
    async def create(self, data: UserCreate) -> User:
        user = User(**data.model_dump())
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
```

---

## 8. 의존성 주입 (Depends)

```python
# ✅ 의존성 주입 사용
@router.get("/me")
async def get_current_user(
    user: User = Depends(get_current_user)
):
    return user

# ❌ 전역 변수 사용 금지
current_user = None  # 금지!
```

---

## 9. 에러 처리

```python
from fastapi import HTTPException, status

# ✅ HTTPException 사용
raise HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="User not found"
)

# ✅ 커스텀 예외 정의 (선택)
class UserNotFoundError(Exception):
    pass

# 전역 예외 핸들러
@app.exception_handler(UserNotFoundError)
async def user_not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"detail": "User not found"}
    )
```

---

## 10. 체크리스트

코드 리뷰 시 확인 사항:

- [ ] Type Hints가 모든 함수에 있는가?
- [ ] Pydantic 스키마로 요청/응답을 검증하는가?
- [ ] 비즈니스 로직이 Service 레이어에 있는가?
- [ ] 의존성 주입(Depends)을 사용하는가?
- [ ] SQLAlchemy 모델이 적절히 정의되었는가?
- [ ] 적절한 HTTP 상태 코드를 반환하는가?
