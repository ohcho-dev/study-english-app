"""Conversation Scenario Validation schemas - Pydantic models.

This module defines schemas for conversation templates, participants,
sessions, turns, metrics, and RUN0 voice processing.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================================
# Enums for API
# ============================================================================

ConversationModeType = Literal["turn_based", "free_form"]
ParticipantTypeType = Literal["moderator", "ai", "user"]
SessionStatusType = Literal["active", "waiting_user", "paused", "completed", "error"]
TurnTypeType = Literal["system", "moderator", "ai", "user"]
FirstSpeakerType = Literal["moderator_first", "ai_first", "user_first"]


# ============================================================================
# Voice Settings Schema
# ============================================================================


class VoiceSettings(BaseModel):
    """Voice configuration for TTS."""
    
    speaking_rate: float = Field(
        default=1.0,
        ge=0.25,
        le=4.0,
        description="Speaking rate (0.25 to 4.0)",
    )
    pitch: float = Field(
        default=0.0,
        ge=-20.0,
        le=20.0,
        description="Pitch adjustment (-20 to 20 semitones)",
    )
    volume_gain_db: float = Field(
        default=0.0,
        ge=-96.0,
        le=16.0,
        description="Volume gain in dB",
    )


# ============================================================================
# Participant Schemas
# ============================================================================


class ParticipantBase(BaseModel):
    """Base schema for conversation participant."""
    
    participant_type: ParticipantTypeType = Field(
        description="Type of participant (moderator, ai, user)"
    )
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Participant name (e.g., Sarah, Mike)",
    )
    persona: str | None = Field(
        None,
        description="Character description and behavior",
    )
    voice_id: str | None = Field(
        None,
        description="TTS voice ID (e.g., en-US-Wavenet-F)",
    )
    voice_settings: VoiceSettings | None = Field(
        None,
        description="Voice configuration",
    )
    order_index: int = Field(
        default=0,
        ge=0,
        description="Display/turn order",
    )
    # My Turn additions
    difficulty: int | None = Field(None, ge=1, le=5, description="Difficulty level (1-5)")
    greeting_message: str | None = Field(
        None,
        description="First greeting message for this participant",
    )
    avatar_url: str | None = Field(
        None,
        description="Avatar image URL",
    )
    # Model selection (admin-saved defaults)
    llm_model: str | None = Field(None, max_length=100, description="LLM model ID")
    stt_model: str | None = Field(None, max_length=100, description="STT model ID")
    tts_model: str | None = Field(None, max_length=100, description="TTS model ID")
    tts_provider: str | None = Field(None, max_length=50, description="TTS provider")


class ParticipantCreate(ParticipantBase):
    """Schema for creating a participant."""
    
    pass


class ParticipantUpdate(BaseModel):
    """Schema for updating a participant."""
    
    participant_type: ParticipantTypeType | None = None
    name: str | None = Field(None, min_length=1, max_length=100)
    persona: str | None = None
    voice_id: str | None = None
    voice_settings: VoiceSettings | None = None
    order_index: int | None = Field(None, ge=0)
    greeting_message: str | None = None
    avatar_url: str | None = None
    llm_model: str | None = None
    stt_model: str | None = None
    tts_model: str | None = None
    tts_provider: str | None = None


class ParticipantResponse(ParticipantBase):
    """Schema for participant response."""
    
    id: UUID
    template_id: UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        """Pydantic config."""
        
        from_attributes = True


# ============================================================================
# Template Schemas
# ============================================================================


class TemplateBase(BaseModel):
    """Base schema for conversation template."""
    
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Template name for identification",
    )
    description: str | None = Field(None, description="Optional description")
    mode: ConversationModeType = Field(
        default="turn_based",
        description="Conversation mode (turn_based or free_form)",
    )
    system_prompt: str = Field(
        ...,
        min_length=1,
        description="System prompt for the moderator AI",
    )
    greeting_message: str | None = Field(
        None,
        description="Initial greeting from moderator",
    )
    topic: str | None = Field(
        None,
        max_length=255,
        description="Conversation topic",
    )
    difficulty: int | None = Field(
        None,
        ge=1,
        le=5,
        description="Difficulty level (1-5)",
    )
    estimated_minutes: int | None = Field(
        None,
        ge=1,
        description="Estimated session duration",
    )
    is_active: bool = Field(
        default=True,
        description="Whether template is available",
    )
    # My Turn settings
    first_speaker: FirstSpeakerType = Field(
        default="moderator_first",
        description="Who speaks first (moderator_first, ai_first, user_first)",
    )
    scene_context: str | None = Field(
        None,
        description="Shared context/scene description for all AI participants",
    )
    director_system_prompt: str | None = Field(
        None,
        description="Custom instruction for Scenario Director",
    )


class TemplateCreate(TemplateBase):
    """Schema for creating a template with participants."""
    
    participants: list[ParticipantCreate] = Field(
        default_factory=list,
        description="List of participants",
    )


class TemplateUpdate(BaseModel):
    """Schema for updating a template."""
    
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    mode: ConversationModeType | None = None
    system_prompt: str | None = Field(None, min_length=1)
    greeting_message: str | None = None
    topic: str | None = Field(None, max_length=255)
    difficulty: int | None = Field(None, ge=1, le=5)
    estimated_minutes: int | None = Field(None, ge=1)
    is_active: bool | None = None
    first_speaker: FirstSpeakerType | None = None
    scene_context: str | None = None
    director_system_prompt: str | None = None
    participants: list[ParticipantCreate] | None = Field(
        None,
        description="If provided, replaces all existing participants",
    )


class TemplateListItem(BaseModel):
    """Schema for template list item (summary)."""
    
    id: UUID
    name: str
    description: str | None
    mode: ConversationModeType
    topic: str | None
    difficulty: int | None
    participant_count: int = Field(description="Number of participants")
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        """Pydantic config."""
        
        from_attributes = True


class TemplateResponse(TemplateBase):
    """Schema for full template response with participants."""
    
    id: UUID
    participants: list[ParticipantResponse]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        """Pydantic config."""
        
        from_attributes = True


# ============================================================================
# Session Schemas
# ============================================================================


class SessionCreate(BaseModel):
    """Schema for creating a new session."""
    
    template_id: UUID = Field(description="Template to use for this session")
    device_type: str | None = Field(None, description="Client device type (pc, mobile)")
    browser: str | None = Field(None, description="Client browser info")
    variant: str | None = Field(None, description="A/B test variant")
    difficulty: int | None = Field(None, ge=1, le=5, description="Difficulty level (1-5)")
    estimated_minutes: int | None = Field(None, ge=1, description="Estimated session duration")
    # My Turn additions
    user_name: str | None = Field(None, max_length=100, description="User's name for personalized conversation")


class SessionResponse(BaseModel):
    """Schema for session response."""
    
    id: UUID
    template_id: UUID | None
    template_name: str | None = Field(description="Template name")
    status: SessionStatusType
    current_turn_index: int
    current_speaker_id: UUID | None
    started_at: datetime
    ended_at: datetime | None
    device_type: str | None
    browser: str | None
    variant: str | None
    difficulty: int | None
    estimated_minutes: int | None
    error_message: str | None
    # My Turn additions
    user_name: str | None
    current_speaker_type: str | None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        """Pydantic config."""
        
        from_attributes = True


class SessionListItem(BaseModel):
    """Schema for session list item."""
    
    id: UUID
    template_id: UUID | None
    template_name: str | None
    status: SessionStatusType
    turn_count: int = Field(description="Number of turns")
    started_at: datetime
    ended_at: datetime | None
    device_type: str | None
    experiment_type: str | None = None
    variant: dict | None = None
    
    # Latency metrics (averages in ms)
    e2e_avg_ms: float | None = None
    asr_avg_ms: float | None = None
    llm_avg_ms: float | None = None
    tts_avg_ms: float | None = None
    client_load_avg_ms: float | None = None
    
    class Config:
        """Pydantic config."""
        
        from_attributes = True


# ============================================================================
# Turn Schemas
# ============================================================================


class TurnCreate(BaseModel):
    """Schema for creating a turn (internal use)."""
    
    session_id: UUID
    turn_index: int
    turn_type: TurnTypeType
    speaker_name: str | None = None
    content_text: str | None = None
    audio_url: str | None = None
    audio_duration_ms: int | None = None


class TurnResponse(BaseModel):
    """Schema for turn response."""
    
    id: UUID
    session_id: UUID
    turn_index: int
    turn_type: TurnTypeType
    speaker_name: str | None
    content_text: str | None
    audio_url: str | None
    audio_duration_ms: int | None
    
    # Timing
    t0_user_end: float | None
    t1_asr_final: float | None
    t2_llm_final: float | None
    t2_5_tts_ready: float | None
    t3_audio_play_start: float | None
    
    # Computed latencies (ms)
    asr_latency_ms: float | None = None
    llm_latency_ms: float | None = None
    tts_latency_ms: float | None = None
    client_load_ms: float | None = None
    e2e_latency_ms: float | None = None
    
    # Metadata
    model_name: str | None
    stt_provider: str | None
    stt_model: str | None = None
    tts_provider: str | None
    tts_voice: str | None
    
    created_at: datetime
    
    class Config:
        """Pydantic config."""
        
        from_attributes = True
    
    def __init__(self, **data):
        """Compute latency fields from timestamps."""
        super().__init__(**data)
        t0 = self.t0_user_end
        t1 = self.t1_asr_final
        t2 = self.t2_llm_final
        t2_5 = self.t2_5_tts_ready
        t3 = self.t3_audio_play_start
        
        if t0 and t1:
            self.asr_latency_ms = round(t1 - t0, 1)
        if t1 and t2:
            self.llm_latency_ms = round(t2 - t1, 1)
        if t2 and t2_5:
            self.tts_latency_ms = round(t2_5 - t2, 1)
        if t2_5 and t3:
            self.client_load_ms = round(t3 - t2_5, 1)
        if t0 and t3:
            self.e2e_latency_ms = round(t3 - t0, 1)


# ============================================================================
# Metrics Schemas
# ============================================================================


class SessionMetricsResponse(BaseModel):
    """Schema for session metrics response."""
    
    id: UUID
    session_id: UUID
    
    # Latency metrics
    e2e_avg_ms: float | None
    e2e_p50_ms: float | None
    e2e_p95_ms: float | None
    asr_avg_ms: float | None
    llm_avg_ms: float | None
    tts_avg_ms: float | None
    client_load_avg_ms: float | None = None
    
    # Quality metrics
    total_turns: int
    user_turns: int
    asr_retry_count: int
    error_count: int
    
    # Cost metrics
    total_input_tokens: int
    total_output_tokens: int
    estimated_cost_usd: float
    
    created_at: datetime
    
    class Config:
        """Pydantic config."""
        
        from_attributes = True


# ============================================================================
# Measurement Config Schemas
# ============================================================================


class MeasurementConfigBase(BaseModel):
    """Base schema for measurement config."""
    
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Configuration name",
    )
    description: str | None = Field(None, description="Optional description")
    is_default: bool = Field(default=False, description="Is default config")
    
    # Thresholds
    e2e_target_ms: int = Field(default=3000, ge=100, description="Target E2E latency")
    e2e_max_ms: int = Field(default=5000, ge=100, description="Max acceptable E2E latency")
    asr_target_ms: int | None = Field(None, ge=100)
    llm_target_ms: int | None = Field(None, ge=100)
    tts_target_ms: int | None = Field(None, ge=100)
    
    # Test settings
    test_iterations: int = Field(default=10, ge=1, description="Number of test iterations")
    warmup_iterations: int = Field(default=2, ge=0, description="Warmup iterations")
    test_phrases: list[str] | None = Field(None, description="Test phrases for STT testing")


class MeasurementConfigCreate(MeasurementConfigBase):
    """Schema for creating a measurement config."""
    
    pass


class MeasurementConfigUpdate(BaseModel):
    """Schema for updating a measurement config."""
    
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    is_default: bool | None = None
    e2e_target_ms: int | None = Field(None, ge=100)
    e2e_max_ms: int | None = Field(None, ge=100)
    asr_target_ms: int | None = None
    llm_target_ms: int | None = None
    tts_target_ms: int | None = None
    test_iterations: int | None = Field(None, ge=1)
    warmup_iterations: int | None = Field(None, ge=0)
    test_phrases: list[str] | None = None


class MeasurementConfigResponse(MeasurementConfigBase):
    """Schema for measurement config response."""
    
    id: UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        """Pydantic config."""
        
        from_attributes = True


# ============================================================================
# RUN0 Voice Processing Schemas
# ============================================================================


class Run0VoiceRequest(BaseModel):
    """Schema for RUN0 voice processing request.
    
    Client sends recorded audio, server processes through STT → LLM → TTS.
    """
    
    session_id: UUID | None = Field(
        None,
        description="Existing session ID (creates new if not provided)",
    )
    template_id: UUID | None = Field(
        None,
        description="Template to use (required if no session_id)",
    )
    t0_user_end: float = Field(
        description="Client timestamp when user stopped speaking (ms, Unix epoch)",
    )
    

class Run0VoiceResponse(BaseModel):
    """Schema for RUN0 voice processing response."""
    
    session_id: UUID | None = None
    turn_id: UUID | None = None
    transcript: str = Field(description="STT result - user's speech as text")
    reply_text: str = Field(description="LLM response text")
    audio_url: str | None = Field(None, description="TTS audio URL")
    audio_base64: str | None = Field(None, description="TTS audio base64 (fallback)")
    
    # Timestamps
    t1_asr_final: float = Field(description="Server timestamp when STT completed")
    t2_llm_final: float = Field(description="Server timestamp when LLM completed")
    t2_5_tts_ready: float = Field(description="Server timestamp when TTS ready")
    
    # Metrics
    asr_latency_ms: int = Field(description="t1 - t0")
    llm_latency_ms: int = Field(description="t2 - t1")
    tts_latency_ms: int = Field(description="t2_5 - t2")
    server_total_ms: int = Field(description="t2_5 - t0")


class Run0LogRequest(BaseModel):
    """Schema for logging client-side timestamp.
    
    Client sends t3 (audio play start) after receiving response.
    """
    
    session_id: UUID
    turn_id: UUID
    t3_audio_play_start: float = Field(
        description="Client timestamp when audio started playing (ms, Unix epoch)",
    )


class Run0LogResponse(BaseModel):
    """Schema for RUN0 log response."""
    
    success: bool
    e2e_latency_ms: int = Field(description="t3 - t0 (user-perceived latency)")


class SessionLogRequest(BaseModel):
    """Schema for logging client-side timestamp (generic)."""
    
    session_id: UUID
    turn_id: UUID
    t3_audio_play_start: float = Field(
        description="Client timestamp when audio started playing (ms, Unix epoch)",
    )


class SessionLogResponse(BaseModel):
    """Schema for session log response."""
    
    success: bool



# ============================================================================
# Dashboard Schemas
# ============================================================================


class DashboardMetrics(BaseModel):
    """Schema for dashboard aggregated metrics."""
    
    total_sessions: int
    total_turns: int
    avg_e2e_ms: float | None
    p50_e2e_ms: float | None
    p95_e2e_ms: float | None
    success_rate: float = Field(description="Percentage of successful sessions")
    avg_session_duration_s: float | None
    
    # Per-component latency
    avg_asr_ms: float | None
    avg_llm_ms: float | None
    avg_tts_ms: float | None
    
    # Cost
    total_cost_usd: float
    avg_cost_per_session_usd: float | None


class LatencyTrendPoint(BaseModel):
    """Schema for latency trend data point."""
    
    timestamp: datetime
    e2e_avg_ms: float
    asr_avg_ms: float | None
    llm_avg_ms: float | None
    tts_avg_ms: float | None


class DashboardResponse(BaseModel):
    """Schema for full dashboard response."""
    
    metrics: DashboardMetrics
    trend: list[LatencyTrendPoint] = Field(
        default_factory=list,
        description="Latency trend over time",
    )
    go_nogo_status: Literal["GO", "ITERATE", "STOP"] = Field(
        description="Current go/no-go status based on metrics",
    )
    recommendation: str | None = Field(
        None,
        description="Recommendation based on current metrics",
    )


# ============================================================================
# Pagination Schema
# ============================================================================


class PaginatedTemplates(BaseModel):
    """Paginated template list response."""
    
    items: list[TemplateListItem]
    total: int
    page: int
    size: int
    pages: int = Field(description="Total number of pages")


class PaginatedSessions(BaseModel):
    """Paginated session list response."""
    
    items: list[SessionListItem]
    total: int
    page: int
    size: int
    pages: int
