---
title: "Phase 1: 기반 인프라 + Layer 1 Rule-Based 메트릭"
type: spec
tags:
  - spec
  - session-observation
  - phase-1
  - status/draft
created: 2026-04-10
updated: 2026-04-10
author: Claude Opus 4.6
related:
  - "[[session-observation-implementation]]"
  - "[[session-observation-system]]"
---

# Phase 1: 기반 인프라 + Layer 1 Rule-Based 메트릭

---

## 명령 프롬프트 (이 텍스트를 Claude 세션에 복사하세요)

```
아래 기획서를 읽고 Phase 1을 구현해줘.
기획서 경로: docs/plan/session-observation-impl-phase1.md
개요 기획서 경로: docs/plan/session-observation-system.md (참고용)

구현 순서:
1. Alembic 마이그레이션 파일 생성 및 실행
2. SessionObservation SQLAlchemy 모델 생성
3. 기존 모델(ConversationSession, ConversationTurn) 수정
4. Pydantic 응답 스키마 생성
5. ObservationService 구현 (Layer 1 + Layer 2 stub)
6. 세션 종료 시 자동 트리거 연결
7. API 엔드포인트 추가
8. 오디오 업로드 API에 t_recording_start, t_first_speech 파라미터 추가
9. 검증 테스트

주의사항:
- 특정 템플릿(EMF 등)에 종속되지 않는 범용 설계
- 기존 코드의 동작을 변경하지 말 것
- 서버 CLAUDE.md의 코드 컨벤션을 준수할 것
- template_specific_data는 JSONB로 두되, 특정 템플릿 로직을 하드코딩하지 말 것
```

---

## 목표

- `session_observations` 테이블 생성 (Layer 1~4 전체 스키마)
- `conversation_sessions`에 `account_id` 컬럼 추가
- `conversation_turns`에 `t_recording_start`, `t_first_speech` 컬럼 추가
- `ObservationService` — 세션 종료 시 Layer 1 메트릭 자동 계산
- 관찰 데이터 조회/생성 API 엔드포인트
- 오디오 업로드 API에 새 타이밍 파라미터 추가

```mermaid
sequenceDiagram
    participant U as User (My Turn)
    participant API as FastAPI
    participant MT as MyTurnService
    participant OS as ObservationService
    participant DB as PostgreSQL

    Note over U,API: 세션 진행 중
    U->>API: POST /sessions/{id}/audio (+ t_recording_start, t_first_speech)
    API->>MT: process_user_turn()
    MT->>DB: conversation_turns INSERT (t_recording_start, t_first_speech 포함)

    Note over MT,OS: 세션 종료 시
    MT->>MT: session.status = COMPLETED
    MT->>OS: generate_observation(session_id)
    OS->>DB: SELECT turns, pipeline_logs
    OS->>OS: Layer 1 계산 (17개 메트릭)
    OS->>DB: INSERT session_observations

    Note over API: 나중에 Admin에서 조회
    API->>DB: GET /sessions/{id}/observation
    DB-->>API: Layer 1+2 데이터
```

---

## 현재 코드베이스 컨텍스트 (이 Phase에서 참조하는 파일들)

### 핵심 파일 경로

| 파일 | 역할 | 수정/생성 |
|------|------|----------|
| `apps/server/app/models/conversation.py` | Session, Turn, PipelineLog, SessionMetrics 모델 | **수정** (컬럼 추가) |
| `apps/server/app/models/__init__.py` | 모델 import 등록 | **수정** (import 추가) |
| `apps/server/app/models/base.py` | `Base(DeclarativeBase)` 정의 | 참조만 |
| `apps/server/app/models/session_observation.py` | SessionObservation 모델 | **신규 생성** |
| `apps/server/app/schemas/observation.py` | 관찰 데이터 Pydantic 스키마 | **신규 생성** |
| `apps/server/app/services/conversation/observation_service.py` | 관찰 데이터 생성 서비스 | **신규 생성** |
| `apps/server/app/api/v1/conversations.py` | API 라우터 | **수정** (엔드포인트 추가) |
| `apps/server/app/services/conversation/my_turn_service.py` | My Turn 오케스트레이션 | **수정** (트리거 연결) |
| `apps/server/migrations/versions/` | Alembic 마이그레이션 | **신규 생성** |

### 현재 ConversationSession 모델 (수정 대상)

```python
# apps/server/app/models/conversation.py
class ConversationSession(Base):
    __tablename__ = "conversation_sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey("conversation_templates.id"))
    status = Column(SAEnum(SessionStatus), default=SessionStatus.ACTIVE)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    user_name = Column(String(100), nullable=True)
    variant = Column(Text, nullable=True)
    device_type = Column(String, nullable=True)
    browser = Column(String, nullable=True)
    experiment_type = Column(String(20), nullable=True)
    # ... relationships, created_at, updated_at
    # ⚠️ account_id 없음 → 추가 필요
```

### 현재 ConversationTurn 모델 (수정 대상)

