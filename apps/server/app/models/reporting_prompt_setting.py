"""Reporting LLM Prompt Setting model.

Global (template-agnostic) prompt management for the Reporting LLM.
Only one row with is_active=True should exist at any time.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class ReportingPromptSetting(Base):
    """Reporting LLM prompt configuration.

    Attributes:
        id: Unique identifier.
        name: Human-readable label (e.g., "v1 기본 프롬프트", "v2 상세 분석").
        system_prompt: The full system instruction text sent to the LLM.
        llm_model: LLM model name override (default: gemini-2.5-pro).
        temperature: LLM temperature (default: 0.3).
        is_active: Whether this prompt is the currently active one.
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
    """

    __tablename__ = "reporting_prompt_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(100), nullable=False, default="기본 프롬프트")
    system_prompt = Column(Text, nullable=False)
    llm_model = Column(String(100), nullable=False, default="gemini-2.5-pro")
    temperature = Column(String(10), nullable=False, default="0.3")
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
