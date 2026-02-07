"""AI Lab Experiment Log models - SQLAlchemy ORM."""

import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class DataTransferMode(str, enum.Enum):
    """Data transfer mode between agents.
    
    Attributes:
        A: Pass only the final output from the previous agent.
        B: Pass the entire conversation history.
        C: Extract and pass specific JSON fields.
    """
    
    A = "A"  # Final output only
    B = "B"  # Full history
    C = "C"  # Custom fields


class AILabExperimentLog(Base):
    """AI Lab experiment execution log model.
    
    Records the details of each experiment run including inputs, outputs,
    token usage, and cost estimation.
    
    Attributes:
        id: Unique identifier.
        pipeline_id: Foreign key to the pipeline used.
        model_name: AI model used (e.g., gemini-pro, gpt-4o).
        data_transfer_mode: How data is passed between agents (A/B/C).
        user_input: User's input text.
        attached_files: JSON array of attached file info.
        final_result: Final output from the last agent.
        total_input_tokens: Total input tokens used.
        total_output_tokens: Total output tokens used.
        estimated_cost_usd: Estimated cost in USD.
        execution_time_ms: Total execution time in milliseconds.
        created_at: Execution timestamp.
    """
    
    __tablename__ = "ai_lab_experiment_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    pipeline_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ai_lab_pipelines.id", ondelete="SET NULL"),
        nullable=True,  # Keep logs even if pipeline is deleted
    )
    model_name = Column(String(50), nullable=False, index=True)
    data_transfer_mode = Column(Enum(DataTransferMode), nullable=False)
    include_original_input = Column(Boolean, nullable=False, default=True)  # Mode A only
    user_input = Column(Text, nullable=False)
    attached_files = Column(JSONB, nullable=True)  # [{type, url, name}]
    final_result = Column(Text, nullable=False)
    # TTS options
    generate_audio = Column(Boolean, nullable=False, default=False)
    audio_url = Column(String(255), nullable=True)  # Static file URL for audio
    audio_base64 = Column(Text, nullable=True)  # TTS result (legacy, kept for compatibility)
    # Token usage
    total_input_tokens = Column(Integer, nullable=False, default=0)
    total_output_tokens = Column(Integer, nullable=False, default=0)
    estimated_cost_usd = Column(Numeric(10, 6), nullable=False, default=0)
    execution_time_ms = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    pipeline = relationship("Pipeline", back_populates="experiment_logs")
    steps = relationship(
        "AILabExperimentLogStep",
        back_populates="experiment_log",
        cascade="all, delete-orphan",
        order_by="AILabExperimentLogStep.step_index",
    )


class AILabExperimentLogStep(Base):
    """AI Lab experiment step log model.
    
    Records the details of each agent step within an experiment run.
    
    Attributes:
        id: Unique identifier.
        experiment_log_id: Foreign key to parent experiment log.
        step_index: Step order (0-based).
        agent_role: Agent role name at execution time.
        agent_prompt: Agent prompt at execution time.
        input_data: Input passed to this agent.
        output_data: Output from this agent.
        input_tokens: Input tokens for this step.
        output_tokens: Output tokens for this step.
        execution_time_ms: Execution time for this step.
        created_at: Creation timestamp.
    """
    
    __tablename__ = "ai_lab_experiment_log_steps"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    experiment_log_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ai_lab_experiment_logs.id", ondelete="CASCADE"),
        nullable=False,
    )
    step_index = Column(Integer, nullable=False)
    agent_role = Column(String(100), nullable=False)
    agent_prompt = Column(Text, nullable=False)
    model_name = Column(String(50), nullable=True)  # Model used for this step
    input_data = Column(Text, nullable=False)
    output_data = Column(Text, nullable=False)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    execution_time_ms = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    experiment_log = relationship("AILabExperimentLog", back_populates="steps")