```python
# apps/server/app/models/conversation.py
class ConversationTurn(Base):
    __tablename__ = "conversation_turns"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("conversation_sessions.id", ondelete="CASCADE"))
    turn_index = Column(Integer)
    turn_type = Column(SAEnum(TurnType))
    speaker_name = Column(String(100), nullable=True)
    content_text = Column(Text, nullable=True)
    audio_url = Column(String, nullable=True)
    audio_duration_ms = Column(Integer, nullable=True)
    # RUN0 타이밍 (ms)
    t0_user_end = Column(Float, nullable=True)
    t1_asr_final = Column(Float, nullable=True)
    t1_5_llm_start = Column(Float, nullable=True)
    t2_llm_final = Column(Float, nullable=True)
    t2_5_tts_ready = Column(Float, nullable=True)
    t3_audio_play_start = Column(Float, nullable=True)
    # 메타데이터
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    model_name = Column(String(100), nullable=True)
    stt_provider = Column(String(50), nullable=True)
    stt_model = Column(String(50), nullable=True)
    tts_provider = Column(String(50), nullable=True)
    tts_voice = Column(String(100), nullable=True)
    reference_text = Column(Text, nullable=True)
    wer = Column(Float, nullable=True)
    cer = Column(Float, nullable=True)
    # ⚠️ t_recording_start, t_first_speech 없음 → 추가 필요
```

### 현재 process_my_turn_audio API (수정 대상)

```python
# apps/server/app/api/v1/conversations.py (약 464행)
@router.post("/sessions/{session_id}/audio")
async def process_my_turn_audio(
    db: DbSession,
    session_id: UUID,
    background_tasks: BackgroundTasks,
    audio_file: UploadFile = File(..., description="Audio file"),
    t0_user_end: float = Form(0.0, description="Client timestamp when user stopped speaking"),
):
    service = MyTurnService(db)
    audio_data = await audio_file.read()
    content_type = audio_file.content_type or ""
    audio_format = "webm"
    if "wav" in content_type or audio_file.filename.endswith(".wav"):
        audio_format = "wav"
    elif "mp3" in content_type or audio_file.filename.endswith(".mp3"):
        audio_format = "mp3"
    try:
        return await service.process_user_turn(session_id, audio_data, audio_format, background_tasks, t0_user_end)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
```

### 세션 COMPLETED 설정 위치 (4곳)

```python
# apps/server/app/services/conversation/my_turn_service.py

# 1. 유저 타임아웃 (약 122행)
session.status = SessionStatus.COMPLETED
session.error_message = "Session timed out (5 minutes due to inactivity)"

# 2. Stale 세션 정리 (약 169행)
session.status = SessionStatus.COMPLETED
session.error_message = f"Auto-closed by cleanup (inactive > 3m, started > 5m)"

# 3. 서버 재시작 정리 (약 197행) — bulk update
.values(status=SessionStatus.COMPLETED, error_message="Session interrupted by server restart")

# 4. 정상 완료 (약 479행)
session.status = SessionStatus.COMPLETED
await self.db.commit()
await manager.send_message(str(session.id), {"type": "session_completed"})
```

### 세션 생성 위치

```python
# apps/server/app/services/conversation/session_service.py (약 224행)
session = ConversationSession(
    template_id=data.template_id,
    status=SessionStatus.ACTIVE,
    current_turn_index=0,
    device_type=data.device_type,
    browser=data.browser,
    variant=data.variant,
    difficulty=data.difficulty,
    estimated_minutes=data.estimated_minutes,
    user_name=data.user_name,
    current_speaker_type="waiting",
)
```

### Alembic 최신 마이그레이션

- **최신 revision**: `q2r3s4t5u6v7`
- **down_revision**: `78914c0eaf57`
- 파일: `apps/server/migrations/versions/q2r3s4t5u6v7_add_energy_flow_enabled.py`

### 의존성 주입 패턴

```python
# apps/server/app/api/deps.py
DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentAccount = Annotated[object, Depends(get_current_account)]
```

### models/__init__.py 현재 import 목록 (conversation 관련)

```python
from app.models.conversation import (
    ConversationMode, ConversationParticipant, ConversationSession,
    ConversationTemplate, ConversationTurn, MeasurementConfig,
    ParticipantType, SessionMetrics, SessionStatus, TurnType,
)
```

---

## Task 1-1: Alembic 마이그레이션

### 실행 명령

```bash
cd apps/server
poetry run alembic revision --autogenerate -m "add_session_observation_system"
```

> [!WARNING] autogenerate가 모델을 인식하려면 Task 1-2, 1-3의 모델 파일이 먼저 생성되어야 합니다.
> **권장 순서**: Task 1-2 (모델 생성) → Task 1-3 (models/__init__.py 수정) → Task 1-1 (autogenerate) 순으로 진행하세요.
> autogenerate가 실패하면 아래 SQL을 수동으로 마이그레이션 파일에 작성합니다.

### 마이그레이션 내용 (수동 작성 시)

**3가지 변경**:
1. `session_observations` 테이블 생성
2. `conversation_sessions`에 `account_id` 컬럼 추가
3. `conversation_turns`에 `t_recording_start`, `t_first_speech` 컬럼 추가

