"""Visual pipeline models."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class VisualPipeline(Base):
    """Visual pipeline definition."""

    __tablename__ = "visual_pipelines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    graph_json = Column(JSONB, nullable=False, default=dict)
    version = Column(Integer, nullable=False, default=1)
    status = Column(String(20), nullable=False, default="draft", server_default="draft")
    timeout_ms = Column(Integer, nullable=False, default=15000, server_default="15000")
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    versions = relationship(
        "VisualPipelineVersion",
        back_populates="pipeline",
        cascade="all, delete-orphan",
        order_by="VisualPipelineVersion.version.desc()",
    )
    template_links = relationship(
        "TemplateVisualPipelineLink",
        back_populates="pipeline",
    )


class VisualPipelineVersion(Base):
    """Immutable visual pipeline snapshot."""

    __tablename__ = "visual_pipeline_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    pipeline_id = Column(
        UUID(as_uuid=True),
        ForeignKey("visual_pipelines.id", ondelete="CASCADE"),
        nullable=False,
    )
    version = Column(Integer, nullable=False)
    graph_json = Column(JSONB, nullable=False)
    change_reason = Column(Text, nullable=True)
    timeout_ms = Column(Integer, nullable=False, default=15000, server_default="15000")
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    pipeline = relationship("VisualPipeline", back_populates="versions")


class TemplateVisualPipelineLink(Base):
    """Template to visual pipeline link."""

    __tablename__ = "template_visual_pipeline_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("conversation_templates.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    pipeline_id = Column(
        UUID(as_uuid=True),
        ForeignKey("visual_pipelines.id", ondelete="RESTRICT"),
        nullable=False,
    )
    pipeline_version = Column(Integer, nullable=True)
    overrides = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    pipeline = relationship("VisualPipeline", back_populates="template_links")
    template = relationship("ConversationTemplate")


class PipelineExecutionLog(Base):
    """Per-node execution log for a visual pipeline run."""

    __tablename__ = "pipeline_execution_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    trace_id = Column(String(36), nullable=False, index=True)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("conversation_sessions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    pipeline_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    pipeline_version = Column(Integer, nullable=False)
    turn_index = Column(Integer, nullable=False, default=0)
    node_id = Column(String(100), nullable=False)
    node_type = Column(String(50), nullable=False)
    node_label = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False)
    input_json = Column(JSONB, nullable=True)
    output_json = Column(JSONB, nullable=True)
    duration_ms = Column(Float, nullable=True)
    model_name = Column(String(100), nullable=True)
    prompt_used = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("ConversationSession")
