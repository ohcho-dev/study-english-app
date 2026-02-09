"""fix browser length

Revision ID: e3f4g5h6i7j8
Revises: d2e3f4g5h6i7
Create Date: 2026-02-09 20:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e3f4g5h6i7j8'
down_revision = 'd2e3f4g5h6i7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Change browser column from VARCHAR(100) to TEXT to store long User-Agent strings
    op.alter_column('conversation_sessions', 'browser',
               existing_type=sa.VARCHAR(length=100),
               type_=sa.Text(),
               existing_nullable=True)


def downgrade() -> None:
    # Revert back to VARCHAR(100) - WARNING: Data might be truncated!
    op.alter_column('conversation_sessions', 'browser',
               existing_type=sa.Text(),
               type_=sa.VARCHAR(length=100),
               existing_nullable=True)
