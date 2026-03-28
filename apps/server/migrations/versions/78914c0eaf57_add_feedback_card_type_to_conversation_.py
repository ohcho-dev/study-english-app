"""add feedback_card_type to conversation_templates

Revision ID: 78914c0eaf57
Revises: 478ef1d3c946
Create Date: 2026-03-28 17:59:44.972338

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '78914c0eaf57'
down_revision: Union[str, None] = '478ef1d3c946'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('conversation_templates', sa.Column('feedback_card_type', sa.String(length=30), server_default='default', nullable=False))


def downgrade() -> None:
    op.drop_column('conversation_templates', 'feedback_card_type')
