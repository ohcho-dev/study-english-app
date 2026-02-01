"""SQLAlchemy Base class and common mixins."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    
    pass


class TimestampMixin:
    """Mixin for adding created_at and updated_at columns."""
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class UUIDMixin:
    """Mixin for adding UUID primary key."""
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
