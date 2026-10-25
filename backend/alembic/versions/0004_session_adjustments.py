"""Repair adjusted intervals and track resets without changing recorded totals.

Revision ID: 0004_session_adjustments
Revises: 0003_add_password_hash
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_session_adjustments"
down_revision = "0003_add_password_hash"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("timers", sa.Column("cycle_reset_at", sa.DateTime(timezone=True), nullable=True))
    # Preserve recorded seconds and the end; historical offsets become real time.
    op.execute("""
        UPDATE sessions
        SET start_at = end_at - duration_seconds * INTERVAL '1 second',
            day_date = (timezone(client_tz, end_at - duration_seconds * INTERVAL '1 second'))::date,
            day_of_week = EXTRACT(ISODOW FROM timezone(client_tz, end_at - duration_seconds * INTERVAL '1 second'))::int - 1
        WHERE end_at IS NOT NULL AND duration_seconds IS NOT NULL
          AND duration_seconds <> FLOOR(EXTRACT(EPOCH FROM end_at - start_at))
    """)
    # Rebuild finalized caches by overlap in each session's saved time zone.
    op.execute("""
        UPDATE day_summaries AS summary
        SET total_seconds = COALESCE((
            SELECT SUM(
                FLOOR(EXTRACT(EPOCH FROM LEAST(session.end_at,
                    timezone(session.client_tz, (summary.day_date + 1)::timestamp)) - session.start_at))
                - FLOOR(EXTRACT(EPOCH FROM GREATEST(session.start_at,
                    timezone(session.client_tz, summary.day_date::timestamp)) - session.start_at))
            )
            FROM sessions AS session
            WHERE session.username = summary.username AND session.timer_id = summary.timer_id
              AND session.end_at IS NOT NULL
              AND session.start_at < timezone(session.client_tz, (summary.day_date + 1)::timestamp)
              AND session.end_at > timezone(session.client_tz, summary.day_date::timestamp)
        ), 0)
    """)


def downgrade() -> None:
    # Data repairs are intentionally retained; restoring old starts would corrupt intervals.
    op.drop_column("timers", "cycle_reset_at")
