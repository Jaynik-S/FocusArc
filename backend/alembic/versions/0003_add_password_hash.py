"""add password hash to users

Revision ID: 0003_add_password_hash
Revises: 0002_add_cycle_totals
Create Date: 2026-09-27 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "0003_add_password_hash"
down_revision = "0002_add_cycle_totals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "password_hash")
