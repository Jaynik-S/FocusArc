from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from app.models.session import Session as SessionModel
from app.models.timer import Timer
from app.models.user import User
from app.services import sessions as sessions_service


def _freeze_time(monkeypatch, frozen: datetime) -> None:
    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            if tz is None:
                return frozen.replace(tzinfo=None)
            return frozen.astimezone(tz)

    monkeypatch.setattr(sessions_service, "datetime", FrozenDateTime)


def _create_user(db_session, username: str = "jay") -> User:
    user = User(username=username)
    db_session.add(user)
    db_session.commit()
    return user


def _create_timer(db_session, username: str, name: str) -> Timer:
    timer = Timer(
        username=username,
        name=name,
        color="#22C55E",
        icon="book",
    )
    db_session.add(timer)
    db_session.commit()
    db_session.refresh(timer)
    return timer


def test_start_stop_duration(db_session, monkeypatch):
    user = _create_user(db_session)
    timer = _create_timer(db_session, user.username, "BIO130")

    frozen = datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc)
    _freeze_time(monkeypatch, frozen)

    stopped, active = sessions_service.start_timer(
        db_session, user.username, timer.id, "UTC"
    )
    assert stopped is None
    assert active.start_at == frozen

    later = frozen + timedelta(seconds=125)
    _freeze_time(monkeypatch, later)

    stopped_session = sessions_service.stop_active_session(db_session, user.username)
    assert stopped_session is not None
    assert stopped_session.duration_seconds == 125


def test_starting_new_timer_stops_previous(db_session, monkeypatch):
    user = _create_user(db_session)
    timer_a = _create_timer(db_session, user.username, "BIO130")
    timer_b = _create_timer(db_session, user.username, "CHEM200")

    t1 = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    _freeze_time(monkeypatch, t1)
    stopped, active = sessions_service.start_timer(
        db_session, user.username, timer_a.id, "UTC"
    )
    assert stopped is None
    assert active.timer_id == timer_a.id

    t2 = t1 + timedelta(minutes=30)
    _freeze_time(monkeypatch, t2)
    stopped, active = sessions_service.start_timer(
        db_session, user.username, timer_b.id, "UTC"
    )

    assert stopped is not None
    assert stopped.timer_id == timer_a.id
    assert stopped.end_at == t2
    assert active.timer_id == timer_b.id
    assert active.end_at is None


def test_cross_day_stop_ends_at_previous_day_end(db_session):
    user = _create_user(db_session)
    timer = _create_timer(db_session, user.username, "BIO130")

    tz_name = "America/Toronto"
    start_at = datetime(2026, 1, 1, 23, 0, tzinfo=timezone.utc)
    session = SessionModel(
        username=user.username,
        timer_id=timer.id,
        start_at=start_at,
        end_at=None,
        duration_seconds=None,
        client_tz=tz_name,
        day_date=date(2026, 1, 1),
        day_of_week=date(2026, 1, 1).weekday(),
    )
    db_session.add(session)
    db_session.commit()

    stopped = sessions_service.stop_active_session_for_day(
        db_session,
        user.username,
        tz_name,
        date(2026, 1, 2),
    )

    expected_end = datetime.combine(
        date(2026, 1, 1),
        time(23, 59, 59, 999000),
        tzinfo=ZoneInfo(tz_name),
    ).astimezone(timezone.utc)

    assert stopped is not None
    assert stopped.end_at == expected_end
