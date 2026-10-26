from study_helpers import study_post
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

import pytest
from sqlalchemy import select

from app.models.day_summary import DaySummary
from app.models.session import Session as StudySession
from app.models.timer import Timer
from app.services import sessions as service
from test_api_integration import _create_timer, _register
from test_sessions_unit import _freeze_time


def seed(client, db, *, start="2026-01-02T00:05:00+00:00", seconds=1800, zone="UTC"):
    _register(client)
    timer = _create_timer(client, "Algorithms")
    start_at = datetime.fromisoformat(start)
    session = StudySession(
        username="jay", timer_id=UUID(timer["id"]), start_at=start_at,
        end_at=start_at + timedelta(seconds=seconds), duration_seconds=seconds,
        client_tz=zone, day_date=start_at.date(), day_of_week=start_at.weekday(),
    )
    db.add(session)
    db.get(Timer, UUID(timer["id"])).cycle_total_seconds = seconds
    db.commit()
    return timer, session


def adjust(client, session, delta):
    return client.post(f"/api/sessions/{session['id']}/adjust", json={
        "delta_seconds": delta, "expected_start_at": session["start_at"],
        "expected_end_at": session["end_at"],
    })


def saved(client, day="2026-01-02"):
    previous = date.fromisoformat(day) - timedelta(days=1)
    return client.get(f"/api/sessions?from={previous}&to={day}").json()["sessions"][0]


def test_completed_adjustments_keep_end_accumulate_and_clamp(client, db_session):
    timer, model = seed(client, db_session)
    current = saved(client)
    fixed_end = current["end_at"]
    for delta, expected_start, seconds in [
        (600, "2026-01-01T23:55:00+00:00", 2400),
        (-300, "2026-01-02T00:00:00+00:00", 2100),
        (-3000, "2026-01-02T00:35:00+00:00", 0),
        (-300, "2026-01-02T00:35:00+00:00", 0),
        (600, "2026-01-02T00:25:00+00:00", 600),
    ]:
        response = adjust(client, current, delta)
        assert response.status_code == 200, response.text
        current = response.json()
        assert datetime.fromisoformat(current["start_at"]) == datetime.fromisoformat(expected_start)
        assert current["end_at"] == fixed_end
        assert current["duration_seconds"] == seconds
        assert saved(client)["duration_seconds"] == seconds
        totals = client.get("/api/timers").json()["timers"]
        assert totals[0]["cycle_total_seconds"] == seconds
    db_session.expire_all()
    assert db_session.get(StudySession, model.id).duration_seconds == 600


def test_adjustment_updates_schedule_daily_weekly_hourly_and_summaries(client, db_session):
    timer, model = seed(client, db_session)
    for day, seconds in [(date(2026, 1, 1), 0), (date(2026, 1, 2), 1800)]:
        db_session.add(DaySummary(username="jay", timer_id=model.timer_id, day_date=day, total_seconds=seconds))
    db_session.commit()
    assert adjust(client, saved(client), 600).status_code == 200
    for day, seconds in [("2026-01-01", 300), ("2026-01-02", 2100)]:
        assert client.get(f"/api/schedule/day?day_date={day}&client_tz=UTC").json()["sessions"][0]["id"] == str(model.id)
        assert client.get(f"/api/stats/day?day_date={day}").json()["totals"] == [{"timer_id": timer["id"], "total_seconds": seconds}]
    week = client.get("/api/schedule/week?week_start=2025-12-29&client_tz=UTC").json()["days"]
    assert [d["day_date"] for d in week if d["sessions"]] == ["2026-01-01", "2026-01-02"]
    stats = client.get("/api/stats/week?week_start=2025-12-29").json()["daily"]
    assert [d["totals"][0]["total_seconds"] for d in stats if d["totals"]] == [300, 2100]
    analytics = client.get("/api/stats/analytics?from=2026-01-01&to=2026-01-02&client_tz=UTC").json()
    assert analytics["summary"]["recorded_seconds"] == analytics["summary"]["timed_seconds"] == 2400
    assert analytics["summary"]["active_days"] == 2
    assert analytics["summary"]["average_seconds_per_day"] == 1200
    assert analytics["hourly"][23]["timed_seconds"] == 300
    assert analytics["hourly"][0]["timed_seconds"] == 2100
    db_session.expire_all()
    summaries = db_session.scalars(select(DaySummary).order_by(DaySummary.day_date)).all()
    assert [s.total_seconds for s in summaries] == [300, 2100]


