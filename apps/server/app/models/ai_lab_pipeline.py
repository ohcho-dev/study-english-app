"""AI Lab Pipeline models - SQLAlchemy ORM."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class Pipeline(Base):
    """AI Lab pipeline configuration model.
    
    Stores the pipeline configuration including system prompt and agents.
    
    Attributes:
        id: Unique identifier.
        name: Pipeline name for identification.
        description: Optional description of the pipeline.
        system_prompt: Shared system prompt for all agents.
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
    """
    
    __tablename__ = "ai_lab_pipelines"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    system_prompt = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    
    # Relationships
    agents = relationship(
        "PipelineAgent",
        back_populates="pipeline",
        cascade="all, delete-orphan",
        order_by="PipelineAgent.order_index",
    )
    experiment_logs = relationship(
        "AILabExperimentLog",
        back_populates="pipeline",
    )


class PipelineAgent(Base):
    """AI Lab pipeline agent model.
    
    Represents an individual agent step within a pipeline.
    
    Attributes:
        id: Unique identifier.
        pipeline_id: Foreign key to parent pipeline.
        order_index: Execution order (0-based).
        role_name: Human-readable role name for the agent.
        prompt: Individual prompt for this agent.
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
    """
    
    __tablename__ = "ai_lab_pipeline_agents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    pipeline_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ai_lab_pipelines.id", ondelete="CASCADE"),
        nullable=False,
    )
    order_index = Column(Integer, nullable=False)
    role_name = Column(String(100), nullable=False)
    prompt = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    
    # Relationships
    pipeline = relationship("Pipeline", back_populates="agents")
