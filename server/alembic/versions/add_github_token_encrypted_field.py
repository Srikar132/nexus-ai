"""Add github_token_encrypted field to users table

Revision ID: add_github_token_encrypted
Revises: 065098012e99
Create Date: 2026-02-22 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_github_token_encrypted'
down_revision: Union[str, None] = 'abc123def456'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add github_token_encrypted column to users table
    op.add_column('users', sa.Column('github_token_encrypted', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove github_token_encrypted column from users table
    op.drop_column('users', 'github_token_encrypted')