```python
"""add session observation system"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    # 1. session_observations 테이블
    op.create_table(
        "session_observations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("conversation_sessions.id", ondelete="CASCADE"),
                  nullable=False, unique=True, index=True),
        sa.Column("account_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("accounts.id", ondelete="SET NULL"),
                  nullable=True, index=True),

        # Layer 1
        sa.Column("session_duration_sec", sa.Float(), nullable=True),
        sa.Column("total_user_turns", sa.Integer(), server_default="0"),
        sa.Column("total_ai_turns", sa.Integer(), server_default="0"),
        sa.Column("avg_user_utterance_length", sa.Float(), nullable=True),
        sa.Column("max_user_utterance_length", sa.Integer(), nullable=True),
        sa.Column("min_user_utterance_length", sa.Integer(), nullable=True),
        sa.Column("utterance_length_trend", sa.String(20), nullable=True),
        sa.Column("avg_user_response_interval_sec", sa.Float(), nullable=True),
        sa.Column("short_reply_count", sa.Integer(), server_default="0"),
        sa.Column("silence_timeout_count", sa.Integer(), server_default="0"),
        sa.Column("first_user_response_time_sec", sa.Float(), nullable=True),
        sa.Column("completion_status", sa.String(20), nullable=True),
        sa.Column("word_count_per_turn", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("long_latency_turn_count", sa.Integer(), server_default="0"),
        sa.Column("long_latency_turn_ratio", sa.Float(), nullable=True),
        sa.Column("long_gap_count", sa.Integer(), server_default="0"),
        sa.Column("followup_after_short_answer", sa.Integer(), server_default="0"),
        sa.Column("in_speech_pause_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Layer 2
        sa.Column("avg_overall_score", sa.Float(), nullable=True),
        sa.Column("score_trend", sa.String(20), nullable=True),
        sa.Column("level_progression", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("max_level_reached", sa.Integer(), nullable=True),
        sa.Column("level_up_count", sa.Integer(), server_default="0"),
        sa.Column("level_down_count", sa.Integer(), server_default="0"),
        sa.Column("primary_issues", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("correction_count", sa.Integer(), server_default="0"),
        sa.Column("fluency_wpm_trend", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("template_specific_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Layer 3
        sa.Column("learning_behavior_summary", sa.Text(), nullable=True),
        sa.Column("engagement_level", sa.String(20), nullable=True),
        sa.Column("key_learning_points", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("struggle_points", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("communication_style", sa.String(20), nullable=True),
        sa.Column("topic_maintenance_score", sa.Float(), nullable=True),
        sa.Column("question_back_count", sa.Integer(), nullable=True),
        sa.Column("natural_conversation_score", sa.Float(), nullable=True),
        sa.Column("improvement_suggestions", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("elaboration_adequacy", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("explicit_clarification_analysis", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("response_start_quality", sa.String(20), nullable=True),
        sa.Column("response_start_quality_detail", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("flow_maintenance", sa.String(20), nullable=True),
        sa.Column("flow_maintenance_detail", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("coping_attempt", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("clarification_success", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("avoidance_vs_response", postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Layer 4
        sa.Column("observer_notes", sa.Text(), nullable=True),
        sa.Column("pronunciation_quality", sa.Integer(), nullable=True),
        sa.Column("confidence_level", sa.Integer(), nullable=True),
        sa.Column("custom_tags", postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # 메타
        sa.Column("generated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("reporting_llm_model", sa.String(100), nullable=True),
        sa.Column("reporting_llm_duration_ms", sa.Float(), nullable=True),
    )

    # 2. conversation_sessions.account_id
    op.add_column("conversation_sessions",
        sa.Column("account_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True))
    op.create_index("ix_conversation_sessions_account_id",
                    "conversation_sessions", ["account_id"])

    # 3. conversation_turns 타이밍 필드
    op.add_column("conversation_turns",
        sa.Column("t_recording_start", sa.Float(), nullable=True))
    op.add_column("conversation_turns",
        sa.Column("t_first_speech", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("conversation_turns", "t_first_speech")
    op.drop_column("conversation_turns", "t_recording_start")
    op.drop_index("ix_conversation_sessions_account_id", "conversation_sessions")
    op.drop_column("conversation_sessions", "account_id")
    op.drop_table("session_observations")
```

---

## Task 1-2: SessionObservation 모델

### 신규 파일: `apps/server/app/models/session_observation.py`

