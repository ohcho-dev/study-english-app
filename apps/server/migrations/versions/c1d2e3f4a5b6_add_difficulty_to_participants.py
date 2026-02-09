"""add difficulty to participants

Revision ID: c1d2e3f4a5b6
Revises: b1c2d3e4f5g6
Create Date: 2026-02-10 03:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b1c2d3e4f5g6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add difficulty column to conversation_participants
    op.add_column(
        'conversation_participants',
        sa.Column('difficulty', sa.Integer(), nullable=True, server_default='1')
    )


def downgrade() -> None:
    # Remove difficulty column from conversation_participants
    op.drop_column('conversation_participants', 'difficulty')
