"""Add reporting_prompt_settings table.

Revision ID: s4t5u6v7w8x9
Revises: r3s4t5u6v7w8
Create Date: 2026-04-10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "s4t5u6v7w8x9"
down_revision: str | None = "r3s4t5u6v7w8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reporting_prompt_settings",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, server_default="기본 프롬프트"),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("llm_model", sa.String(100), nullable=False, server_default="gemini-2.5-pro"),
        sa.Column("temperature", sa.String(10), nullable=False, server_default="0.3"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_reporting_prompt_settings_is_active",
        "reporting_prompt_settings",
        ["is_active"],
    )


def downgrade() -> None:
    op.drop_index("ix_reporting_prompt_settings_is_active", table_name="reporting_prompt_settings")
    op.drop_table("reporting_prompt_settings")