```python
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
    Layer 3: Admin 수동 트리거로 업데이트
    Layer 4: 관찰자 수동 태깅 (향후)
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
    avg_user_utterance_length = Column(Float, nullable=True)
    max_user_utterance_length = Column(Integer, nullable=True)
    min_user_utterance_length = Column(Integer, nullable=True)
    utterance_length_trend = Column(String(20), nullable=True)
    avg_user_response_interval_sec = Column(Float, nullable=True)
    short_reply_count = Column(Integer, default=0)
    silence_timeout_count = Column(Integer, default=0)
    first_user_response_time_sec = Column(Float, nullable=True)
    completion_status = Column(String(20), nullable=True)
    word_count_per_turn = Column(JSONB, nullable=True)
    long_latency_turn_count = Column(Integer, default=0)
    long_latency_turn_ratio = Column(Float, nullable=True)
    long_gap_count = Column(Integer, default=0)
    followup_after_short_answer = Column(Integer, default=0)
    in_speech_pause_data = Column(JSONB, nullable=True)

    # ── Layer 2: Pipeline LLM 집계 ──
    avg_overall_score = Column(Float, nullable=True)
    score_trend = Column(String(20), nullable=True)
    level_progression = Column(JSONB, nullable=True)
    max_level_reached = Column(Integer, nullable=True)
    level_up_count = Column(Integer, default=0)
    level_down_count = Column(Integer, default=0)
    primary_issues = Column(JSONB, nullable=True)
    correction_count = Column(Integer, default=0)
    fluency_wpm_trend = Column(JSONB, nullable=True)
    template_specific_data = Column(JSONB, nullable=True)

    # ── Layer 3: Reporting LLM 분석 ──
    learning_behavior_summary = Column(Text, nullable=True)
    engagement_level = Column(String(20), nullable=True)
    key_learning_points = Column(JSONB, nullable=True)
    struggle_points = Column(JSONB, nullable=True)
    communication_style = Column(String(20), nullable=True)
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

    # ── Layer 4: 수동 태깅 ──
    observer_notes = Column(Text, nullable=True)
    pronunciation_quality = Column(Integer, nullable=True)
    confidence_level = Column(Integer, nullable=True)
    custom_tags = Column(JSONB, nullable=True)

    # ── 메타 ──
    generated_at = Column(DateTime, default=datetime.utcnow)
    reporting_llm_model = Column(String(100), nullable=True)
    reporting_llm_duration_ms = Column(Float, nullable=True)

    # Relationships
    session = relationship("ConversationSession", back_populates="observation")
    account = relationship("Account")
```

### 기존 모델 수정: `apps/server/app/models/conversation.py`

**ConversationSession 클래스에 추가할 것**:

```python
# 다른 Column 정의 뒤에 추가
account_id = Column(
    UUID(as_uuid=True),
    ForeignKey("accounts.id", ondelete="SET NULL"),
    nullable=True,
    index=True,
)

# relationships 영역에 추가
account = relationship("Account")
observation = relationship("SessionObservation", back_populates="session", uselist=False)
```

> [!WARNING] `relationship("SessionObservation")` 참조를 위해 `SessionObservation` 모델이 `models/__init__.py`에 등록되어야 합니다.

**ConversationTurn 클래스에 추가할 것** (`t3_audio_play_start` 컬럼 뒤에):

```python
t_recording_start = Column(Float, nullable=True)
t_first_speech = Column(Float, nullable=True)
```

### models/__init__.py 수정

```python
# 기존 conversation import 블록 근처에 추가
from app.models.session_observation import SessionObservation
```

---

## Task 1-3: Pydantic 응답 스키마

### 신규 파일: `apps/server/app/schemas/observation.py`

```python
"""Session observation data schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


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
    """Layer 3: Reporting LLM 분석."""

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
```

---

## Task 1-4: ObservationService 구현

### 신규 파일: `apps/server/app/services/conversation/observation_service.py`

> [!IMPORTANT] 설계 원칙
> - 모든 메트릭 계산은 **템플릿에 무관**하게 동작해야 함
> - `template_specific_data`는 있으면 저장하되, 특정 템플릿 키를 하드코딩하지 않음
> - Layer 2의 `_compute_layer2`는 stub으로 두고 Phase 2에서 구현

