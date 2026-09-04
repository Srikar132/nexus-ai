"""add missing raw_plan, security_iteration, security_issues_found columns to builds

Revision ID: 181838669d0d
Revises: bf9af9f94147
Create Date: 2026-09-04 19:29:52.133711

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '181838669d0d'
down_revision: Union[str, Sequence[str], None] = 'bf9af9f94147'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('builds', sa.Column('raw_plan', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('builds', sa.Column('security_iteration', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('builds', sa.Column('security_issues_found', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('builds', 'security_issues_found')
    op.drop_column('builds', 'security_iteration')
    op.drop_column('builds', 'raw_plan')
