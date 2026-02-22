"""Create projects and builds tables with auto-increment trigger

Revision ID: abc123def456
Revises: 065098012e99
Create Date: 2026-02-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'abc123def456'
down_revision: Union[str, Sequence[str], None] = '065098012e99'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    
    # Create projects table
    op.create_table(
        'projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('git_repo_url', sa.Text(), nullable=True),
        sa.Column('git_branch', sa.String(length=100), nullable=True),
        sa.Column('target_framework', sa.String(length=100), nullable=True),
        sa.Column('target_language', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('latest_deployed_url', sa.Text(), nullable=True),
        sa.Column('last_deployed_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('total_builds', sa.Integer(), nullable=True),
        sa.Column('successful_builds', sa.Integer(), nullable=True),
        sa.Column('failed_builds', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )
    
    # Create builds table
    op.create_table(
        'builds',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('build_number', sa.Integer(), nullable=False),
        sa.Column('status', sa.Text(), nullable=False),
        sa.Column('raw_plan', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('approved_plan', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('deploy_url', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('started_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('completed_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            """
            status IN (
                'planning',
                'approved',
                'building',
                'completed',
                'failed'
            )
            """,
            name='check_build_status'
        ),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'build_number', name='unique_project_build_number')
    )
    
    # Create index
    op.create_index('idx_builds_project_id', 'builds', ['project_id'])
    
    # Create the trigger function for auto-incrementing build_number
    op.execute("""
        CREATE OR REPLACE FUNCTION set_build_number()
        RETURNS TRIGGER AS $$
        BEGIN
          SELECT COALESCE(MAX(build_number), 0) + 1
            INTO NEW.build_number
            FROM builds
           WHERE project_id = NEW.project_id;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create the trigger
    op.execute("""
        CREATE TRIGGER trg_set_build_number
          BEFORE INSERT ON builds
          FOR EACH ROW
          EXECUTE FUNCTION set_build_number();
    """)


def downgrade() -> None:
    """Downgrade schema."""
    
    # Drop trigger first
    op.execute("DROP TRIGGER IF EXISTS trg_set_build_number ON builds")
    
    # Drop function
    op.execute("DROP FUNCTION IF EXISTS set_build_number()")
    
    # Drop index
    op.drop_index('idx_builds_project_id', table_name='builds')
    
    # Drop tables
    op.drop_table('builds')
    op.drop_table('projects')