```python
"""Session observation service — generates learning behavior metrics."""

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import (
    ConversationSession,
    ConversationTurn,
    PipelineLog,
    SessionMetrics,
    SessionStatus,
    TurnType,
)
from app.models.session_observation import SessionObservation

logger = logging.getLogger(__name__)


class ObservationService:
    """세션 관찰 데이터 생성 서비스.

    세션 종료 시: Layer 1 + Layer 2 자동 계산
    Admin 수동 트리거 시: Layer 3 결과 저장 (Phase 3)
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ──────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────

    async def generate_observation(self, session_id: UUID) -> SessionObservation:
        """Layer 1 + Layer 2 관찰 데이터 생성. 이미 존재하면 덮어쓰기."""
        existing = await self._get_existing(session_id)
        observation = existing if existing else SessionObservation(session_id=session_id)

        session = await self._get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        turns = await self._get_turns(session_id)
        pipeline_logs = await self._get_pipeline_logs(session_id)
        metrics = await self._get_session_metrics(session_id)

        observation.account_id = session.account_id
        self._compute_layer1(observation, session, turns, metrics)
        self._compute_layer2(observation, pipeline_logs)

        if not existing:
            self.db.add(observation)

        await self.db.flush()
        logger.info(f"Observation generated for session {session_id}")
        return observation

    async def get_observation(self, session_id: UUID) -> Optional[SessionObservation]:
        """관찰 데이터 조회."""
        return await self._get_existing(session_id)

    async def update_layer3(
        self, session_id: UUID, layer3_data: dict,
    ) -> SessionObservation:
        """Layer 3 결과 업데이트. Phase 3에서 호출."""
        observation = await self._get_existing(session_id)
        if not observation:
            raise ValueError(
                f"Observation for session {session_id} not found. "
                "Generate Layer 1+2 first."
            )
        for key, value in layer3_data.items():
            if hasattr(observation, key):
                setattr(observation, key, value)
        await self.db.flush()
        return observation

    # ──────────────────────────────────────────────
    # Layer 1: Rule-based 메트릭
    # ──────────────────────────────────────────────

    def _compute_layer1(
        self,
        obs: SessionObservation,
        session: ConversationSession,
        turns: list[ConversationTurn],
        metrics: Optional[SessionMetrics],
    ) -> None:
        user_turns = [t for t in turns if t.turn_type == TurnType.USER]
        ai_turns = [
            t for t in turns
            if t.turn_type in (TurnType.AI, TurnType.MODERATOR)
        ]

        obs.total_user_turns = len(user_turns)
        obs.total_ai_turns = len(ai_turns)

        # 세션 시간
        if session.started_at and session.ended_at:
            obs.session_duration_sec = round(
                (session.ended_at - session.started_at).total_seconds(), 1
            )

        # 완료 상태
        obs.completion_status = self._determine_completion_status(session)

        # ── 발화 길이 분석 ──
        word_counts = [
            self._word_count(t.content_text)
            for t in user_turns if t.content_text
        ]
        obs.word_count_per_turn = word_counts

        if word_counts:
            obs.avg_user_utterance_length = round(
                sum(word_counts) / len(word_counts), 2
            )
            obs.max_user_utterance_length = max(word_counts)
            obs.min_user_utterance_length = min(word_counts)
            obs.utterance_length_trend = self._compute_trend(word_counts)

        # 짧은 답변 (3단어 이하 초벌 필터)
        obs.short_reply_count = sum(1 for wc in word_counts if wc <= 3)

        # 짧은 답변 후 개선 횟수
        obs.followup_after_short_answer = self._count_followup_improvements(
            word_counts
        )

        # ── 응답 간격 (t_first_speech - t_recording_start) ──
        intervals: list[float] = []
        for t in user_turns:
            if (
                t.t_first_speech is not None
                and t.t_recording_start is not None
                and t.t_first_speech >= t.t_recording_start
            ):
                interval_sec = (t.t_first_speech - t.t_recording_start) / 1000.0
                intervals.append(interval_sec)

        if intervals:
            obs.avg_user_response_interval_sec = round(
                sum(intervals) / len(intervals), 2
            )
            obs.long_gap_count = sum(1 for iv in intervals if iv > 5.0)

        # 첫 응답 시간 (첫 번째 user turn)
        if (
            user_turns
            and user_turns[0].t_first_speech is not None
            and user_turns[0].t_recording_start is not None
        ):
            first = (
                user_turns[0].t_first_speech - user_turns[0].t_recording_start
            ) / 1000.0
            if first >= 0:
                obs.first_user_response_time_sec = round(first, 2)

        # 침묵 타임아웃 (content_text가 비어있는 user turn)
        obs.silence_timeout_count = sum(
            1 for t in user_turns
            if not t.content_text or t.content_text.strip() == ""
        )

        # ── E2E 레이턴시 분석 ──
        e2e_threshold_ms = 5000.0
        long_count = 0
        measurable_count = 0
        for t in user_turns:
            if t.t0_user_end and t.t3_audio_play_start:
                measurable_count += 1
                if t.t3_audio_play_start - t.t0_user_end > e2e_threshold_ms:
                    long_count += 1

        obs.long_latency_turn_count = long_count
        obs.long_latency_turn_ratio = (
            round(long_count / measurable_count, 3)
            if measurable_count > 0 else None
        )

    # ──────────────────────────────────────────────
    # Layer 2: Pipeline 집계 (Phase 2에서 구현)
    # ──────────────────────────────────────────────

    def _compute_layer2(
        self, obs: SessionObservation, pipeline_logs: list[PipelineLog],
    ) -> None:
        """Pipeline 로그 집계. Phase 2에서 구현."""
        pass

    # ──────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────

    @staticmethod
    def _word_count(text: str) -> int:
        """영어 단어 수 (공백 split)."""
        if not text:
            return 0
        return len(text.strip().split())

    @staticmethod
    def _compute_trend(values: list[int], window: int = 3) -> str:
        """처음 N개 vs 마지막 N개 평균 비교 → improving/stable/declining."""
        if len(values) < window * 2:
            return "insufficient_data"
        first_avg = sum(values[:window]) / window
        last_avg = sum(values[-window:]) / window
        if first_avg == 0:
            return "improving" if last_avg > 0 else "stable"
        change = (last_avg - first_avg) / first_avg
        if change > 0.2:
            return "improving"
        elif change < -0.2:
            return "declining"
        return "stable"

    @staticmethod
    def _count_followup_improvements(word_counts: list[int]) -> int:
        """짧은 답변(≤3) 직후 단어 수가 증가한 횟수."""
        count = 0
        for i in range(len(word_counts) - 1):
            if word_counts[i] <= 3 and word_counts[i + 1] > word_counts[i]:
                count += 1
        return count

    @staticmethod
    def _determine_completion_status(session: ConversationSession) -> str:
        status_val = (
            session.status.value
            if hasattr(session.status, "value")
            else str(session.status)
        )
        if status_val == "completed":
            if session.error_message and "timed out" in session.error_message.lower():
                return "timeout"
            return "completed"
        elif status_val == "error":
            return "error"
        return "user_exit"

    # ──────────────────────────────────────────────
    # DB Queries
    # ──────────────────────────────────────────────

    async def _get_existing(self, session_id: UUID) -> Optional[SessionObservation]:
        result = await self.db.execute(
            select(SessionObservation)
            .where(SessionObservation.session_id == session_id)
        )
        return result.scalar_one_or_none()

    async def _get_session(self, session_id: UUID) -> Optional[ConversationSession]:
        result = await self.db.execute(
            select(ConversationSession)
            .where(ConversationSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def _get_turns(self, session_id: UUID) -> list[ConversationTurn]:
        result = await self.db.execute(
            select(ConversationTurn)
            .where(ConversationTurn.session_id == session_id)
            .order_by(ConversationTurn.turn_index)
        )
        return list(result.scalars().all())

    async def _get_pipeline_logs(self, session_id: UUID) -> list[PipelineLog]:
        result = await self.db.execute(
            select(PipelineLog)
            .where(PipelineLog.session_id == session_id)
            .order_by(PipelineLog.turn_index)
        )
        return list(result.scalars().all())

    async def _get_session_metrics(
        self, session_id: UUID,
    ) -> Optional[SessionMetrics]:
        result = await self.db.execute(
            select(SessionMetrics)
            .where(SessionMetrics.session_id == session_id)
        )
        return result.scalar_one_or_none()
```

