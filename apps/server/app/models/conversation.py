"""Conversation Scenario Validation models - SQLAlchemy ORM.

This module defines models for the "My Turn" learning scenario validation,
including templates, participants, sessions, turns, and metrics.
"""

import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


# ============================================================================
# ENUM Types
# ============================================================================


class ConversationMode(str, enum.Enum):
    """Conversation mode for the session.
    
    Attributes:
        TURN_BASED: Users take turns speaking (structured).
        FREE_FORM: Users can speak at any time (real-time interruption).
    """
    
    TURN_BASED = "turn_based"
    FREE_FORM = "free_form"


class ParticipantType(str, enum.Enum):
    """Type of participant in a conversation.
    
    Attributes:
        MODERATOR: AI moderator that controls the flow.
        AI: AI participant (e.g., Sarah, Mike).
        USER: Human user practicing English.
    """
    
    MODERATOR = "moderator"
    AI = "ai"
    USER = "user"


class SessionStatus(str, enum.Enum):
    """Status of a conversation session.
    
    Attributes:
        ACTIVE: Session is currently running.
        WAITING_USER: Waiting for user's turn.
        PAUSED: Session is paused.
        COMPLETED: Session has ended normally.
        ERROR: Session ended with an error.
    """
    
    ACTIVE = "active"
    WAITING_USER = "waiting_user"
    PAUSED = "paused"
    COMPLETED = "completed"
    ERROR = "error"


class TurnType(str, enum.Enum):
    """Type of turn in a conversation.
    
    Attributes:
        SYSTEM: System message or instruction.
        MODERATOR: Moderator's speech.
        AI: AI participant's speech.
        USER: User's speech.
    """
    
    SYSTEM = "system"
    MODERATOR = "moderator"
    AI = "ai"
    USER = "user"


class FirstSpeaker(str, enum.Enum):
    """First speaker setting for a conversation template.
    
    Attributes:
        MODERATOR_FIRST: Moderator speaks first with scene introduction.
        AI_FIRST: AI participant speaks first.
        USER_FIRST: User speaks first.
    """
    
    MODERATOR_FIRST = "moderator_first"
    AI_FIRST = "ai_first"
    USER_FIRST = "user_first"


# ============================================================================
# Template Models
# ============================================================================


