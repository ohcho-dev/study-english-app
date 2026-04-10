"""Add session observation system.

Creates session_observations table and adds account_id to conversation_sessions,
t_recording_start / t_first_speech to conversation_turns.

Revision ID: r3s4t5u6v7w8
Revises: q2r3s4t5u6v7
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision = 'r3s4t5u6v7w8'
down_revision = 'q2r3s4t5u6v7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. session_observations 테이블 생성
    op.create_table(
        "session_observations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversation_sessions.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True,
        ),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        # ── Layer 1: Rule-based 메트릭 ──
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
        sa.Column(
            "word_count_per_turn",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("long_latency_turn_count", sa.Integer(), server_default="0"),
        sa.Column("long_latency_turn_ratio", sa.Float(), nullable=True),
        sa.Column("long_gap_count", sa.Integer(), server_default="0"),
        sa.Column("followup_after_short_answer", sa.Integer(), server_default="0"),
        sa.Column(
            "in_speech_pause_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        # ── Layer 2: Pipeline LLM 집계 ──
        sa.Column("avg_overall_score", sa.Float(), nullable=True),
        sa.Column("score_trend", sa.String(20), nullable=True),
        sa.Column(
            "level_progression",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("max_level_reached", sa.Integer(), nullable=True),
        sa.Column("level_up_count", sa.Integer(), server_default="0"),
        sa.Column("level_down_count", sa.Integer(), server_default="0"),
        sa.Column(
            "primary_issues",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("correction_count", sa.Integer(), server_default="0"),
        sa.Column(
            "fluency_wpm_trend",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "template_specific_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        # ── Layer 3: Reporting LLM 분석 ──
        sa.Column("learning_behavior_summary", sa.Text(), nullable=True),
        sa.Column("engagement_level", sa.String(20), nullable=True),
        sa.Column(
            "key_learning_points",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "struggle_points",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("communication_style", sa.String(20), nullable=True),
        sa.Column("topic_maintenance_score", sa.Float(), nullable=True),
        sa.Column("question_back_count", sa.Integer(), nullable=True),
        sa.Column("natural_conversation_score", sa.Float(), nullable=True),
        sa.Column(
            "improvement_suggestions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "elaboration_adequacy",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "explicit_clarification_analysis",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("response_start_quality", sa.String(20), nullable=True),
        sa.Column(
            "response_start_quality_detail",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("flow_maintenance", sa.String(20), nullable=True),
        sa.Column(
            "flow_maintenance_detail",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "coping_attempt",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "clarification_success",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "avoidance_vs_response",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        # ── Layer 4: 수동 태깅 ──
        sa.Column("observer_notes", sa.Text(), nullable=True),
        sa.Column("pronunciation_quality", sa.Integer(), nullable=True),
        sa.Column("confidence_level", sa.Integer(), nullable=True),
        sa.Column(
            "custom_tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        # ── 메타 ──
        sa.Column("generated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("reporting_llm_model", sa.String(100), nullable=True),
        sa.Column("reporting_llm_duration_ms", sa.Float(), nullable=True),
    )

    # 2. conversation_sessions.account_id 추가
    op.add_column(
        "conversation_sessions",
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_conversation_sessions_account_id",
        "conversation_sessions",
        ["account_id"],
    )

    # 3. conversation_turns 타이밍 필드 추가
    op.add_column(
        "conversation_turns",
        sa.Column("t_recording_start", sa.Float(), nullable=True),
    )
    op.add_column(
        "conversation_turns",
        sa.Column("t_first_speech", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("conversation_turns", "t_first_speech")
    op.drop_column("conversation_turns", "t_recording_start")
    op.drop_index(
        "ix_conversation_sessions_account_id", table_name="conversation_sessions"
    )
    op.drop_column("conversation_sessions", "account_id")
    op.drop_table("session_observations")
