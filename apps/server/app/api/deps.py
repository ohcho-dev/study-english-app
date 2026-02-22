"""Common API dependencies."""

from collections.abc import AsyncGenerator
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db as _get_db
from app.core.exceptions import UnauthorizedError
from app.core.security import verify_token


# Database dependency
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session dependency."""
    async for session in _get_db():
        yield session


# Type alias for database dependency
DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    """Get current user ID from JWT token.
    
    Args:
        authorization: Authorization header with Bearer token.
        
    Returns:
        User ID from the token.
        
    Raises:
        UnauthorizedError: If token is missing or invalid.
    """
    if not authorization:
        raise UnauthorizedError("Authorization header missing")
    
    if not authorization.startswith("Bearer "):
        raise UnauthorizedError("Invalid authorization header format")
    
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    
    if not payload:
        raise UnauthorizedError("Invalid or expired token")
    
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Invalid token payload")
    
    return user_id


# Type alias for current user dependency
CurrentUserId = Annotated[str, Depends(get_current_user_id)]


# -----------------------------------------------------------
# Account-based auth dependencies
# -----------------------------------------------------------

async def get_current_account(
    db: AsyncSession = Depends(get_db),
    authorization: Annotated[str | None, Header()] = None,
):
    """JWT에서 Account 객체 반환."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = authorization.split(" ")[1]
    payload = verify_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    account_id = payload.get("sub")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    from app.services.auth_service import AuthService
    service = AuthService(db)
    account = await service.get_account_by_id(UUID(account_id))

    if not account or not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found or inactive",
        )

    return account


CurrentAccount = Annotated[object, Depends(get_current_account)]


async def require_admin(account=Depends(get_current_account)):
    """admin 역할 검증."""
    if account.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return account


AdminAccount = Annotated[object, Depends(require_admin)]