class ConversationTemplate(Base):
    """Conversation template model.
    
    Defines a conversation scenario structure including participants,
    system prompt, and configuration.
    
    Attributes:
        id: Unique identifier.
        name: Template name for identification.
        description: Optional description of the scenario.
        mode: Conversation mode (turn_based or free_form).
        system_prompt: System prompt for the moderator AI.
        greeting_message: Initial greeting from moderator.
        topic: Conversation topic (e.g., "Coffee Shop Order").
        difficulty: Difficulty level (1-5).
        estimated_minutes: Estimated session duration.
        is_active: Whether template is available for use.
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
    """
    
    __tablename__ = "conversation_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    mode = Column(Enum(ConversationMode), nullable=False, default=ConversationMode.TURN_BASED)
    system_prompt = Column(Text, nullable=False)
    greeting_message = Column(Text, nullable=True)
    topic = Column(String(255), nullable=True)
    
    # Director Settings
    director_system_prompt = Column(Text, nullable=True)  # Custom instruction for Scenario Director
    director_llm_model = Column(String(100), nullable=True)  # LLM model for Scenario Director
    
    difficulty = Column(Integer, nullable=True)  # 1-5
    estimated_minutes = Column(Integer, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    
    # My Turn settings
    first_speaker = Column(
        Enum(
            FirstSpeaker,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=FirstSpeaker.MODERATOR_FIRST,
    )
    scene_context = Column(Text, nullable=True)  # Shared context for all AI participants
    turn_sequence = Column(JSONB, nullable=True)  # Custom scenario script
    
    # Narrative Sync v0.2 Pipeline Settings
    pipeline_mode = Column(String(20), nullable=True, default="basic", server_default="basic")  # "basic" or "v0.2"
    evaluator_prompt = Column(Text, nullable=True)  # Custom Evaluator prompt
    planner_prompt = Column(Text, nullable=True)  # Custom Planner prompt
    conductor_prompt = Column(Text, nullable=True)  # Custom Conductor prompt
    evaluator_llm_model = Column(String(50), nullable=True)  # LLM model for Evaluator
    planner_llm_model = Column(String(50), nullable=True)  # LLM model for Planner (future)
    conductor_llm_model = Column(String(50), nullable=True)  # LLM model for Conductor
    level_definitions = Column(JSONB, nullable=True)  # Custom level definitions JSON [{level, name, description, instruction}, ...]
    allow_user_topic = Column(Boolean, nullable=False, default=False, server_default="false")  # Allow user to set custom topic per session

    # Access Control
    is_public_to_tester = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    
    # Relationships
    participants = relationship(
        "ConversationParticipant",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="ConversationParticipant.order_index",
    )
    sessions = relationship(
        "ConversationSession",
        back_populates="template",
    )


class ConversationParticipant(Base):
    """Participant in a conversation template.
    
    Defines an AI or user participant with their persona and voice settings.
    
    Attributes:
        id: Unique identifier.
        template_id: Foreign key to parent template.
        participant_type: Type of participant (moderator, ai, user).
        name: Participant name (e.g., "Sarah", "Mike").
        persona: Character description and behavior.
        voice_id: TTS voice identifier (e.g., "en-US-Wavenet-F").
        voice_settings: JSON with voice config (speed, pitch, etc.).
        order_index: Display/turn order.
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
    """
    
    __tablename__ = "conversation_participants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("conversation_templates.id", ondelete="CASCADE"),
        nullable=False,
    )
    participant_type = Column(Enum(ParticipantType), nullable=False)
    name = Column(String(100), nullable=False)
    persona = Column(Text, nullable=True)
    voice_id = Column(String(100), nullable=True)  # e.g., "en-US-Wavenet-F"
    voice_settings = Column(JSONB, nullable=True)  # {speaking_rate, pitch, ...}
    order_index = Column(Integer, nullable=False, default=0)
    
    # My Turn additions
    difficulty = Column(Integer, nullable=True, default=1)  # 1-5 level
    greeting_message = Column(Text, nullable=True)  # First greeting for this participant
    avatar_url = Column(String(500), nullable=True)  # Avatar image URL
    
    # Model selection (admin-saved defaults)
    llm_model = Column(String(100), nullable=True)  # e.g., "gemini-2.5-flash"
    stt_model = Column(String(100), nullable=True)  # e.g., "google-chirp"
    stt_mode = Column(String(20), nullable=True, default="streaming")  # "sync" | "streaming"
    stt_streaming_display = Column(String(20), nullable=True, default="immediate")  # "immediate" | "final"
    tts_model = Column(String(100), nullable=True)  # e.g., "gemini-tts"
    tts_provider = Column(String(50), nullable=True)  # e.g., "gemini", "google"
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    
    # Relationships
    template = relationship("ConversationTemplate", back_populates="participants")


# ============================================================================
# Session Models
# ============================================================================


class ConversationSession(Base):
    """Active conversation session.
    
    Represents a running instance of a conversation template.
    
    Attributes:
        id: Unique identifier.
        template_id: Foreign key to the template used.
        status: Current session status.
        current_turn_index: Current turn number (0-based).
        current_speaker_id: UUID of current speaker participant.
        started_at: Session start timestamp.
        ended_at: Session end timestamp (if completed).
        device_type: Client device type (pc, mobile).
        browser: Client browser info.
        variant: A/B test variant.
        error_message: Error message if session ended with error.
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
    """
    
    __tablename__ = "conversation_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("conversation_templates.id", ondelete="SET NULL"),
        nullable=True,  # Keep sessions even if template is deleted
    )
    status = Column(Enum(SessionStatus), nullable=False, default=SessionStatus.ACTIVE)
    current_turn_index = Column(Integer, nullable=False, default=0)
    current_speaker_id = Column(UUID(as_uuid=True), nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    device_type = Column(String(20), nullable=True)  # pc, mobile
    browser = Column(Text, nullable=True)
    variant = Column(Text, nullable=True)  # JSON string for session config (overrides)
    error_message = Column(Text, nullable=True)
    
    # Experiment settings (can override template defaults)
    difficulty = Column(Integer, nullable=True)  # 1-5
    estimated_minutes = Column(Integer, nullable=True)
    
    # My Turn additions
    user_name = Column(String(100), nullable=True)  # User's name for personalized conversation
    current_speaker_type = Column(String(20), nullable=True)  # moderator, ai, user
    
    # Run0 additions
    experiment_type = Column(String(20), nullable=True)  # "run0" or None (My Turn)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    
    # Relationships
    template = relationship("ConversationTemplate", back_populates="sessions")
    turns = relationship(
        "ConversationTurn",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ConversationTurn.turn_index",
    )
    metrics = relationship(
        "SessionMetrics",
        back_populates="session",
        cascade="all, delete-orphan",
    )


class ConversationTurn(Base):
    """Individual turn in a conversation session.
    
    Records each utterance in the conversation with timing information.
    
    Attributes:
        id: Unique identifier.
        session_id: Foreign key to parent session.
        turn_index: Turn order (0-based).
        turn_type: Type of turn (system, moderator, ai, user).
        speaker_name: Name of the speaker.
        content_text: Text content of the turn.
        audio_url: URL to audio file if available.
        audio_duration_ms: Audio duration in milliseconds.
        
        # Timing (RUN0 timestamps)
        t0_user_end: When user stopped speaking/recording.
        t1_asr_final: When STT result arrived.
        t2_llm_final: When LLM response completed.
        t2_5_tts_ready: When TTS audio is ready.
        t3_audio_play_start: When client started playing audio.
        
        created_at: Creation timestamp.
    """
    
    __tablename__ = "conversation_turns"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("conversation_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    turn_index = Column(Integer, nullable=False)
    turn_type = Column(Enum(TurnType), nullable=False)
    speaker_name = Column(String(100), nullable=True)
    content_text = Column(Text, nullable=True)
    audio_url = Column(String(500), nullable=True)
    audio_duration_ms = Column(Integer, nullable=True)
    
    # RUN0 timestamps (milliseconds, Unix epoch)
    t0_user_end = Column(Float, nullable=True)
    t1_asr_final = Column(Float, nullable=True)
    t1_5_llm_start = Column(Float, nullable=True)  # LLM POST arrival (server clock)
    t2_llm_final = Column(Float, nullable=True)
    t2_5_tts_ready = Column(Float, nullable=True)
    t3_audio_play_start = Column(Float, nullable=True)
    
    # Additional metadata
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    model_name = Column(String(50), nullable=True)
    stt_provider = Column(String(50), nullable=True)  # google
    tts_provider = Column(String(50), nullable=True)  # google
    tts_voice = Column(String(100), nullable=True)  # Voice used
    stt_model = Column(String(100), nullable=True)  # STT model used (e.g., latest_long, chirp_2)
    
    # Accuracy metrics (WER/CER)
    reference_text = Column(Text, nullable=True)  # Ground truth text for WER comparison
    wer = Column(Float, nullable=True)  # Word Error Rate (0.0~1.0+)
    cer = Column(Float, nullable=True)  # Character Error Rate (0.0~1.0+)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    session = relationship("ConversationSession", back_populates="turns")


# ============================================================================
# Metrics Models
# ============================================================================


class SessionMetrics(Base):
    """Aggregated metrics for a conversation session.
    
    Stores computed metrics after session completion or periodically.
    
    Attributes:
        id: Unique identifier.
        session_id: Foreign key to session.
        
        # Latency metrics (milliseconds)
        e2e_avg_ms: Average end-to-end latency.
        e2e_p50_ms: Median end-to-end latency.
        e2e_p95_ms: 95th percentile end-to-end latency.
        asr_avg_ms: Average ASR latency.
        llm_avg_ms: Average LLM latency.
        tts_avg_ms: Average TTS latency.
        
        # Quality metrics
        total_turns: Total number of turns.
        user_turns: Number of user turns.
        asr_retry_count: Number of ASR retries.
        error_count: Number of errors.
        
        # Cost metrics
        total_input_tokens: Total input tokens used.
        total_output_tokens: Total output tokens used.
        estimated_cost_usd: Estimated total cost.
        
        created_at: Creation timestamp.
    """
    
    __tablename__ = "session_metrics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("conversation_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    
    # Latency metrics (milliseconds)
    e2e_avg_ms = Column(Float, nullable=True)
    e2e_p50_ms = Column(Float, nullable=True)
    e2e_p95_ms = Column(Float, nullable=True)
    asr_avg_ms = Column(Float, nullable=True)
    network_transit_avg_ms = Column(Float, nullable=True)  # t1→t1.5 avg
    llm_avg_ms = Column(Float, nullable=True)
    tts_avg_ms = Column(Float, nullable=True)
    client_load_avg_ms = Column(Float, nullable=True)  # t2.5→t3 avg
    
    # Accuracy metrics (WER/CER averages)
    avg_wer = Column(Float, nullable=True)  # Average Word Error Rate
    avg_cer = Column(Float, nullable=True)  # Average Character Error Rate
    
    # Quality metrics
    total_turns = Column(Integer, nullable=False, default=0)
    user_turns = Column(Integer, nullable=False, default=0)
    asr_retry_count = Column(Integer, nullable=False, default=0)
    error_count = Column(Integer, nullable=False, default=0)
    
    # Cost metrics
    total_input_tokens = Column(Integer, nullable=False, default=0)
    total_output_tokens = Column(Integer, nullable=False, default=0)
    estimated_cost_usd = Column(Float, nullable=False, default=0.0)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    session = relationship("ConversationSession", back_populates="metrics")


# ============================================================================
# Measurement Config Models
# ============================================================================


class MeasurementConfig(Base):
    """Measurement configuration for RUN0 testing.
    
    Defines which metrics to collect and their thresholds.
    
    Attributes:
        id: Unique identifier.
        name: Configuration name.
        description: Optional description.
        is_default: Whether this is the default config.
        
        # Thresholds
        e2e_target_ms: Target E2E latency.
        e2e_max_ms: Maximum acceptable E2E latency.
        asr_target_ms: Target ASR latency.
        llm_target_ms: Target LLM latency.
        tts_target_ms: Target TTS latency.
        
        # Test settings
        test_iterations: Number of test iterations.
        warmup_iterations: Number of warmup iterations.
        
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
    """
    
    __tablename__ = "measurement_configs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, nullable=False, default=False)
    
    # Thresholds (milliseconds)
    e2e_target_ms = Column(Integer, nullable=False, default=3000)  # 3s target
    e2e_max_ms = Column(Integer, nullable=False, default=5000)  # 5s max
    asr_target_ms = Column(Integer, nullable=True)
    llm_target_ms = Column(Integer, nullable=True)
    tts_target_ms = Column(Integer, nullable=True)
    
    # Test settings
    test_iterations = Column(Integer, nullable=False, default=10)
    warmup_iterations = Column(Integer, nullable=False, default=2)
    
    # Test phrases for STT testing
    test_phrases = Column(JSONB, nullable=True)  # ["phrase1", "phrase2", ...]
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
