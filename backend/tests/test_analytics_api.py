from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session

from app.auth import get_current_username
from app.db import get_db
from app.main import app
from app.models.day_summary import DaySummary
from app.models.session import Session as SessionModel
from app.models.timer import Timer
from app.models.user import User
from app.models.base import Base
from app.services.analytics import aggregate_records, fetch_records, validated_window
from app.services.analytics_time import build_window


def row(start, end, recorded):
    return {"start_at": datetime.fromisoformat(start).replace(tzinfo=timezone.utc),
            "end_at": datetime.fromisoformat(end).replace(tzinfo=timezone.utc),
            "duration_seconds": recorded}


def test_aggregate_distinguishes_unique_sessions_touching_days_and_active_days():
    data = aggregate_records([
        row("2026-01-01T23:30", "2026-01-02T00:30", 7200),
        row("2026-01-03T12:00", "2026-01-03T13:00", None),
    ], build_window(date(2026, 1, 1), date(2026, 1, 4), "UTC"), date(2026, 2, 1))
    assert data["summary"] == {"recorded_seconds": 7200, "timed_seconds": 7200,
                               "session_count": 2, "active_days": 2, "day_count": 4,
                               "consistency_percent": 50.0, "average_seconds_per_day": 1800.0}
    assert data["daily"] == [
        {"day_date": date(2026, 1, 1), "recorded_seconds": 3600, "timed_seconds": 1800, "session_count": 1},
        {"day_date": date(2026, 1, 2), "recorded_seconds": 3600, "timed_seconds": 1800, "session_count": 1},
        {"day_date": date(2026, 1, 3), "recorded_seconds": 0, "timed_seconds": 3600, "session_count": 1},
        {"day_date": date(2026, 1, 4), "recorded_seconds": 0, "timed_seconds": 0, "session_count": 0},
    ]
    assert data["comparison"] is None
    assert [item["hour"] for item in data["hourly"]] == list(range(24))


@pytest.mark.parametrize("prior,current,percent", [(100, 150, 50.0), (0, 150, None), (0, 0, None), (100, 0, -100.0)])
def test_comparison_uses_latest_two_wholly_selected_elapsed_weeks(prior, current, percent):
    data = aggregate_records([
        row("2026-01-05T12:00", "2026-01-05T12:01", prior),
        row("2026-01-12T12:00", "2026-01-12T12:01", current),
        row("2026-01-19T12:00", "2026-01-19T12:01", 999),
    ], build_window(date(2026, 1, 4), date(2026, 1, 25), "UTC"), date(2026, 1, 25))
    assert data["comparison"] == {"previous_week_start": date(2026, 1, 5), "current_week_start": date(2026, 1, 12),
                                  "previous_seconds": prior, "current_seconds": current,
                                  "delta_seconds": current - prior, "delta_percent": percent}
    assert [(week["week_start"], week["is_partial"]) for week in data["weekly"]] == [
        (date(2025, 12, 29), True), (date(2026, 1, 5), False),
        (date(2026, 1, 12), False), (date(2026, 1, 19), True),
    ]


class EmptyDB:
    def execute(self, statement):
        return self

    def mappings(self):
        return self

    def all(self):
        return []

    def scalar(self, statement):
        return None


@pytest.fixture
def analytics_client():
    def identity(request: Request):
        request.state.username = "alice"
        return "alice"

    app.dependency_overrides[get_current_username] = identity
    app.dependency_overrides[get_db] = lambda: EmptyDB()
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("suffix", ["", "/sessions"])
def test_empty_analytics_contract_and_365_day_range(analytics_client, suffix):
    result = analytics_client.get(f"/api/stats/analytics{suffix}?from=2025-01-01&to=2025-12-31&client_tz=UTC")
    assert result.status_code == 200
    if suffix:
        assert result.json() == {"sessions": []}
    else:
        body = result.json()
        assert body["range"] == {"from": "2025-01-01", "to": "2025-12-31", "client_tz": "UTC"}
        assert body["summary"]["day_count"] == len(body["daily"]) == 365
        assert len(body["hourly"]) == 24
        assert body["summary"]["recorded_seconds"] == 0


