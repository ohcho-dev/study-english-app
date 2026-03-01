"""add stt_mode and stt_streaming_display to participants

Revision ID: g1h2i3j4k5l6
Revises: 935ecdd34d62
Create Date: 2026-03-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g1h2i3j4k5l6'
down_revision: str = '935ecdd34d62'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'conversation_participants',
        sa.Column('stt_mode', sa.String(20), nullable=True, server_default='streaming'),
    )
    op.add_column(
        'conversation_participants',
        sa.Column('stt_streaming_display', sa.String(20), nullable=True, server_default='immediate'),
    )


def downgrade() -> None:
    op.drop_column('conversation_participants', 'stt_streaming_display')
    op.drop_column('conversation_participants', 'stt_mode')
