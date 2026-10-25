"""Exercise the data repair using Alembic against an isolated PostgreSQL schema."""
import importlib.util
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text


def test_repair_preserves_ends_durations_and_reallocates_cached_days(engine):
    path = Path(__file__).parents[1] / "alembic/versions/0004_session_adjustments.py"
    spec = importlib.util.spec_from_file_location("adjustment_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    schema = f"adjustments_{uuid4().hex}"
    with engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
        connection.execute(text("CREATE TABLE timers (id uuid PRIMARY KEY, cycle_total_seconds integer)"))
        connection.execute(text("CREATE TABLE sessions (id uuid PRIMARY KEY, username text, timer_id uuid, start_at timestamptz, end_at timestamptz, duration_seconds integer, client_tz text, day_date date, day_of_week integer)"))
        connection.execute(text("CREATE TABLE day_summaries (id uuid PRIMARY KEY, username text, timer_id uuid, day_date date, total_seconds integer)"))
        timer_id = uuid4()
        connection.execute(text("INSERT INTO timers VALUES (:id, 2400)"), {"id": timer_id})
        connection.execute(text("""INSERT INTO sessions VALUES
            (:id, 'jay', :timer, '2026-01-02 00:05Z', '2026-01-02 00:35Z', 2400, 'UTC', '2026-01-02', 4),
            (:zero, 'jay', :timer, '2026-01-02 12:00Z', '2026-01-02 12:30Z', 0, 'UTC', '2026-01-02', 4),
            (:active, 'jay', :timer, '2026-01-02 13:00Z', NULL, NULL, 'UTC', '2026-01-02', 4)"""),
            {"id": uuid4(), "timer": timer_id, "zero": uuid4(), "active": uuid4()})
        for day, seconds in [("2026-01-01", 0), ("2026-01-02", 2400)]:
            connection.execute(text("INSERT INTO day_summaries VALUES (:id, 'jay', :timer, :day, :seconds)"),
                               {"id": uuid4(), "timer": timer_id, "day": day, "seconds": seconds})
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
        rows = connection.execute(text("SELECT * FROM sessions ORDER BY end_at NULLS LAST")).mappings().all()
        assert rows[0]["start_at"] == datetime(2026, 1, 1, 23, 55, tzinfo=timezone.utc)
        assert rows[0]["end_at"] == datetime(2026, 1, 2, 0, 35, tzinfo=timezone.utc)
        assert rows[0]["duration_seconds"] == 2400
        assert str(rows[0]["day_date"]) == "2026-01-01"
        assert rows[1]["start_at"] == rows[1]["end_at"]
        assert rows[2]["start_at"] == datetime(2026, 1, 2, 13, tzinfo=timezone.utc)
        assert connection.execute(text("SELECT cycle_total_seconds FROM timers")).scalar_one() == 2400
        assert list(connection.execute(text("SELECT total_seconds FROM day_summaries ORDER BY day_date")).scalars()) == [300, 2100]
        connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
