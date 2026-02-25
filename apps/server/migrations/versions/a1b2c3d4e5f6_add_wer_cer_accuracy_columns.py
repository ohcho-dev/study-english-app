"""Add WER/CER accuracy columns to conversation_turns.

Revision ID: a1b2c3d4e5f6
Revises: 566311b9a291
Create Date: 2026-02-25 07:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '566311b9a291'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add accuracy columns to conversation_turns and session_metrics."""
    op.add_column('conversation_turns', sa.Column('reference_text', sa.Text(), nullable=True))
    op.add_column('conversation_turns', sa.Column('wer', sa.Float(), nullable=True))
    op.add_column('conversation_turns', sa.Column('cer', sa.Float(), nullable=True))
    op.add_column('session_metrics', sa.Column('avg_wer', sa.Float(), nullable=True))
    op.add_column('session_metrics', sa.Column('avg_cer', sa.Float(), nullable=True))


def downgrade() -> None:
    """Remove accuracy columns."""
    op.drop_column('session_metrics', 'avg_cer')
    op.drop_column('session_metrics', 'avg_wer')
    op.drop_column('conversation_turns', 'cer')
    op.drop_column('conversation_turns', 'wer')
    op.drop_column('conversation_turns', 'reference_text')
