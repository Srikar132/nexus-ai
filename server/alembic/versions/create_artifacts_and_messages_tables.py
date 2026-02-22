"""Create artifacts and messages tables

Revision ID: def456abc789
Revises: abc123def456
Create Date: 2026-02-22 00:10:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'def456abc789'
down_revision: Union[str, Sequence[str], None] = 'add_github_token_encrypted'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create artifacts table
    op.create_table(
        'artifacts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('artifact_type', sa.Text(), nullable=False),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('content', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'")),
        sa.Column('file_storage_url', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            """
            artifact_type IN (
                'plan',
                'deployment'
            )
            """,
            name='check_artifact_type'
        ),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_artifacts_project_id', 'artifacts', ['project_id'])
    op.create_index('idx_artifacts_type', 'artifacts', ['artifact_type'])

    # Create messages table
    op.create_table(
        'messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.Text(), nullable=False),
        sa.Column('message_type', sa.Text(), nullable=False),
        sa.Column('content', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'")),
        sa.Column('artifact_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            "role IN ('user', 'conductor', 'system')",
            name='check_message_role'
        ),
        sa.CheckConstraint(
            """
            message_type IN (
                'user_prompt',
                'plan_approval',
                'conductor_text',
                'conductor_plan',
                'system_event'
            )
            """,
            name='check_message_type'
        ),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_messages_project_id_created', 'messages', ['project_id', sa.text('created_at DESC')])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_messages_project_id_created', table_name='messages')
    op.drop_table('messages')
    op.drop_index('idx_artifacts_type', table_name='artifacts')
    op.drop_index('idx_artifacts_project_id', table_name='artifacts')
    op.drop_table('artifacts')
