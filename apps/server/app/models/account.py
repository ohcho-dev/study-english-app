"""Account and PagePermission models for access control."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class Account(Base):
    """사용자 계정 (admin / tester)."""

    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=True)
    role = Column(String(20), nullable=False, default="tester")  # 'admin' | 'tester'
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class PagePermission(Base):
    """페이지 접근 권한 설정."""

    __tablename__ = "page_permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    route_path = Column(String(255), nullable=False, unique=True)
    route_name = Column(String(100), nullable=False)
    route_group = Column(String(100), nullable=True)
    is_public_to_tester = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
