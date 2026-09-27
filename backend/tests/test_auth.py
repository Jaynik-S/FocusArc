import pytest
from alembic import command
from alembic.config import Config
from pydantic import ValidationError
from sqlalchemy import text

from app.models.base import Base
from app.schemas.auth import RegisterRequest
from app.security import hash_password, normalize_username, verify_password


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
