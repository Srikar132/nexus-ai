"""Drop stale Guardian-era security columns from builds

Revision ID: d8b4e5f92a1c
Revises: c7a3f2d81e9b
Create Date: 2026-02-28 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8b4e5f92a1c'
down_revision: Union[str, Sequence[str], None] = 'c7a3f2d81e9b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop stale Guardian-era columns."""
    op.drop_column('builds', 'security_iteration')
    op.drop_column('builds', 'security_issues_found')


def downgrade() -> None:
    """Restore stale columns."""
    op.add_column('builds', sa.Column('security_iteration', sa.Integer(), nullable=True))
    op.add_column('builds', sa.Column('security_issues_found', sa.Integer(), nullable=True))
