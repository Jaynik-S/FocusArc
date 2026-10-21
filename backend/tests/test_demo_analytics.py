from datetime import date, timedelta

import pytest
from sqlalchemy import event

from app import demo_analytics
from app.demo_analytics import generate_demo_rows, seed_demo_account, validate_demo_target
from app.settings import Settings


@pytest.mark.parametrize("env,url,username", [
    ("prod", "postgresql://user:pass@localhost/demo", "focusarc_demo"),
    ("dev", "postgresql://user:pass@remote.example/demo", "focusarc_demo"),
    ("dev", "postgresql://user:pass@127.0.0.1.remote.example/demo", "focusarc_demo"),
    ("dev", "postgresql://user:pass@localhost/demo", "personal"),
])
def test_demo_guard_refuses_production_remote_or_personal_accounts(env, url, username):
    settings = Settings(_env_file=None, app_env=env, database_url=url)
    with pytest.raises(ValueError):
        validate_demo_target(settings, username)


def test_demo_guard_accepts_only_explicit_local_demo_target():
    settings = Settings(_env_file=None, app_env="dev", database_url="postgresql://user:pass@localhost/demo")
    validate_demo_target(settings, "focusarc_demo")


def test_demo_guard_also_accepts_the_requested_demo_username():
    settings = Settings(_env_file=None, app_env="dev", database_url="postgresql://user:pass@localhost/demo")
    validate_demo_target(settings, "demo")


def test_account_bootstrap_rejects_short_passwords_before_database_access():
    with pytest.raises(ValueError):
        demo_analytics.create_and_seed_demo_account(GuardDB([]), "demo", "123", date(2026, 10, 17))


def test_account_bootstrap_creates_hashed_credentials_and_history_atomically(db_session):
    from sqlalchemy import func, select
    from app.models.session import Session as StudySession
    from app.models.timer import Timer
    from app.models.user import User
    from app.security import verify_password

    timers, sessions = demo_analytics.create_and_seed_demo_account(
        db_session, "demo", "demo12345", date(2026, 10, 17)
    )
    assert timers == 4 and sessions > 500
    account = db_session.get(User, "demo")
    assert account.password_hash != "demo12345"
    assert verify_password(account.password_hash, "demo12345")
    assert db_session.scalar(select(func.count()).select_from(Timer)) == timers
    assert db_session.scalar(select(func.count()).select_from(StudySession)) == sessions
    with pytest.raises(ValueError, match="already exists"):
        demo_analytics.create_and_seed_demo_account(db_session, "demo", "different-password", date(2026, 10, 17))
    assert verify_password(account.password_hash, "demo12345")


def test_failed_seed_rolls_back_new_account(db_session, monkeypatch):
    from app.models.user import User

    def reject(*args):
        raise ValueError("fixture generation failed")

    monkeypatch.setattr(demo_analytics, "seed_demo_account", reject)
    with pytest.raises(ValueError, match="fixture generation failed"):
        with db_session.begin_nested():
            demo_analytics.create_and_seed_demo_account(db_session, "demo", "demo12345", date(2026, 10, 17))
    assert db_session.get(User, "demo") is None


@pytest.mark.parametrize("query", ["host=remote.example", "hostaddr=203.0.113.10", "service=remote",
                                   "host=localhost&host=remote.example", "port=5432&hostaddr=203.0.113.10"])
def test_demo_guard_rejects_connection_routing_query_overrides(query):
    settings = Settings(_env_file=None, app_env="dev", database_url=f"postgresql://user:pass@localhost/demo?{query}")
    with pytest.raises(ValueError):
        validate_demo_target(settings, "focusarc_demo")


def test_demo_guard_refuses_environment_service_indirection(monkeypatch):
    monkeypatch.setenv("PGSERVICE", "remote-service")
    settings = Settings(_env_file=None, app_env="dev", database_url="postgresql://user:pass@localhost/demo")
    with pytest.raises(ValueError):
        validate_demo_target(settings, "focusarc_demo")


@pytest.mark.parametrize("host,hostaddr", [("localhost", "127.0.0.1"), ("127.0.0.1", "127.0.0.1"), ("[::1]", "::1")])
def test_demo_connection_pins_loopback_address_before_any_network_call(monkeypatch, host, hostaddr):
    monkeypatch.setenv("PGHOSTADDR", "203.0.113.10")
    monkeypatch.delenv("PGSERVICE", raising=False)
    settings = Settings(_env_file=None, app_env="dev", database_url=f"postgresql://user:pass@{host}/demo")
    engine = demo_analytics.create_demo_engine(settings, "focusarc_demo")

    class InspectedConnection(Exception):
        pass

    @event.listens_for(engine, "do_connect")
    def inspect_before_connect(dialect, connection_record, args, kwargs):
        assert kwargs["hostaddr"] == hostaddr
        raise InspectedConnection

    with pytest.raises(InspectedConnection):
        engine.connect()
    engine.dispose()


def test_generated_demo_is_deterministic_and_contains_adjustments_overnights_and_dst():
    today = date(2026, 10, 16)
    timers, sessions = generate_demo_rows("focusarc_demo", today)
    other_timers, other_sessions = generate_demo_rows("focusarc_demo", today)
    assert [(timer.name, timer.is_archived, timer.id) for timer in timers] == [(timer.name, timer.is_archived, timer.id) for timer in other_timers]
    assert [(session.id, session.start_at, session.duration_seconds) for session in sessions] == [(session.id, session.start_at, session.duration_seconds) for session in other_sessions]
    assert len(timers) == 4
    assert sum(timer.is_archived for timer in timers) == 1
    assert all(today - timedelta(days=365) <= session.day_date < today for session in sessions)
    assert all(session.end_at is not None for session in sessions)
    assert any(session.duration_seconds != int((session.end_at - session.start_at).total_seconds()) for session in sessions)
    assert any(session.start_at == session.end_at and session.duration_seconds > 0 for session in sessions)
    assert any(session.day_date == date(2026, 3, 8) for session in sessions)
    assert any(session.day_date == date(2025, 11, 2) for session in sessions)
    assert not any(today - timedelta(days=365) <= session.day_date < today - timedelta(days=358) for session in sessions)


class GuardDB:
    """The external database is unavailable; all writes must remain unreachable."""
    def __init__(self, answers):
        self.answers = iter(answers)

    def scalar(self, statement):
        return next(self.answers)

    def add_all(self, rows):
        raise AssertionError("Guarded account must never receive writes")


@pytest.mark.parametrize("answers", [[None], [object(), object()], [object(), None, object()]])
def test_seed_refuses_missing_account_or_existing_timers_or_sessions_before_writing(answers):
    with pytest.raises(ValueError):
        seed_demo_account(GuardDB(answers), "focusarc_demo", date(2026, 10, 16))
