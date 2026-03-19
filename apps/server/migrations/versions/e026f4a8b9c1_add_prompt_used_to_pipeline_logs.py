"""add_prompt_used_to_pipeline_logs

Revision ID: e026f4a8b9c1
Revises: d015e93f2e07
Create Date: 2026-03-20 00:46:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e026f4a8b9c1'
down_revision: Union[str, None] = 'd015e93f2e07'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('pipeline_logs', sa.Column('prompt_used', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('pipeline_logs', 'prompt_used')