def test_stale_or_foreign_adjustment_cannot_overwrite_session(client, db_session):
    _, model = seed(client, db_session)
    original = saved(client)
    assert adjust(client, original, 600).status_code == 200
    assert adjust(client, original, 600).status_code == 409
    assert saved(client)["duration_seconds"] == 2400
    client.post("/api/auth/logout", json={})
    _register(client, "bob")
    assert adjust(client, original, 600).status_code == 404
    assert client.get("/api/sessions?from=2026-01-01&to=2026-01-02").json()["sessions"] == []


@pytest.mark.parametrize("delta", [None, "600", 1.5, True, 1000000000])
def test_adjustment_validates_payload(client, db_session, delta):
    seed(client, db_session)
    assert adjust(client, saved(client), delta).status_code == 422


def test_active_adjustment_survives_recovery_switch_and_stop(client, db_session, monkeypatch):
    _register(client)
    timer = _create_timer(client, "Algorithms")
    second = _create_timer(client, "Physics")
    start = datetime(2026, 1, 2, 10, tzinfo=timezone.utc)
    _freeze_time(monkeypatch, start)
    current = study_post(client, f"/api/timers/{timer['id']}/start", json={"client_tz": "UTC"}).json()["active_session"]
    _freeze_time(monkeypatch, start + timedelta(minutes=2))
    response = adjust(client, current, -300)
    assert response.status_code == 200
    current = response.json()
    assert datetime.fromisoformat(current["start_at"]) == start + timedelta(minutes=2)
    assert current["end_at"] is None
    current = adjust(client, current, 600).json()
    assert client.post('/api/study-heartbeat', json={'active_session_id': current['id']}).status_code == 204
    recovered = client.get("/api/active-session").json()["active_session"]
    assert recovered["id"] == current["id"]
    assert datetime.fromisoformat(recovered["start_at"]) == datetime.fromisoformat(current["start_at"])
    _freeze_time(monkeypatch, start + timedelta(minutes=5))
    switched = study_post(client, f"/api/timers/{second['id']}/start", json={"client_tz": "UTC"}).json()
    assert switched["stopped_session"]["duration_seconds"] == 780
    assert datetime.fromisoformat(switched["stopped_session"]["end_at"]) == start + timedelta(minutes=5)
    _freeze_time(monkeypatch, start + timedelta(minutes=7))
    stopped = study_post(client, "/api/stop").json()["stopped_session"]
    assert stopped["duration_seconds"] == 120


@pytest.mark.parametrize("delta,seconds", [(600, 2400), (-300, 1500), (-3000, 0)])
def test_versioned_stop_adjustment_moves_start_not_end(client, db_session, monkeypatch, delta, seconds):
    _register(client)
    timer = _create_timer(client, "Algorithms")
    start = datetime(2026, 1, 2, 10, tzinfo=timezone.utc)
    _freeze_time(monkeypatch, start)
    active = study_post(client, f"/api/timers/{timer['id']}/start", json={"client_tz": "UTC"}).json()['active_session']
    for minute in range(4, 30, 4):
        _freeze_time(monkeypatch, start + timedelta(minutes=minute))
        assert client.post('/api/study-heartbeat', json={'active_session_id': active['id']}).status_code == 204
    end = start + timedelta(minutes=30)
    _freeze_time(monkeypatch, end)
    stopped = study_post(client, "/api/stop", json={"adjustment_seconds": delta, "stopped_at_client": start.isoformat()}).json()["stopped_session"]
    assert datetime.fromisoformat(stopped["end_at"]) == end
    assert datetime.fromisoformat(stopped["start_at"]) == end - timedelta(seconds=seconds)
    assert stopped["duration_seconds"] == seconds


def test_adjusting_before_reset_does_not_repopulate_cycle_total(client, db_session):
    seed(client, db_session)
    previous = saved(client)
    assert study_post(client, "/api/totals/reset").status_code == 200
    assert adjust(client, previous, 600).status_code == 200
    assert client.get("/api/timers").json()["timers"][0]["cycle_total_seconds"] == 0
    assert saved(client)["duration_seconds"] == 2400


