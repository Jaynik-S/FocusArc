"""add cycle totals to timers

Revision ID: 0002_add_cycle_totals
Revises: 0001_init_schema
Create Date: 2026-01-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0002_add_cycle_totals"
down_revision = "0001_init_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "timers",
        sa.Column(
            "cycle_total_seconds",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("timers", "cycle_total_seconds")
