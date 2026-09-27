import pytest
from alembic import command
from alembic.config import Config
from pydantic import ValidationError
from sqlalchemy import text

from app.admin import main as admin_main
from app.models.base import Base
from app.models.user import User
from app.rate_limit import FixedWindowLimiter, RateLimitExceeded
from app.schemas.auth import RegisterRequest
from app.security import hash_password, normalize_username, verify_password
from app.services.accounts import (
    AccountError,
    authenticate,
    initialize_existing_password,
    register,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (" Jayy ", "jayy"),
        ("student-2", "student-2"),
    ],
)
def test_username_normalization(raw, expected):
    assert normalize_username(raw) == expected


@pytest.mark.parametrize("raw", ["", "two words", "bad/name", "x" * 33])
def test_invalid_usernames_are_rejected(raw):
    with pytest.raises(ValueError):
        normalize_username(raw)


def test_argon2_hash_is_not_plaintext_and_verifies():
    encoded = hash_password("correct horse")

    assert encoded != "correct horse"
    assert encoded.startswith("$argon2id$")
    assert verify_password(encoded, "correct horse") is True
    assert verify_password(encoded, "wrong horse") is False


def test_registration_requires_literal_confirmation():
    with pytest.raises(ValidationError):
        RegisterRequest(username="new-user", password="password1", confirm=False)


def test_password_migration_preserves_existing_user(engine):
    config = Config("alembic.ini")
    try:
        Base.metadata.drop_all(engine)
        with engine.begin() as connection:
            connection.execute(text("DROP TABLE IF EXISTS alembic_version"))

        command.upgrade(config, "0002_add_cycle_totals")
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO users (username) VALUES ('jayy')"))

        command.upgrade(config, "head")
        with engine.connect() as connection:
            row = connection.execute(
                text(
                    "SELECT username, password_hash FROM users WHERE username = 'jayy'"
                )
            ).one()

        assert row == ("jayy", None)
    finally:
        Base.metadata.drop_all(engine)
        with engine.begin() as connection:
            connection.execute(text("DROP TABLE IF EXISTS alembic_version"))


def test_register_hashes_password_and_authenticates(db_session):
    user = register(db_session, "new-user", "password1")

    assert user.password_hash != "password1"
    assert authenticate(db_session, "new-user", "password1").username == "new-user"


def test_wrong_password_never_changes_existing_hash(db_session):
    user = register(db_session, "new-user", "password1")
    original = user.password_hash

    with pytest.raises(AccountError, match="incorrect_password"):
        authenticate(db_session, "new-user", "wrongpass")

    db_session.refresh(user)
    assert user.password_hash == original


def test_existing_null_hash_cannot_register_or_login(db_session):
    db_session.add(User(username="jayy"))
    db_session.commit()

    with pytest.raises(AccountError, match="username_unavailable"):
        register(db_session, "jayy", "password1")
    with pytest.raises(AccountError, match="password_setup_required"):
        authenticate(db_session, "jayy", "password1")


def test_missing_username_is_distinct_from_wrong_password(db_session):
    with pytest.raises(AccountError, match="username_not_registered"):
        authenticate(db_session, "missing", "password1")


def test_initializer_sets_once_then_only_verifies(db_session):
    db_session.add(User(username="jayy"))
    db_session.commit()

    assert (
        initialize_existing_password(db_session, "jayy", "password1")
        == "initialized"
    )
    assert (
        initialize_existing_password(db_session, "jayy", "password1") == "verified"
    )
    with pytest.raises(AccountError, match="password_already_set"):
        initialize_existing_password(db_session, "jayy", "different1")


def test_initializer_requires_an_existing_user(db_session):
    with pytest.raises(AccountError, match="username_not_registered"):
        initialize_existing_password(db_session, "missing", "password1")


def test_rate_limiter_blocks_until_window_expires():
    now = [100.0]
    limiter = FixedWindowLimiter(clock=lambda: now[0], max_keys=10)
    limiter.check("login:user:jayy", limit=2, window_seconds=60)
    limiter.check("login:user:jayy", limit=2, window_seconds=60)

    with pytest.raises(RateLimitExceeded) as denied:
        limiter.check("login:user:jayy", limit=2, window_seconds=60)

    assert denied.value.retry_after == 60
    now[0] = 161.0
    limiter.check("login:user:jayy", limit=2, window_seconds=60)


def test_rate_limiter_clear_removes_only_one_key():
    limiter = FixedWindowLimiter(clock=lambda: 100.0, max_keys=10)
    limiter.check("login:user:jayy", limit=1, window_seconds=60)
    limiter.check("login:ip:127.0.0.1", limit=1, window_seconds=60)

    limiter.clear("login:user:jayy")
    limiter.check("login:user:jayy", limit=1, window_seconds=60)
    with pytest.raises(RateLimitExceeded):
        limiter.check("login:ip:127.0.0.1", limit=1, window_seconds=60)


def test_admin_initializes_existing_user_from_private_environment(
    db_session, engine, monkeypatch, capsys
):
    db_session.add(User(username="jayy"))
    db_session.commit()
    monkeypatch.setenv(
        "DATABASE_URL", engine.url.render_as_string(hide_password=False)
    )
    monkeypatch.setenv("FOCUSARC_INITIAL_PASSWORD", "password1")

    assert admin_main(["set-initial-password", "--username", "jayy"]) == 0

    db_session.expire_all()
    user = db_session.get(User, "jayy")
    assert user is not None
    assert user.password_hash is not None
    assert verify_password(user.password_hash, "password1")
    assert capsys.readouterr().out.strip() == "Password initialized for jayy"


def test_admin_never_overwrites_an_existing_password(
    db_session, engine, monkeypatch, capsys
):
    user = register(db_session, "jayy", "password1")
    original = user.password_hash
    monkeypatch.setenv(
        "DATABASE_URL", engine.url.render_as_string(hide_password=False)
    )
    monkeypatch.setenv("FOCUSARC_INITIAL_PASSWORD", "different1")

    assert admin_main(["set-initial-password", "--username", "jayy"]) == 1

    db_session.expire_all()
    assert db_session.get(User, "jayy").password_hash == original
    captured = capsys.readouterr()
    assert "different1" not in captured.out + captured.err