def test_paused_timer_recovers_latest_session_after_refresh(client, db_session):
    timer, model = seed(client, db_session)
    response = client.get(f"/api/timers/{timer['id']}/latest-session")
    assert response.status_code == 200
    assert response.json()["id"] == str(model.id)
    client.post("/api/auth/logout", json={})
    _register(client, "bob")
    assert client.get(f"/api/timers/{timer['id']}/latest-session").status_code == 404


def test_adjustment_adds_course_to_already_finalized_previous_day(client, db_session):
    _, model = seed(client, db_session)
    other = _create_timer(client, "Physics")
    db_session.add(DaySummary(username="jay", timer_id=UUID(other["id"]), day_date=date(2026, 1, 1), total_seconds=0))
    db_session.commit()
    assert adjust(client, saved(client), 600).status_code == 200
    db_session.expire_all()
    summary = db_session.scalar(select(DaySummary).where(DaySummary.timer_id == model.timer_id, DaySummary.day_date == date(2026, 1, 1)))
    assert summary is not None
    assert summary.total_seconds == 300


def test_simultaneous_edits_apply_once_and_reject_stale_version(client, db_session, engine):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from sqlalchemy.orm import Session
    from app.schemas.session import AdjustSessionRequest

    _, model = seed(client, db_session)
    original = saved(client)
    data = AdjustSessionRequest(delta_seconds=600, expected_start_at=original["start_at"], expected_end_at=original["end_at"])
    session_id = model.id
    gate = Barrier(2)
    def edit():
        with Session(engine) as db:
            gate.wait(timeout=5)
            try:
                session = service.adjust_session(db, "jay", session_id, data)
                seconds = session.duration_seconds
                db.commit()
                return seconds
            except ValueError as exc:
                db.rollback()
                return str(exc)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: edit(), range(2)))
    assert sorted(results, key=str) == [2400, "session_changed"]
    assert saved(client)["duration_seconds"] == 2400
    assert client.get("/api/timers").json()["timers"][0]["cycle_total_seconds"] == 2400


def test_reports_use_display_timezone_for_adjusted_intervals(client, db_session):
    timer, _ = seed(client, db_session)
    assert adjust(client, saved(client), 600).status_code == 200
    expected = [{"timer_id": timer["id"], "total_seconds": 2400}]
    assert client.get("/api/stats/day?day_date=2026-01-01&client_tz=America/Toronto").json()["totals"] == expected
    week = client.get("/api/stats/week?week_start=2025-12-29&client_tz=America/Toronto").json()["daily"]
    assert [d["totals"] for d in week if d["totals"]] == [expected]
    assert client.get("/api/stats/day?day_date=2026-01-01&client_tz=Nope").status_code == 400


def test_legacy_zero_session_can_expand_after_data_migration(client, db_session, engine):
    import importlib.util
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import text

    seed(client, db_session, seconds=0)
    before = saved(client)
    # Rehearse the old schema only in the fixture's disposable focusarc_test DB.
    db_session.execute(text("ALTER TABLE timers DROP COLUMN cycle_reset_at"))
    db_session.commit()
    path = Path(__file__).parents[1] / "alembic/versions/0004_session_adjustments.py"
    spec = importlib.util.spec_from_file_location("adjustment_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
    response = adjust(client, before, 600)
    assert response.status_code == 200
    assert response.json()["duration_seconds"] == 600
    assert client.get("/api/timers").json()["timers"][0]["cycle_total_seconds"] == 600


@pytest.mark.parametrize("start,zone,want_hours", [
    ("2026-03-08T07:05:00+00:00", "America/Toronto", {1: 300, 3: 2100}),
    ("2026-11-01T06:05:00+00:00", "America/Toronto", {1: 2400}),
])
def test_adjustment_across_dst_allocates_real_seconds(client, db_session, start, zone, want_hours):
    _, model = seed(client, db_session, start=start, zone=zone)
    day = model.day_date.isoformat()
    response = adjust(client, saved(client, day), 600)
    assert response.status_code == 200
    # Call the service directly so future DST fixtures do not depend on today's date.
    from app.services.analytics import compute_analytics
    from app.services.analytics_time import build_window
    db_session.expire_all()
    data = compute_analytics(db_session, "jay", build_window(model.day_date, model.day_date, zone))
    assert data["summary"]["recorded_seconds"] == data["summary"]["timed_seconds"] == 2400
    assert {h["hour"]: h["timed_seconds"] for h in data["hourly"] if h["timed_seconds"]} == want_hours
