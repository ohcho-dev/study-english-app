"""Add energy_flow_enabled to conversation_templates.

Revision ID: q2r3s4t5u6v7
Revises: p1q2r3s4t5u6
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = 'q2r3s4t5u6v7'
down_revision = '78914c0eaf57'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'conversation_templates',
        sa.Column('energy_flow_enabled', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade() -> None:
    op.drop_column('conversation_templates', 'energy_flow_enabled')
