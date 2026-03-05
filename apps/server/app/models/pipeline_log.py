"""Pipeline Log model for Narrative Sync v0.2.

Stores per-module execution logs with trace_id-based correlation.
Each row represents one module's execution (Evaluator, Planner, or Conductor)
for a specific turn in a session.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class PipelineLog(Base):
    """Pipeline execution log for each module in the Expert Pipeline.

    Attributes:
        id: Unique identifier.
        trace_id: UUID tracing the full pipeline execution (STT→Eval→Plan→Conduct→TTS).
        session_id: Foreign key to conversation session.
        turn_index: Turn number within the session.
        module_name: Module that produced this log (evaluator, planner, conductor).
        schema_version: Data contract version used.
        input_json: Input data sent to the module (JSONB).
        output_json: Output data produced by the module (JSONB).
        duration_ms: Execution time in milliseconds.
        model_name: LLM model used (if any).
        error_message: Error message if the module failed.
        created_at: Creation timestamp.
    """

    __tablename__ = "pipeline_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    trace_id = Column(String(36), nullable=False, index=True)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("conversation_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    turn_index = Column(Integer, nullable=False)
    module_name = Column(String(20), nullable=False)  # evaluator, planner, conductor
    schema_version = Column(String(20), nullable=False, default="0.2.0")
    input_json = Column(JSONB, nullable=True)
    output_json = Column(JSONB, nullable=True)
    duration_ms = Column(Float, nullable=True)
    model_name = Column(String(100), nullable=True)
    prompt_used = Column(Text, nullable=True)  # Actual prompt text used at execution time
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    session = relationship("ConversationSession", backref="pipeline_logs")
