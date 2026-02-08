"""add_benchmark_to_log_steps

Revision ID: 8a2b3c4d5e6f
Revises: 7506f53a5fa2
Create Date: 2026-02-08 14:02:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8a2b3c4d5e6f'
down_revision: Union[str, None] = '1a46ea9f8785'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add benchmark JSONB column to store benchmark metrics for each step
    op.add_column('ai_lab_experiment_log_steps', sa.Column('benchmark', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('ai_lab_experiment_log_steps', 'benchmark')
