"""add my turn fields

Revision ID: b1c2d3e4f5g6
Revises: a0312f81bbe8
Create Date: 2026-02-09 22:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5g6'
down_revision: Union[str, None] = '544a13f34780'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create FirstSpeaker enum type
    first_speaker_enum = sa.Enum(
        'moderator_first', 'ai_first', 'user_first',
        name='firstspeaker',
        create_type=False
    )
    first_speaker_enum.create(op.get_bind(), checkfirst=True)
    
    # Add columns to conversation_templates
    op.add_column(
        'conversation_templates',
        sa.Column(
            'first_speaker',
            sa.Enum('moderator_first', 'ai_first', 'user_first', name='firstspeaker'),
            nullable=False,
            server_default='moderator_first'
        )
    )
    op.add_column(
        'conversation_templates',
        sa.Column('scene_context', sa.Text(), nullable=True)
    )
    
    # Add columns to conversation_participants
    op.add_column(
        'conversation_participants',
        sa.Column('greeting_message', sa.Text(), nullable=True)
    )
    op.add_column(
        'conversation_participants',
        sa.Column('avatar_url', sa.String(500), nullable=True)
    )
    
    # Add columns to conversation_sessions
    op.add_column(
        'conversation_sessions',
        sa.Column('user_name', sa.String(100), nullable=True)
    )
    op.add_column(
        'conversation_sessions',
        sa.Column('current_speaker_type', sa.String(20), nullable=True)
    )


def downgrade() -> None:
    # Remove columns from conversation_sessions
    op.drop_column('conversation_sessions', 'current_speaker_type')
    op.drop_column('conversation_sessions', 'user_name')
    
    # Remove columns from conversation_participants
    op.drop_column('conversation_participants', 'avatar_url')
    op.drop_column('conversation_participants', 'greeting_message')
    
    # Remove columns from conversation_templates
    op.drop_column('conversation_templates', 'scene_context')
    op.drop_column('conversation_templates', 'first_speaker')
    
    # Drop the enum type
    sa.Enum(name='firstspeaker').drop(op.get_bind(), checkfirst=True)
