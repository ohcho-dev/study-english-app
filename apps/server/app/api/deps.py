"""Common API dependencies."""

from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, Header
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