@pytest.mark.parametrize("params,status", [
    ("from=2026-01-02&to=2026-01-01&client_tz=UTC", 400),
    ("from=2025-01-01&to=2026-01-01&client_tz=UTC", 400),
    ("from=2026-01-01&to=2026-01-01&client_tz=Not/AZone", 400),
    ("from=2026-01-01&to=2026-01-01&client_tz=../UTC", 400),
    ("from=9999-01-01&to=9999-01-01&client_tz=UTC", 400),
    ("from=bad&to=2026-01-01&client_tz=UTC", 422),
    ("from=2026-01-01&to=2026-01-01&client_tz=UTC&timer_id=bad", 422),
])
@pytest.mark.parametrize("suffix", ["", "/sessions"])
def test_analytics_rejects_invalid_ranges(analytics_client, params, status, suffix):
    assert analytics_client.get(f"/api/stats/analytics{suffix}?{params}").status_code == status


@pytest.mark.parametrize("suffix", ["", "/sessions"])
def test_unknown_course_has_generic_404(analytics_client, suffix):
    response = analytics_client.get(f"/api/stats/analytics{suffix}?from=2026-01-01&to=2026-01-01&client_tz=UTC&timer_id={uuid4()}")
    assert response.status_code == 404
    assert response.json() == {"detail": "Timer not found"}


def test_analytics_requires_authentication():
    app.dependency_overrides[get_db] = lambda: EmptyDB()
    try:
        with TestClient(app) as client:
            for suffix in ("", "/sessions"):
                assert client.get(f"/api/stats/analytics{suffix}?from=2026-01-01&to=2026-01-01&client_tz=UTC").status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_future_validation_uses_requested_zone_calendar():
    now = datetime(2026, 1, 1, 16, tzinfo=timezone.utc)
    assert validated_window(date(2026, 1, 2), date(2026, 1, 2), "Asia/Tokyo", now=now).to_date == date(2026, 1, 2)
    with pytest.raises(HTTPException) as caught:
        validated_window(date(2026, 1, 2), date(2026, 1, 2), "America/Toronto", now=now)
    assert caught.value.status_code == 400


def test_90_day_range_is_inclusive(analytics_client):
    result = analytics_client.get("/api/stats/analytics?from=2026-01-01&to=2026-03-31&client_tz=UTC")
    assert result.status_code == 200
    assert result.json()["summary"]["day_count"] == 90


def seed_timer(db, username, name, archived=False):
    timer = Timer(username=username, name=name, color="#22C55E", icon="book", is_archived=archived,
                  cycle_total_seconds=999999)
    db.add(timer)
    db.flush()
    return timer


def seed_session(db, username, timer, start, end, duration):
    values = row(start, end, duration) if end else {"start_at": datetime.fromisoformat(start).replace(tzinfo=timezone.utc), "end_at": None, "duration_seconds": None}
    session = SessionModel(username=username, timer_id=timer.id, client_tz="UTC", day_date=date(1999, 1, 1), day_of_week=4, **values)
    db.add(session)
    return session