---

## Task 1-5: 세션 종료 시 자동 트리거 연결

### 수정 파일: `apps/server/app/services/conversation/my_turn_service.py`

**추가할 import** (파일 상단):
```python
from app.services.conversation.observation_service import ObservationService
```

**4곳의 COMPLETED 설정 중 관찰 데이터를 생성할 위치**:

| 위치 | 설명 | 관찰 데이터 생성 | 이유 |
|------|------|:---:|------|
| ~122행 | 유저 타임아웃 | ✅ | 부분 데이터라도 기록 가치 있음 |
| ~169행 | Stale 세션 정리 | ❌ | 배치 정리 — 데이터 불완전 |
| ~197행 | 서버 재시작 정리 | ❌ | bulk update — 개별 세션 접근 불가 |
| ~479행 | 정상 완료 | ✅ | **핵심 트리거** |

**정상 완료 (~479행) 수정**:

현재:
```python
# Session Complete
logger.info(f"[MyTurnService] Session {session_id} completed (no next turn).")
session.status = SessionStatus.COMPLETED
await self.db.commit()
await manager.send_message(str(session.id), {"type": "session_completed"})
```

변경:
```python
# Session Complete
logger.info(f"[MyTurnService] Session {session_id} completed (no next turn).")
session.status = SessionStatus.COMPLETED
session.ended_at = datetime.utcnow()
await self.db.commit()

# 관찰 데이터 자동 생성
try:
    obs_service = ObservationService(self.db)
    await obs_service.generate_observation(session.id)
    await self.db.commit()
    logger.info(f"[MyTurnService] Observation generated for session {session_id}")
except Exception as e:
    logger.error(f"[MyTurnService] Observation generation failed for {session_id}: {e}")

await manager.send_message(str(session.id), {"type": "session_completed"})
```

**유저 타임아웃 (~122행) 수정**:

`session.status = SessionStatus.COMPLETED` 직후, `await db.commit()` 직후에:
```python
# 관찰 데이터 자동 생성
try:
    obs_service = ObservationService(db)
    await obs_service.generate_observation(session.id)
    await db.commit()
except Exception as e:
    logger.error(f"[monitor_user_timeout] Observation failed for {session_id}: {e}")
```

> [!WARNING] db 변수명 주의
> 정상 완료에서는 `self.db`, 타임아웃 핸들러에서는 `db` (별도 세션)를 사용합니다.
> 각 위치의 db 변수명을 확인하고 맞춰서 사용하세요.

---

## Task 1-6: API 엔드포인트 추가

### 수정 파일: `apps/server/app/api/v1/conversations.py`

**추가할 import**:
```python
from app.services.conversation.observation_service import ObservationService
from app.schemas.observation import SessionObservationResponse, ObservationLayer1, ObservationLayer2, ObservationLayer3
```

**추가할 엔드포인트** (파일 하단):

