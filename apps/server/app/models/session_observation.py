"""Session observation data model for learning behavior analysis."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class SessionObservation(Base):
    """세션 레벨 관찰 데이터.

    Layer 1+2: 세션 종료 시 자동 생성
    Layer 3: Admin 수동 트리거로 업데이트 (Phase 3에서 구현)
    Layer 4: 관찰자 수동 태깅 향후 구현

    Attributes:
        id: Unique identifier.
        session_id: Foreign key to parent session (unique — 1:1 with session).
        account_id: Optional foreign key to owning account.
    """

    __tablename__ = "session_observations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("conversation_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ── Layer 1: Rule-based 메트릭 ──
    session_duration_sec = Column(Float, nullable=True)
    total_user_turns = Column(Integer, default=0)
    total_ai_turns = Column(Integer, default=0)
    avg_user_utterance_length = Column(Float, nullable=True)  # 단어 수 기준
    max_user_utterance_length = Column(Integer, nullable=True)
    min_user_utterance_length = Column(Integer, nullable=True)
    utterance_length_trend = Column(String(20), nullable=True)  # improving/stable/declining
    avg_user_response_interval_sec = Column(Float, nullable=True)
    short_reply_count = Column(Integer, default=0)  # 초벌 필터 (단어수 ≤ 3)
    silence_timeout_count = Column(Integer, default=0)
    first_user_response_time_sec = Column(Float, nullable=True)
    completion_status = Column(String(20), nullable=True)  # completed/timeout/error/user_exit
    word_count_per_turn = Column(JSONB, nullable=True)  # [5, 8, 12, 3, ...]
    long_latency_turn_count = Column(Integer, default=0)  # E2E > 5초 턴 갯수
    long_latency_turn_ratio = Column(Float, nullable=True)  # count / total_user_turns
    long_gap_count = Column(Integer, default=0)  # 응답 간격 > 5초
    followup_after_short_answer = Column(Integer, default=0)
    in_speech_pause_data = Column(JSONB, nullable=True)  # R&D 예약 필드 (Phase 5+)

    # ── Layer 2: Pipeline LLM 집계 ──
    avg_overall_score = Column(Float, nullable=True)
    score_trend = Column(String(20), nullable=True)
    level_progression = Column(JSONB, nullable=True)  # [1, 1, 2, 2, 3, ...]
    max_level_reached = Column(Integer, nullable=True)
    level_up_count = Column(Integer, default=0)
    level_down_count = Column(Integer, default=0)
    primary_issues = Column(JSONB, nullable=True)  # TOP 3 이슈
    correction_count = Column(Integer, default=0)
    fluency_wpm_trend = Column(JSONB, nullable=True)
    template_specific_data = Column(JSONB, nullable=True)  # 템플릿별 커스텀 데이터

    # ── Layer 3: Reporting LLM 분석 (Phase 3에서 구현) ──
    learning_behavior_summary = Column(Text, nullable=True)
    engagement_level = Column(String(20), nullable=True)  # high/medium/low
    key_learning_points = Column(JSONB, nullable=True)
    struggle_points = Column(JSONB, nullable=True)
    communication_style = Column(String(20), nullable=True)  # reactive/proactive/balanced
    topic_maintenance_score = Column(Float, nullable=True)
    question_back_count = Column(Integer, nullable=True)
    natural_conversation_score = Column(Float, nullable=True)
    improvement_suggestions = Column(JSONB, nullable=True)
    elaboration_adequacy = Column(JSONB, nullable=True)
    explicit_clarification_analysis = Column(JSONB, nullable=True)
    response_start_quality = Column(String(20), nullable=True)
    response_start_quality_detail = Column(JSONB, nullable=True)
    flow_maintenance = Column(String(20), nullable=True)
    flow_maintenance_detail = Column(JSONB, nullable=True)
    coping_attempt = Column(JSONB, nullable=True)
    clarification_success = Column(JSONB, nullable=True)
    avoidance_vs_response = Column(JSONB, nullable=True)

    # ── Layer 4: 수동 태깅 (향후) ──
    observer_notes = Column(Text, nullable=True)
    pronunciation_quality = Column(Integer, nullable=True)  # 1-5
    confidence_level = Column(Integer, nullable=True)  # 1-5
    custom_tags = Column(JSONB, nullable=True)

    # ── 메타 ──
    generated_at = Column(DateTime, default=datetime.utcnow)
    reporting_llm_model = Column(String(100), nullable=True)
    reporting_llm_duration_ms = Column(Float, nullable=True)

    # Relationships
    session = relationship("ConversationSession", back_populates="observation")
    account = relationship("Account")