def test_real_overlap_query_excludes_active_foreign_and_outside_sessions():
    # This separate, disposable in-memory SQL database exercises the real query
    # even when the guarded PostgreSQL integration fixture cannot be provisioned.
    memory_engine = create_engine("sqlite://")

    @event.listens_for(memory_engine, "connect")
    def sqlite_functions(connection, record):
        connection.create_function("char_length", 1, len)

    Base.metadata.create_all(memory_engine)
    with memory_engine.begin() as connection:
        # SQLite ignores postgresql_where on the one-active-session index.
        connection.execute(text("DROP INDEX ux_sessions_one_active_per_user"))
    with Session(memory_engine) as db:
        db.add_all([User(username="alice"), User(username="bob")])
        db.flush()
        owned = seed_timer(db, "alice", "Archived", True)
        foreign = seed_timer(db, "bob", "Other")
        seed_session(db, "alice", owned, "2020-01-01T00:00", "2027-01-01T00:00", 123)
        seed_session(db, "alice", owned, "2026-01-02T00:00", "2026-01-02T00:00", 100)
        seed_session(db, "alice", owned, "2026-01-03T00:00", "2026-01-03T00:00", 999)
        seed_session(db, "alice", owned, "2026-01-01T12:00", "2026-01-02T00:00", 999)
        seed_session(db, "alice", owned, "2026-01-02T12:00", None, None)
        seed_session(db, "alice", foreign, "2026-01-02T12:00", "2026-01-02T13:00", 999)
        seed_session(db, "bob", owned, "2026-01-02T12:00", "2026-01-02T13:00", 999)
        owned_id, foreign_id = owned.id, foreign.id
        db.commit()
        statements = []

        @event.listens_for(memory_engine, "before_cursor_execute")
        def capture(connection, cursor, statement, parameters, context, many):
            statements.append(statement)

        window = build_window(date(2026, 1, 2), date(2026, 1, 2), "UTC")
        records = fetch_records(db, "alice", window)
        assert sorted(record["duration_seconds"] for record in records) == [100, 123]
        assert set(records[0]) == {"start_at", "end_at", "duration_seconds"}
        assert len(statements) == 1
        statements.clear()
        records = fetch_records(db, "alice", window, owned_id, details=True)
        assert len(records) == 2
        assert all(record["timer_id"] == owned_id for record in records)
        assert len(statements) == 2
        with pytest.raises(HTTPException) as caught:
            fetch_records(db, "alice", window, foreign_id)
        assert caught.value.status_code == 404
    memory_engine.dispose()


def test_database_overlap_ownership_archives_and_session_drilldown(client, db_session, engine):
    assert client.post("/api/auth/register", json={"username": "alice", "password": "password1", "confirm": True}).status_code == 201
    db_session.add(User(username="bob"))
    owned = seed_timer(db_session, "alice", "Archived", True)
    foreign = seed_timer(db_session, "bob", "Private")
    overnight = seed_session(db_session, "alice", owned, "2026-01-01T23:30", "2026-01-02T00:30", 7200)
    seed_session(db_session, "alice", owned, "2026-01-01T12:00", None, None)
    seed_session(db_session, "alice", owned, "2026-01-02T01:00", "2026-01-02T01:00", 100)
    seed_session(db_session, "alice", owned, "2026-01-02T02:00", "2026-01-02T03:00", 0)
    seed_session(db_session, "alice", owned, "2026-01-02T03:00", "2026-01-02T04:00", None)
    seed_session(db_session, "alice", owned, "2026-01-03T00:00", "2026-01-03T00:00", 999)
    seed_session(db_session, "bob", owned, "2026-01-02T12:00", "2026-01-02T13:00", 999)
    seed_session(db_session, "alice", foreign, "2026-01-02T12:00", "2026-01-02T13:00", 999)
    db_session.add(DaySummary(username="alice", timer_id=owned.id, day_date=date(2026, 1, 2), total_seconds=999999))
    db_session.add(DaySummary(username="alice", timer_id=owned.id, day_date=date(2026, 1, 1), total_seconds=999999))
    db_session.commit()
    statements = []

    def capture(connection, cursor, statement, parameters, context, many):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", capture)
    try:
        query = "from=2026-01-02&to=2026-01-02&client_tz=UTC"
        response = client.get(f"/api/stats/analytics?{query}")
        assert response.status_code == 200
        assert response.json()["summary"]["recorded_seconds"] == 3700
        assert response.json()["summary"]["timed_seconds"] == 9000
        assert response.json()["summary"]["session_count"] == 4
        assert response.json()["summary"]["active_days"] == 1
        assert response.json()["summary"]["consistency_percent"] == 100.0
        assert response.json()["daily"][0] == {"day_date": "2026-01-02", "recorded_seconds": 3700,
                                               "timed_seconds": 9000, "session_count": 4}
        # One authentication lookup and one bounded analytics session query.
        assert len(statements) == 2
        detail = client.get(f"/api/stats/analytics/sessions?{query}").json()["sessions"]
        assert len(detail) == 4
        assert sum(item["range_recorded_seconds"] for item in detail) == 3700
        assert sum(item["range_timed_seconds"] for item in detail) == 9000
        assert sum(item["timed_seconds"] for item in response.json()["hourly"]) == 9000
        assert next(item for item in detail if item["id"] == str(overnight.id))["day_date"] == "1999-01-01"
        assert client.get(f"/api/stats/analytics?{query}&timer_id={owned.id}").json()["summary"]["recorded_seconds"] == 3700
        for suffix in ("", "/sessions"):
            denied = client.get(f"/api/stats/analytics{suffix}?{query}&timer_id={foreign.id}")
            missing = client.get(f"/api/stats/analytics{suffix}?{query}&timer_id={uuid4()}")
            assert denied.status_code == missing.status_code == 404
            assert denied.json() == missing.json()
        assert client.post("/api/auth/logout", json={}).status_code == 204
        for suffix in ("", "/sessions"):
            assert client.get(f"/api/stats/analytics{suffix}?{query}").status_code == 401
    finally:
        event.remove(engine, "before_cursor_execute", capture)


