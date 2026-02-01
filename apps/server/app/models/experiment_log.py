"""Experiment Log model - SQLAlchemy ORM."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base
from app.models.experiment import CohortVariant, LearningTheme


class ExperimentLog(Base):
    """Experiment log database model for tracking user behaviors."""
    
    __tablename__ = "experiment_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    experiment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("experiments.id"),
        nullable=True,  # 실험 외 이벤트도 기록 가능
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    variant = Column(Enum(CohortVariant), nullable=True)
    event_type = Column(String(50), nullable=False, index=True)
    event_data = Column(JSONB)
    learning_theme = Column(Enum(LearningTheme), nullable=True)
    scenario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("scenarios.id"),
        nullable=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    experiment = relationship("Experiment")
    user = relationship("User")
    scenario = relationship("Scenario")
