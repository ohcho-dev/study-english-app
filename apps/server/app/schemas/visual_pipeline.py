"""Visual pipeline schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class VisualPipelineCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    graph_json: dict[str, Any]
    timeout_ms: int = Field(default=15000, ge=1000, le=60000)


class VisualPipelineUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    graph_json: dict[str, Any] | None = None
    timeout_ms: int | None = Field(None, ge=1000, le=60000)


class VisualPipelineResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    graph_json: dict[str, Any]
    version: int
    status: str
    timeout_ms: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VisualPipelineListItem(BaseModel):
    id: UUID
    name: str
    description: str | None
    version: int
    status: str
    node_count: int
    edge_count: int
    created_at: datetime
    updated_at: datetime


class VisualPipelineVersionResponse(BaseModel):
    id: UUID
    pipeline_id: UUID
    version: int
    graph_json: dict[str, Any]
    change_reason: str | None
    timeout_ms: int
    created_at: datetime

    class Config:
        from_attributes = True


class PublishRequest(BaseModel):
    change_reason: str | None = None


class ValidateRequest(BaseModel):
    graph_json: dict[str, Any]


class ValidateResponse(BaseModel):
    valid: bool
    errors: list[str] = Field(default_factory=list)


class TestRunRequest(BaseModel):
    transcript: str = Field(..., min_length=1)
    session_context: dict[str, Any] | None = None


class NodeExecutionLogResponse(BaseModel):
    trace_id: str
    node_id: str
    node_type: str
    node_label: str | None = None
    status: str
    input_json: dict[str, Any] | None = None
    output_json: dict[str, Any] | None = None
    duration_ms: float | None = None
    model_name: str | None = None
    prompt_used: str | None = None
    error_message: str | None = None
    created_at: datetime | None = None


class TestRunResponse(BaseModel):
    trace_id: str
    result: dict[str, Any]
    node_logs: list[NodeExecutionLogResponse]
    total_duration_ms: float
    total_input_tokens: int
    total_output_tokens: int
    estimated_cost_usd: float


class TemplatePipelineLinkRequest(BaseModel):
    pipeline_id: UUID
    pipeline_version: int | None = None
    overrides: dict[str, Any] | None = None


class TemplatePipelineLinkResponse(BaseModel):
    id: UUID
    template_id: UUID
    pipeline_id: UUID
    pipeline_version: int | None
    pipeline_name: str
    pipeline_status: str
    created_at: datetime
    updated_at: datetime


class PipelineExecutionTraceSummary(BaseModel):
    trace_id: str
    session_id: UUID | None
    pipeline_id: UUID
    pipeline_version: int
    turn_index: int
    node_count: int
    failure_count: int
    created_at: datetime


class PipelineExecutionTraceDetail(BaseModel):
    trace_id: str
    logs: list[NodeExecutionLogResponse]


class PipelineExecutionLogQuery(BaseModel):
    session_id: UUID | None = None
    trace_id: str | None = None
    pipeline_id: UUID | None = None
    page: int = Field(default=1, ge=1)
    size: int = Field(default=30, ge=1, le=100)
