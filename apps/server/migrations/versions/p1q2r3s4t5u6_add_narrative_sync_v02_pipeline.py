"""Add Narrative Sync v0.2 pipeline tables and columns.

Revision ID: p1q2r3s4t5u6
Revises: h2i3j4k5l6m7
Create Date: 2026-03-04

Changes:
- Add pipeline_logs table
- Add pipeline_mode, evaluator_prompt, planner_prompt, conductor_prompt to conversation_templates
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision = 'p1q2r3s4t5u6'
down_revision = 'h2i3j4k5l6m7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add pipeline tables and columns."""
    # 1. Create pipeline_logs table
    op.create_table(
        'pipeline_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('trace_id', sa.String(36), nullable=False, index=True),
        sa.Column(
            'session_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('conversation_sessions.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column('turn_index', sa.Integer(), nullable=False),
        sa.Column('module_name', sa.String(20), nullable=False),
        sa.Column('schema_version', sa.String(20), nullable=False, server_default='0.2.0'),
        sa.Column('input_json', postgresql.JSONB(), nullable=True),
        sa.Column('output_json', postgresql.JSONB(), nullable=True),
        sa.Column('duration_ms', sa.Float(), nullable=True),
        sa.Column('model_name', sa.String(100), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # 2. Add pipeline columns to conversation_templates
    op.add_column(
        'conversation_templates',
        sa.Column('pipeline_mode', sa.String(20), nullable=True, server_default='basic'),
    )
    op.add_column(
        'conversation_templates',
        sa.Column('evaluator_prompt', sa.Text(), nullable=True),
    )
    op.add_column(
        'conversation_templates',
        sa.Column('planner_prompt', sa.Text(), nullable=True),
    )
    op.add_column(
        'conversation_templates',
        sa.Column('conductor_prompt', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Remove pipeline tables and columns."""
    op.drop_column('conversation_templates', 'conductor_prompt')
    op.drop_column('conversation_templates', 'planner_prompt')
    op.drop_column('conversation_templates', 'evaluator_prompt')
    op.drop_column('conversation_templates', 'pipeline_mode')
    op.drop_table('pipeline_logs')

