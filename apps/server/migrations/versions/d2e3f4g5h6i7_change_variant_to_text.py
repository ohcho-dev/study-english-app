"""change variant to text

Revision ID: d2e3f4g5h6i7
Revises: c1d2e3f4a5b6
Create Date: 2026-02-09 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd2e3f4g5h6i7'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Change variant column from VARCHAR to TEXT to store larger JSON data
    op.alter_column('conversation_sessions', 'variant',
               existing_type=sa.VARCHAR(length=10),
               type_=sa.Text(),
               existing_nullable=True)


def downgrade() -> None:
    # Revert back to VARCHAR(10) - WARNING: Data might be truncated!
    op.alter_column('conversation_sessions', 'variant',
               existing_type=sa.Text(),
               type_=sa.VARCHAR(length=10),
               existing_nullable=True)
