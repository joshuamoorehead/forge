"""add run_environments table and data_version_hash to runs

Revision ID: a3f7c8e21b94
Revises: d231c196b5a2
Create Date: 2026-04-08 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a3f7c8e21b94'
down_revision: Union[str, Sequence[str], None] = 'd231c196b5a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add run_environments table and data_version_hash column to runs."""
    op.create_table(
        'run_environments',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('run_id', sa.UUID(), nullable=False),
        sa.Column('git_sha', sa.String(length=40), nullable=True),
        sa.Column('git_branch', sa.String(length=100), nullable=True),
        sa.Column('git_dirty', sa.Boolean(), nullable=True, default=False),
        sa.Column('python_version', sa.String(length=20), nullable=True),
        sa.Column('package_versions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('docker_image_tag', sa.String(length=255), nullable=True),
        sa.Column('random_seed', sa.Integer(), nullable=True),
        sa.Column('env_hash', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['run_id'], ['runs.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('run_id'),
    )

    op.add_column('runs', sa.Column('data_version_hash', sa.String(length=64), nullable=True))


def downgrade() -> None:
    """Remove run_environments table and data_version_hash column."""
    op.drop_column('runs', 'data_version_hash')
    op.drop_table('run_environments')
