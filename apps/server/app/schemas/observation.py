"""Session observation data schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ObservationLayer1(BaseModel):
    """Layer 1: Rule-based 자동 집계 메트릭."""

    session_duration_sec: Optional[float] = None
    total_user_turns: int = 0
    total_ai_turns: int = 0
    avg_user_utterance_length: Optional[float] = None
    max_user_utterance_length: Optional[int] = None
    min_user_utterance_length: Optional[int] = None
    utterance_length_trend: Optional[str] = None
    avg_user_response_interval_sec: Optional[float] = None
    short_reply_count: int = 0
    silence_timeout_count: int = 0
    first_user_response_time_sec: Optional[float] = None
    completion_status: Optional[str] = None
    word_count_per_turn: Optional[list[int]] = None
    long_latency_turn_count: int = 0
    long_latency_turn_ratio: Optional[float] = None
    long_gap_count: int = 0
    followup_after_short_answer: int = 0


class ObservationLayer2(BaseModel):
    """Layer 2: Pipeline LLM 집계."""

    avg_overall_score: Optional[float] = None
    score_trend: Optional[str] = None
    level_progression: Optional[list[int]] = None
    max_level_reached: Optional[int] = None
    level_up_count: int = 0
    level_down_count: int = 0
    primary_issues: Optional[list[str]] = None
    correction_count: int = 0
    fluency_wpm_trend: Optional[list[float]] = None
    template_specific_data: Optional[dict] = None


class ObservationLayer3(BaseModel):
    """Layer 3: Reporting LLM 분석 (Phase 3에서 채움)."""

    learning_behavior_summary: Optional[str] = None
    engagement_level: Optional[str] = None
    key_learning_points: Optional[list[str]] = None
    struggle_points: Optional[list[str]] = None
    communication_style: Optional[str] = None
    topic_maintenance_score: Optional[float] = None
    question_back_count: Optional[int] = None
    natural_conversation_score: Optional[float] = None
    improvement_suggestions: Optional[list[str]] = None
    elaboration_adequacy: Optional[dict] = None
    explicit_clarification_analysis: Optional[dict] = None
    response_start_quality: Optional[str] = None
    response_start_quality_detail: Optional[list[dict]] = None
    flow_maintenance: Optional[str] = None
    flow_maintenance_detail: Optional[list[dict]] = None
    coping_attempt: Optional[dict] = None
    clarification_success: Optional[dict] = None
    avoidance_vs_response: Optional[dict] = None


class SessionObservationResponse(BaseModel):
    """세션 관찰 데이터 전체 응답."""

    id: UUID
    session_id: UUID
    account_id: Optional[UUID] = None
    layer1: ObservationLayer1
    layer2: ObservationLayer2
    layer3: ObservationLayer3
    generated_at: datetime
    reporting_llm_model: Optional[str] = None
    reporting_llm_duration_ms: Optional[float] = None
    has_layer3: bool = False

    class Config:
        from_attributes = True


class SessionObservationSummary(BaseModel):
    """세션 목록 미리보기용 요약."""

    session_id: UUID
    engagement_level: Optional[str] = None
    max_level_reached: Optional[int] = None
    has_layer3: bool = False
    completion_status: Optional[str] = None
