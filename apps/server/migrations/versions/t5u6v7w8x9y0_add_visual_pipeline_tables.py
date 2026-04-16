"""Add visual pipeline tables.

Revision ID: t5u6v7w8x9y0
Revises: s4t5u6v7w8x9
Create Date: 2026-04-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "t5u6v7w8x9y0"
down_revision: str | None = "s4t5u6v7w8x9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "visual_pipelines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("graph_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("timeout_ms", sa.Integer(), nullable=False, server_default="15000"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "visual_pipeline_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "pipeline_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("visual_pipelines.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("graph_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("change_reason", sa.Text(), nullable=True),
        sa.Column("timeout_ms", sa.Integer(), nullable=False, server_default="15000"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_visual_pipeline_versions_pipeline_id_version",
        "visual_pipeline_versions",
        ["pipeline_id", "version"],
        unique=True,
    )

    op.create_table(
        "template_visual_pipeline_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "template_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversation_templates.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "pipeline_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("visual_pipelines.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("pipeline_version", sa.Integer(), nullable=True),
        sa.Column("overrides", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "pipeline_execution_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("trace_id", sa.String(length=36), nullable=False),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversation_sessions.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("pipeline_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pipeline_version", sa.Integer(), nullable=False),
        sa.Column("turn_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("node_id", sa.String(length=100), nullable=False),
        sa.Column("node_type", sa.String(length=50), nullable=False),
        sa.Column("node_label", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("input_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("output_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("duration_ms", sa.Float(), nullable=True),
        sa.Column("model_name", sa.String(length=100), nullable=True),
        sa.Column("prompt_used", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_pipeline_execution_logs_trace_id", "pipeline_execution_logs", ["trace_id"])
    op.create_index("ix_pipeline_execution_logs_session_id", "pipeline_execution_logs", ["session_id"])
    op.create_index("ix_pipeline_execution_logs_pipeline_id", "pipeline_execution_logs", ["pipeline_id"])


def downgrade() -> None:
    op.drop_index("ix_pipeline_execution_logs_pipeline_id", table_name="pipeline_execution_logs")
    op.drop_index("ix_pipeline_execution_logs_session_id", table_name="pipeline_execution_logs")
    op.drop_index("ix_pipeline_execution_logs_trace_id", table_name="pipeline_execution_logs")
    op.drop_table("pipeline_execution_logs")
    op.drop_table("template_visual_pipeline_links")
    op.drop_index(
        "ix_visual_pipeline_versions_pipeline_id_version",
        table_name="visual_pipeline_versions",
    )
    op.drop_table("visual_pipeline_versions")
    op.drop_table("visual_pipelines")
