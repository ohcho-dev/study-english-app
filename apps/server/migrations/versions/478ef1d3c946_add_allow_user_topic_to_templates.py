"""add_allow_user_topic_to_templates

Revision ID: 478ef1d3c946
Revises: e026f4a8b9c1
Create Date: 2026-03-26 22:20:19.360029

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '478ef1d3c946'
down_revision: Union[str, None] = 'e026f4a8b9c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('conversation_templates', sa.Column('allow_user_topic', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('conversation_templates', 'allow_user_topic')
