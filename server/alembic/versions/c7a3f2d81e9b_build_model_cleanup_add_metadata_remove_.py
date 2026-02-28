"""Build model cleanup: add metadata, remove raw_plan, fix default status

Revision ID: c7a3f2d81e9b
Revises: bf9af9f94147
Create Date: 2026-02-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c7a3f2d81e9b'
down_revision: Union[str, Sequence[str], None] = 'bf9af9f94147'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add metadata JSONB column to builds
    op.add_column('builds', sa.Column('metadata', postgresql.JSONB(), nullable=True))

    # Remove stale raw_plan column (no longer used — planning/approval removed)
    op.drop_column('builds', 'raw_plan')

    # Fix default status: was 'planning', now 'building' (no approval flow)
    op.alter_column('builds', 'status',
                    server_default='building',
                    existing_type=sa.String())

    # Update any rows stuck in stale statuses
    op.execute("""
        UPDATE builds
        SET status = 'failed'
        WHERE status IN ('planning', 'waiting_approval', 'approved')
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('builds', sa.Column('raw_plan', postgresql.JSONB(), nullable=True))
    op.drop_column('builds', 'metadata')
    op.alter_column('builds', 'status',
                    server_default='planning',
                    existing_type=sa.String())