```python
# ── Session Observation ──

@router.get(
    "/sessions/{session_id}/observation",
    response_model=SessionObservationResponse,
)
async def get_session_observation(
    session_id: UUID,
    db: DbSession,
):
    """세션 관찰 데이터 조회."""
    service = ObservationService(db)
    obs = await service.get_observation(session_id)
    if not obs:
        raise HTTPException(
            status_code=404,
            detail="Observation not found. Session may not be completed yet.",
        )
    return _build_observation_response(obs)


@router.post(
    "/sessions/{session_id}/observation/generate",
    response_model=SessionObservationResponse,
)
async def generate_session_observation(
    session_id: UUID,
    db: DbSession,
):
    """관찰 데이터 수동 생성/재생성 (Layer 1+2)."""
    service = ObservationService(db)
    obs = await service.generate_observation(session_id)
    await db.commit()
    return _build_observation_response(obs)


def _build_observation_response(obs) -> dict:
    """SessionObservation ORM → API 응답 변환."""
    has_layer3 = obs.learning_behavior_summary is not None
    return {
        "id": obs.id,
        "session_id": obs.session_id,
        "account_id": obs.account_id,
        "layer1": ObservationLayer1(
            session_duration_sec=obs.session_duration_sec,
            total_user_turns=obs.total_user_turns or 0,
            total_ai_turns=obs.total_ai_turns or 0,
            avg_user_utterance_length=obs.avg_user_utterance_length,
            max_user_utterance_length=obs.max_user_utterance_length,
            min_user_utterance_length=obs.min_user_utterance_length,
            utterance_length_trend=obs.utterance_length_trend,
            avg_user_response_interval_sec=obs.avg_user_response_interval_sec,
            short_reply_count=obs.short_reply_count or 0,
            silence_timeout_count=obs.silence_timeout_count or 0,
            first_user_response_time_sec=obs.first_user_response_time_sec,
            completion_status=obs.completion_status,
            word_count_per_turn=obs.word_count_per_turn,
            long_latency_turn_count=obs.long_latency_turn_count or 0,
            long_latency_turn_ratio=obs.long_latency_turn_ratio,
            long_gap_count=obs.long_gap_count or 0,
            followup_after_short_answer=obs.followup_after_short_answer or 0,
        ),
        "layer2": ObservationLayer2(
            avg_overall_score=obs.avg_overall_score,
            score_trend=obs.score_trend,
            level_progression=obs.level_progression,
            max_level_reached=obs.max_level_reached,
            level_up_count=obs.level_up_count or 0,
            level_down_count=obs.level_down_count or 0,
            primary_issues=obs.primary_issues,
            correction_count=obs.correction_count or 0,
            fluency_wpm_trend=obs.fluency_wpm_trend,
            template_specific_data=obs.template_specific_data,
        ),
        "layer3": ObservationLayer3(
            learning_behavior_summary=obs.learning_behavior_summary,
            engagement_level=obs.engagement_level,
            key_learning_points=obs.key_learning_points,
            struggle_points=obs.struggle_points,
            communication_style=obs.communication_style,
            topic_maintenance_score=obs.topic_maintenance_score,
            question_back_count=obs.question_back_count,
            natural_conversation_score=obs.natural_conversation_score,
            improvement_suggestions=obs.improvement_suggestions,
            elaboration_adequacy=obs.elaboration_adequacy,
            explicit_clarification_analysis=obs.explicit_clarification_analysis,
            response_start_quality=obs.response_start_quality,
            response_start_quality_detail=obs.response_start_quality_detail,
            flow_maintenance=obs.flow_maintenance,
            flow_maintenance_detail=obs.flow_maintenance_detail,
            coping_attempt=obs.coping_attempt,
            clarification_success=obs.clarification_success,
            avoidance_vs_response=obs.avoidance_vs_response,
        ),
        "generated_at": obs.generated_at,
        "reporting_llm_model": obs.reporting_llm_model,
        "reporting_llm_duration_ms": obs.reporting_llm_duration_ms,
        "has_layer3": has_layer3,
    }
```

---

## Task 1-7: 오디오 업로드 API에 타이밍 파라미터 추가

### 수정 파일: `apps/server/app/api/v1/conversations.py`

**process_my_turn_audio 엔드포인트** 시그니처 수정:

```python
@router.post("/sessions/{session_id}/audio")
async def process_my_turn_audio(
    db: DbSession,
    session_id: UUID,
    background_tasks: BackgroundTasks,
    audio_file: UploadFile = File(..., description="Audio file"),
    t0_user_end: float = Form(0.0),
    t_recording_start: float = Form(0.0),      # ← 추가
    t_first_speech: float = Form(0.0),          # ← 추가
):
```

그리고 `service.process_user_turn()` 호출에 새 파라미터 전달:

```python
return await service.process_user_turn(
    session_id, audio_data, audio_format, background_tasks,
    t0_user_end, t_recording_start, t_first_speech,    # ← 추가
)
```

### 수정 파일: `apps/server/app/services/conversation/my_turn_service.py`

**process_user_turn 메서드** 시그니처 수정:

