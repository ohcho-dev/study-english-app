"""Scenario models - SQLAlchemy ORM."""

import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base
from app.models.experiment import LearningTheme


class ScenarioStatus(str, enum.Enum):
    """Scenario status enumeration."""
    
    DRAFT = "draft"
    TESTING = "testing"
    PUBLISHED = "published"


class ScenarioStepType(str, enum.Enum):
    """Scenario step type enumeration."""
    
    DIALOGUE = "dialogue"
    CHOICE = "choice"
    SPEAKING = "speaking"
    OBSERVE = "observe"       # 듣기 전용
    IMITATE = "imitate"       # 따라하기
    INTERNALIZE = "internalize"  # 내면화


class Scenario(Base):
    """Scenario database model (Learning content)."""
    
    __tablename__ = "scenarios"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(Enum(LearningTheme), nullable=False)
    status = Column(
        Enum(ScenarioStatus),
        default=ScenarioStatus.DRAFT,
        nullable=False,
    )
    level_required = Column(Integer, default=1)
    xp_reward = Column(Integer, default=10)
    order = Column(Integer, nullable=False, default=0)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    
    # Relationships
    steps = relationship("ScenarioStep", back_populates="scenario", order_by="ScenarioStep.step_order")


class ScenarioStep(Base):
    """Scenario step database model."""
    
    __tablename__ = "scenario_steps"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    scenario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("scenarios.id"),
        nullable=False,
    )
    step_order = Column(Integer, nullable=False)
    type = Column(Enum(ScenarioStepType), nullable=False)
    content = Column(JSONB, nullable=False)  # Step content (dialogue, choices, etc.)
    ai_config = Column(JSONB)  # AI configuration for this step
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    scenario = relationship("Scenario", back_populates="steps")