def test_postgres_fractional_drilldown_conserves_recorded_and_elapsed_seconds(client, db_session):
    assert client.post("/api/auth/register", json={"username": "alice", "password": "password1", "confirm": True}).status_code == 201
    timer = seed_timer(db_session, "alice", "Fractions")
    seed_session(db_session, "alice", timer, "2026-01-01T23:59:59.500000", "2026-01-02T00:00:01", 5)
    db_session.commit()
    total = client.get("/api/stats/analytics?from=2026-01-01&to=2026-01-02&client_tz=UTC").json()
    assert total["summary"]["recorded_seconds"] == 5
    assert total["summary"]["timed_seconds"] == 1
    assert total["summary"]["session_count"] == 1
    assert [item["recorded_seconds"] for item in total["daily"]] == [1, 4]
    assert [item["timed_seconds"] for item in total["daily"]] == [0, 1]
    assert [item["session_count"] for item in total["daily"]] == [1, 1]
    parts = []
    for day in ("2026-01-01", "2026-01-02"):
        response = client.get(f"/api/stats/analytics/sessions?from={day}&to={day}&client_tz=UTC")
        assert response.status_code == 200
        session = response.json()["sessions"][0]
        assert session["duration_seconds"] == 5
        assert datetime.fromisoformat(session["start_at"]) == datetime(2026, 1, 1, 23, 59, 59, 500000, tzinfo=timezone.utc)
        parts.append(session)
    assert [item["range_recorded_seconds"] for item in parts] == [1, 4]
    assert [item["range_timed_seconds"] for item in parts] == [0, 1]


def test_postgres_midnight_rollback_filters_envelope_by_real_local_date(client, db_session):
    assert client.post("/api/auth/register", json={"username": "alice", "password": "password1", "confirm": True}).status_code == 201
    timer = seed_timer(db_session, "alice", "Midnight rollback")
    seed_session(db_session, "alice", timer, "1988-10-30T02:00", "1988-10-30T02:30", 1800)
    seed_session(db_session, "alice", timer, "1988-10-30T02:00", "1988-10-30T02:00", 100)
    seed_session(db_session, "alice", timer, "1988-10-30T01:30", "1988-10-30T01:31", 60)
    seed_session(db_session, "alice", timer, "1988-10-30T04:00", "1988-10-30T04:30", 1800)
    db_session.commit()
    for day, recorded, timed in [("1988-10-29", 1900, 1800), ("1988-10-30", 1860, 1860)]:
        query = f"from={day}&to={day}&client_tz=America/St_Johns"
        response = client.get(f"/api/stats/analytics?{query}")
        assert response.status_code == 200
        summary = response.json()["summary"]
        assert summary["recorded_seconds"] == recorded
        assert summary["timed_seconds"] == timed
        assert summary["session_count"] == 2
        detail = client.get(f"/api/stats/analytics/sessions?{query}")
        assert detail.status_code == 200
        sessions = detail.json()["sessions"]
        assert len(sessions) == 2
        assert sum(item["range_recorded_seconds"] for item in sessions) == recorded
        assert sum(item["range_timed_seconds"] for item in sessions) == timed
