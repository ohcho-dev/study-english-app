"""AI Lab schemas - Pydantic models for request/response validation."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================================
# Agent Schemas
# ============================================================================


class AgentBase(BaseModel):
    """Base schema for pipeline agent."""
    
    role_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Human-readable role name for the agent",
    )
    prompt: str = Field(..., min_length=1, description="Agent prompt")
    order_index: int = Field(..., ge=0, description="Execution order (0-based)")


class AgentCreate(AgentBase):
    """Schema for creating an agent."""
    
    pass


class AgentUpdate(BaseModel):
    """Schema for updating an agent."""
    
    role_name: str | None = Field(None, min_length=1, max_length=100)
    prompt: str | None = Field(None, min_length=1)
    order_index: int | None = Field(None, ge=0)


class AgentResponse(AgentBase):
    """Schema for agent response."""
    
    id: UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        """Pydantic config."""
        
        from_attributes = True


# ============================================================================
# Pipeline Schemas
# ============================================================================


class PipelineBase(BaseModel):
    """Base schema for pipeline."""
    
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Pipeline name for identification",
    )
    description: str | None = Field(None, description="Optional description")
    system_prompt: str = Field(
        ...,
        min_length=1,
        description="Shared system prompt for all agents",
    )


class PipelineCreate(PipelineBase):
    """Schema for creating a pipeline with agents."""
    
    agents: list[AgentCreate] = Field(
        ...,
        min_length=1,
        description="List of agents in execution order",
    )


class PipelineUpdate(BaseModel):
    """Schema for updating a pipeline."""
    
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    system_prompt: str | None = Field(None, min_length=1)
    agents: list[AgentCreate] | None = Field(
        None,
        description="If provided, replaces all existing agents",
    )


class PipelineListItem(BaseModel):
    """Schema for pipeline list item (summary)."""
    
    id: UUID
    name: str
    description: str | None
    agent_count: int = Field(description="Number of agents")
    created_at: datetime
    updated_at: datetime
    
    class Config:
        """Pydantic config."""
        
        from_attributes = True


class PipelineResponse(PipelineBase):
    """Schema for full pipeline response with agents."""
    
    id: UUID
    agents: list[AgentResponse]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        """Pydantic config."""
        
        from_attributes = True


# ============================================================================
# Experiment Schemas
# ============================================================================


class AttachedFile(BaseModel):
    """Schema for attached file info."""
    
    type: Literal["image", "video", "audio"] = Field(
        description="File type"
    )
    url: str = Field(description="Uploaded file URL")
    name: str = Field(description="Original file name")


class AgentModelOverride(BaseModel):
    """Schema for overriding model per agent."""
    
    agent_id: UUID = Field(description="Agent ID to override model for")
    model_name: str = Field(description="Model to use for this agent")


class ExperimentRunRequest(BaseModel):
    """Schema for experiment run request."""
    
    pipeline_id: UUID = Field(description="Pipeline to run")
    model_name: Literal[
        "gemini-3-pro-preview", "gemini-3-flash-preview",
        "gemini-2.5-pro", "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gpt-4o", "gpt-4-turbo"
    ] = Field(
        description="AI model to use"
    )
    data_transfer_mode: Literal["A", "B", "C"] = Field(
        description="Data transfer mode between agents (A: last output only, B: full history, C: original input only)"
    )
    include_original_input: bool = Field(
        default=True,
        description="Whether to include original user input in agent context",
    )
    user_input: str = Field(..., min_length=1, description="User input text")
    attached_files: list[AttachedFile] | None = Field(
        None,
        description="Attached multimedia files",
    )
    generate_audio: bool = Field(
        default=False,
        description="Whether to generate audio from final result",
    )
    tts_model: Literal[
        "gemini-2.5-flash-preview-tts",
        "gemini-2.5-pro-preview-tts"
    ] | None = Field(
        default="gemini-2.5-flash-preview-tts",
        description="TTS model to use for audio generation",
    )
    tts_voice: str | None = Field(
        default="Kore",
        description="Voice for TTS (Puck, Charon, Kore, Fenrir, Aoede)",
    )
    agent_models: list[AgentModelOverride] | None = Field(
        default=None,
        description="Per-agent model overrides (optional)",
    )


class StepBenchmark(BaseModel):
    """Schema for step benchmark metrics."""
    
    latency_ms: int = Field(description="Response time in milliseconds")
    tokens_per_second: float = Field(description="Throughput - tokens processed per second")
    input_output_ratio: float = Field(description="Output to input token ratio")
    cost_per_1k_tokens: float = Field(description="Cost per 1000 tokens in USD")
    output_length: int = Field(description="Output text length in characters")
    response_density: float = Field(description="Characters per output token")


class StepResult(BaseModel):
    """Schema for individual step result."""
    
    step_index: int
    agent_role: str
    model_name: str = Field(description="Model used for this step")
    output: str
    input_tokens: int
    output_tokens: int
    execution_time_ms: int
    benchmark: StepBenchmark | None = Field(default=None, description="Benchmark metrics for this step")


class ExperimentRunResponse(BaseModel):
    """Schema for experiment run response."""
    
    log_id: UUID = Field(description="ID of the created log")
    steps: list[StepResult] = Field(description="Results from each agent")
    final_result: str = Field(description="Final output from last agent")
    total_input_tokens: int
    total_output_tokens: int
    estimated_cost_usd: float
    execution_time_ms: int
    audio_url: str | None = Field(
        default=None,
        description="URL of generated audio file (if TTS was enabled)",
    )
    audio_base64: str | None = Field(
        default=None,
        description="Base64-encoded audio data (if TTS was enabled)",
    )


# ============================================================================
# Log Schemas
# ============================================================================


class ExperimentLogStepResponse(BaseModel):
    """Schema for experiment log step."""
    
    id: UUID
    step_index: int
    agent_role: str
    agent_prompt: str
    model_name: str | None = Field(default=None, description="Model used for this step")
    input_data: str
    output_data: str
    input_tokens: int
    output_tokens: int
    execution_time_ms: int
    benchmark: StepBenchmark | None = Field(default=None, description="Benchmark metrics")
    created_at: datetime
    
    class Config:
        """Pydantic config."""
        
        from_attributes = True


class ExperimentLogSummary(BaseModel):
    """Schema for experiment log list item (summary)."""
    
    id: UUID
    pipeline_id: UUID | None
    pipeline_name: str | None = Field(description="Pipeline name at execution time")
    model_name: str
    data_transfer_mode: Literal["A", "B", "C"]
    include_original_input: bool = Field(default=True)
    used_models: list[str] | None = Field(default=None, description="List of unique models used")
    generate_audio: bool = Field(default=False)
    total_tokens: int = Field(description="Total tokens used")
    total_input_tokens: int = Field(description="Total input tokens")
    total_output_tokens: int = Field(description="Total output tokens")
    estimated_cost_usd: float
    execution_time_ms: int
    created_at: datetime
    
    class Config:
        """Pydantic config."""
        
        from_attributes = True


class ExperimentLogDetail(BaseModel):
    """Schema for full experiment log detail."""
    
    id: UUID
    pipeline_id: UUID | None
    pipeline_name: str | None
    model_name: str
    data_transfer_mode: Literal["A", "B", "C"]
    include_original_input: bool = Field(default=True)
    used_models: list[str] | None = Field(default=None, description="List of unique models used")
    user_input: str
    attached_files: list[AttachedFile] | None
    final_result: str
    generate_audio: bool = Field(default=False)
    audio_url: str | None = Field(default=None, description="Static file URL for audio")
    audio_base64: str | None = Field(default=None, description="TTS audio in base64")
    total_input_tokens: int
    total_output_tokens: int
    estimated_cost_usd: float
    execution_time_ms: int
    steps: list[ExperimentLogStepResponse]
    created_at: datetime
    
    class Config:
        """Pydantic config."""
        
        from_attributes = True


# ============================================================================
# Model Info Schema
# ============================================================================


class ModelInfo(BaseModel):
    """Schema for available AI model info with detailed capabilities."""
    
    id: str = Field(description="Model identifier (e.g., gemini-pro)")
    name: str = Field(description="Human-readable name")
    provider: str = Field(description="Provider (google, openai)")
    input_price_per_1m: float = Field(description="Price per 1M input tokens (USD)")
    output_price_per_1m: float = Field(description="Price per 1M output tokens (USD)")
    
    # Capability flags
    supports_multimodal: bool = Field(default=False, description="Supports image/video input")
    supports_audio_input: bool = Field(default=False, description="Can analyze audio files")
    supports_audio_output: bool = Field(default=False, description="Can generate speech (TTS)")
    supports_native_audio: bool = Field(default=False, description="Bidirectional audio (listen + speak)")
    supports_function_calling: bool = Field(default=True, description="Supports function/tool calling")
    
    # Model metadata
    category: str = Field(default="general", description="Model category (general, tts, audio, vision)")
    description: str | None = Field(default=None, description="Detailed model description")
    use_cases: list[str] = Field(default_factory=list, description="Recommended use cases")
    max_context_tokens: int | None = Field(default=None, description="Maximum context window")
    
    # Lifecycle dates
    release_date: str | None = Field(default=None, description="Model release date in YYYY-MM-DD")
    deprecation_date: str | None = Field(default=None, description="Model deprecation date in YYYY-MM-DD")


# ============================================================================
# Upload Schema
# ============================================================================


class UploadResponse(BaseModel):
    """Schema for file upload response."""
    
    url: str = Field(description="Uploaded file URL")
    type: Literal["image", "video", "audio"]
    name: str = Field(description="Original file name")
    size_bytes: int = Field(description="File size in bytes")


# ============================================================================
# Usage Schemas
# ============================================================================