현재 시그니처를 찾아서 `t_recording_start`와 `t_first_speech` 파라미터를 추가하세요.

```python
async def process_user_turn(
    self,
    session_id: UUID,
    audio_data: bytes,
    audio_format: str,
    background_tasks: BackgroundTasks,
    t0_user_end: float = 0.0,
    t_recording_start: float = 0.0,      # ← 추가
    t_first_speech: float = 0.0,          # ← 추가
) -> dict:
```

그리고 이 메서드 내에서 `ConversationTurn`을 생성하는 부분을 찾아서:

```python
# 턴 생성 시 타이밍 필드 추가
turn.t_recording_start = t_recording_start if t_recording_start > 0 else None
turn.t_first_speech = t_first_speech if t_first_speech > 0 else None
```

> [!TIP] 검색 힌트
> `my_turn_service.py`에서 `t0_user_end`가 턴에 저장되는 위치를 찾으면 바로 옆에 추가하면 됩니다.
> `t0_user_end`로 검색하세요.

---

## Task 1-8: 세션 생성 시 account_id 저장

### 수정 파일: `apps/server/app/services/conversation/session_service.py`

세션 생성 코드(~224행)에서 `account_id`를 저장하도록 수정합니다.

**방법 A** — SessionCreate 스키마에 account_id 추가:

`apps/server/app/schemas/conversation.py`의 `SessionCreate`에:
```python
account_id: UUID | None = Field(None, description="Account ID of the session owner")
```

그리고 `session_service.py`의 세션 생성 코드에:
```python
session = ConversationSession(
    template_id=data.template_id,
    # ... 기존 필드들 ...
    account_id=data.account_id,   # ← 추가
)
```

**방법 B** — API에서 인증된 사용자의 account_id 자동 주입:

세션 생성 API에서 `CurrentAccount` 의존성을 사용하여 자동 주입:
```python
@router.post("/sessions")
async def create_session(data: SessionCreate, db: DbSession, account: CurrentAccount):
    # account.id를 session에 저장
```

> [!IMPORTANT] 구현자 판단 필요
> 현재 세션 생성 API가 인증을 요구하는지 확인하세요.
> - 인증 필수 → 방법 B (자동 주입)
> - 인증 선택적 → 방법 A (optional 파라미터)
> 두 방법 중 현재 시스템의 인증 구조에 맞는 것을 선택하세요.

---

## 검증 방법

### 1. 마이그레이션 확인

```bash
cd apps/server
poetry run alembic upgrade head
# 에러 없이 완료되어야 함

# DB에서 테이블 확인
poetry run python -c "
from sqlalchemy import inspect, create_engine
engine = create_engine('postgresql://postgres:postgres@localhost:5432/studyenglish')
inspector = inspect(engine)
print('session_observations' in inspector.get_table_names())
# True여야 함

cols = [c['name'] for c in inspector.get_columns('conversation_sessions')]
print('account_id' in cols)
# True여야 함

cols = [c['name'] for c in inspector.get_columns('conversation_turns')]
print('t_recording_start' in cols and 't_first_speech' in cols)
# True여야 함
"
```

### 2. API 테스트

```bash
# 서버 시작
cd apps/server && poetry run uvicorn app.main:app --reload

# 기존 완료된 세션 ID로 수동 생성 테스트
curl -X POST http://localhost:8000/api/v1/conversations/sessions/{session_id}/observation/generate | python -m json.tool

# 조회 테스트
curl http://localhost:8000/api/v1/conversations/sessions/{session_id}/observation | python -m json.tool

# 응답에서 확인할 것:
# - layer1 필드들이 계산되어 있는지 (total_user_turns > 0 등)
# - layer2 필드들은 null (Phase 2에서 구현)
# - layer3 필드들은 null (Phase 3에서 구현)
# - has_layer3 = false
```

### 3. Swagger UI 확인

`http://localhost:8000/docs`에서:
- `GET /api/v1/conversations/sessions/{session_id}/observation` 엔드포인트 존재 확인
- `POST /api/v1/conversations/sessions/{session_id}/observation/generate` 엔드포인트 존재 확인
- `POST /api/v1/conversations/sessions/{session_id}/audio`의 파라미터에 `t_recording_start`, `t_first_speech` 추가 확인

---

## 완료 체크리스트

- [ ] `session_observations` 테이블이 DB에 존재
- [ ] `conversation_sessions.account_id` 컬럼 존재
- [ ] `conversation_turns.t_recording_start`, `t_first_speech` 컬럼 존재
- [ ] `SessionObservation` 모델이 `models/__init__.py`에 등록
- [ ] `ObservationService.generate_observation()` 동작 (기존 세션으로 테스트)
- [ ] `GET /observation` API 응답 정상
- [ ] `POST /observation/generate` API 응답 정상
- [ ] `POST /sessions/{id}/audio`에 `t_recording_start`, `t_first_speech` 파라미터 추가
- [ ] 새 세션 완료 시 관찰 데이터 자동 생성 (로그 확인)
- [ ] 기존 기능에 영향 없음 (My Turn 세션 정상 수행)
