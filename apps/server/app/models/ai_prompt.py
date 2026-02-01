"""AI Prompt models - SQLAlchemy ORM."""

import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base
from app.models.experiment import LearningTheme


class AIPrompt(Base):
    """AI Prompt database model."""
    
    __tablename__ = "ai_prompts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(100), nullable=False)
    target_theme = Column(Enum(LearningTheme), nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    
    # Relationships
    versions = relationship("AIPromptVersion", back_populates="prompt", order_by="desc(AIPromptVersion.version)")


class AIPromptVersion(Base):
    """AI Prompt version database model."""
    
    __tablename__ = "ai_prompt_versions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    prompt_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ai_prompts.id"),
        nullable=False,
    )
    version = Column(Integer, nullable=False)
    system_prompt = Column(Text, nullable=False)
    temperature = Column(Float, default=0.7)
    model = Column(String(50), nullable=False, default="gemini-1.5-flash")
    max_tokens = Column(Integer, default=1000)
    eval_weights = Column(JSONB)  # 평가 기준 가중치
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    prompt = relationship("AIPrompt", back_populates="versions")
