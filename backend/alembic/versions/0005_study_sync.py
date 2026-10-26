"""Version account study state and establish inactivity leases.

Revision ID: 0005_study_sync
Revises: 0004_session_adjustments
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_study_sync"
down_revision = "0004_session_adjustments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('study_revision', sa.BigInteger(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('study_timezone', sa.String(64), nullable=False, server_default='America/Toronto'))
    op.add_column('users', sa.Column('study_last_seen_at', sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE users SET study_last_seen_at = now() WHERE EXISTS (SELECT 1 FROM sessions WHERE sessions.username = users.username AND end_at IS NULL)")


def downgrade() -> None:
    op.drop_column('users', 'study_last_seen_at')
    op.drop_column('users', 'study_timezone')
    op.drop_column('users', 'study_revision')
