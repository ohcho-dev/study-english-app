"""Experiment models - SQLAlchemy ORM."""

import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class ExperimentStatus(str, enum.Enum):
    """Experiment status enumeration."""
    
    DRAFT = "draft"
    RUNNING = "running"
    COMPLETED = "completed"
    PAUSED = "paused"


class LearningTheme(str, enum.Enum):
    """Learning theme enumeration."""
    
    LISTENING = "listening"
    SIMULATION = "simulation"
    MYTURN = "myturn"
    ALL = "all"


class CohortVariant(str, enum.Enum):
    """A/B test variant enumeration."""
    
    CONTROL = "control"
    TREATMENT = "treatment"


class Experiment(Base):
    """Experiment database model."""
    
    __tablename__ = "experiments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(200), nullable=False)
    hypothesis = Column(Text)
    status = Column(
        Enum(ExperimentStatus),
        default=ExperimentStatus.DRAFT,
        nullable=False,
    )
    learning_theme = Column(Enum(LearningTheme), nullable=False)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    target_sample_size = Column(Integer)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    variables = relationship("ExperimentVariable", back_populates="experiment")
    cohorts = relationship("UserCohort", back_populates="experiment")


class ExperimentVariable(Base):
    """Experiment variable (Feature Flag) database model."""
    
    __tablename__ = "experiment_variables"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    experiment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("experiments.id"),
        nullable=False,
    )
    variable_key = Column(String(100), nullable=False)
    control_value = Column(JSONB, nullable=False)
    treatment_value = Column(JSONB, nullable=False)
    traffic_split = Column(Float, default=0.5)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    experiment = relationship("Experiment", back_populates="variables")


class UserCohort(Base):
    """User cohort assignment for A/B testing."""
    
    __tablename__ = "user_cohorts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    experiment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("experiments.id"),
        nullable=False,
    )
    variant = Column(Enum(CohortVariant), nullable=False)
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="cohorts")
    experiment = relationship("Experiment", back_populates="cohorts")
