"""add t1_5_llm_start and network_transit_avg_ms

Revision ID: h2i3j4k5l6m7
Revises: g1h2i3j4k5l6
Create Date: 2026-03-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h2i3j4k5l6m7'
down_revision: Union[str, None] = 'g1h2i3j4k5l6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('conversation_turns', sa.Column('t1_5_llm_start', sa.Float(), nullable=True))
    op.add_column('session_metrics', sa.Column('network_transit_avg_ms', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('session_metrics', 'network_transit_avg_ms')
    op.drop_column('conversation_turns', 't1_5_llm_start')
