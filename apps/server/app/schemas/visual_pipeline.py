"""Visual pipeline schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


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
    transcript: str | None = None
    input_json: dict[str, Any] | list[dict[str, Any]] | None = None
    session_context: dict[str, Any] | None = None

    @model_validator(mode="after")
    def validate_payload(self) -> "TestRunRequest":
        has_transcript = isinstance(self.transcript, str) and bool(self.transcript.strip())
        if not has_transcript and self.input_json is None:
            raise ValueError("transcript 또는 input_json 중 하나는 필요합니다.")
        return self


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


class TestRunCaseResponse(BaseModel):
    trace_id: str
    input_json: dict[str, Any] | None = None
    result: dict[str, Any]
    node_logs: list[NodeExecutionLogResponse]
    total_duration_ms: float
    total_input_tokens: int
    total_output_tokens: int
    estimated_cost_usd: float


class TestRunBatchSummary(BaseModel):
    item_count: int
    total_duration_ms: float
    total_input_tokens: int
    total_output_tokens: int
    estimated_cost_usd: float


class TestRunResponse(BaseModel):
    trace_id: str | None = None
    result: dict[str, Any] = Field(default_factory=dict)
    node_logs: list[NodeExecutionLogResponse] = Field(default_factory=list)
    total_duration_ms: float = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    estimated_cost_usd: float = 0
    batch_results: list[TestRunCaseResponse] = Field(default_factory=list)
    batch_summary: TestRunBatchSummary | None = None


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
