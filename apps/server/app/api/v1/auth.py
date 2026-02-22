"""Authentication API endpoints."""

import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.api.deps import CurrentAccount, DbSession
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])


# -----------------------------------------------------------
# Schemas
# -----------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    username: str
    display_name: str | None
    role: str


class MeResponse(BaseModel):
    id: str
    username: str
    display_name: str | None
    role: str
    allowed_routes: list[str]


# -----------------------------------------------------------
# Endpoints
# -----------------------------------------------------------

@router.post("/login", response_model=LoginResponse)
async def login(db: DbSession, data: LoginRequest):
    """로그인 — JWT 토큰 반환."""
    service = AuthService(db)
    account = await service.authenticate(data.username, data.password)

    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = service.create_token(account)

    logger.info(f"[Auth] Login: {account.username} (role={account.role})")
    return LoginResponse(
        token=token,
        username=account.username,
        display_name=account.display_name,
        role=account.role,
    )


@router.get("/me", response_model=MeResponse)
async def get_me(db: DbSession, account: CurrentAccount):
    """현재 사용자 정보 + 허용 페이지 목록."""
    service = AuthService(db)
    allowed_routes = await service.get_allowed_routes(account.role)

    return MeResponse(
        id=str(account.id),
        username=account.username,
        display_name=account.display_name,
        role=account.role,
        allowed_routes=allowed_routes,
    )
