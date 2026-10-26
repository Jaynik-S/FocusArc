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
    # Old versions kept only the counter. Infer its boundary from newest sessions;
    # future resets record their exact timestamp, including zero-duration sessions.
    op.execute("""
        WITH ordered AS (
            SELECT timer_id, end_at,
                SUM(COALESCE(duration_seconds, 0)) OVER (
                    PARTITION BY timer_id ORDER BY end_at DESC, id DESC
                    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                ) AS cumulative_seconds
            FROM sessions WHERE end_at IS NOT NULL
        )
        UPDATE timers AS timer
        SET cycle_reset_at = (
            SELECT MAX(end_at) FROM ordered
            WHERE timer_id = timer.id
              AND cumulative_seconds > timer.cycle_total_seconds
        )
    """)
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
        INSERT INTO day_summaries (id, username, day_date, timer_id, total_seconds)
        SELECT gen_random_uuid(), days.username, days.day_date, session.timer_id, 0
        FROM (SELECT DISTINCT username, day_date FROM day_summaries) AS days
        JOIN sessions AS session ON session.username = days.username
          AND session.end_at IS NOT NULL
          AND session.start_at < timezone(session.client_tz, (days.day_date + 1)::timestamp)
          AND session.end_at >= timezone(session.client_tz, days.day_date::timestamp)
        GROUP BY days.username, days.day_date, session.timer_id
        ON CONFLICT (username, day_date, timer_id) DO NOTHING
    """)
    op.execute("""
        UPDATE day_summaries AS summary
        SET total_seconds = COALESCE((
            SELECT SUM(
                FLOOR(COALESCE(session.duration_seconds, 0) * EXTRACT(EPOCH FROM LEAST(session.end_at,
                    timezone(session.client_tz, (summary.day_date + 1)::timestamp)) - session.start_at)
                    / NULLIF(EXTRACT(EPOCH FROM session.end_at - session.start_at), 0))
                - FLOOR(COALESCE(session.duration_seconds, 0) * EXTRACT(EPOCH FROM GREATEST(session.start_at,
                    timezone(session.client_tz, summary.day_date::timestamp)) - session.start_at)
                    / NULLIF(EXTRACT(EPOCH FROM session.end_at - session.start_at), 0))
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
