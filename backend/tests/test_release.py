import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from app.db import get_db
from app.main import app, create_app
from app.models.user import User
from app.security import hash_password
from app.settings import Settings, normalize_database_url
from conftest import _get_test_database_url


def _login(client, username: str = "jayy", password: str = "password1"):
    response = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )
    assert response.status_code == 200
    return response


def _seed_user(db_session, username: str = "jayy", password: str = "password1"):
    db_session.add(User(username=username, password_hash=hash_password(password)))
    db_session.commit()


def _production_settings(**changes) -> Settings:
    values = dict(
        _env_file=None,
        app_env="prod",
        session_secret="s" * 32,
        database_url="postgres://user:p%40ss@db.neon.tech/db?sslmode=require",
        cors_origins="https://focusarc.onrender.com",
    )
    return Settings(**(values | changes))


def test_health_never_opens_database():
    def forbidden_database():
        raise AssertionError("Liveness must be database-free")

    app.dependency_overrides[get_db] = forbidden_database
    try:
        with TestClient(app) as client:
            assert client.get("/api/health").json() == {"status": "ok"}
    finally:
        app.dependency_overrides.clear()


def test_production_rejects_local_defaults():
    with pytest.raises(ValueError):
        Settings(_env_file=None, app_env="prod").validate_production()


def test_production_requires_explicit_strong_session_secret():
    common = dict(
        _env_file=None,
        app_env="prod",
        database_url="postgres://user:pass@db.neon.tech/db?sslmode=require",
        cors_origins="https://focusarc.onrender.com",
    )
    for session_secret in (None, "too-short"):
        values = common if session_secret is None else common | {"session_secret": session_secret}
        with pytest.raises(ValueError, match="SESSION_SECRET"):
            Settings(**values).validate_production()


def test_production_requires_tls_and_exact_https_origin():
    _production_settings().validate_production()
    for change in (
        {"database_url": "postgresql://user:pass@db.neon.tech/db"},
        {"cors_origins": "https://*.onrender.com"},
        {"cors_origins": "http://localhost:5173"},
    ):
        with pytest.raises(ValueError):
            _production_settings(**change).validate_production()


def test_url_normalization_preserves_credentials():
    assert (
        normalize_database_url(
            "postgres://user:p%40ss%25@db.neon.tech/db?sslmode=require"
        )
        == "postgresql+psycopg://user:p%40ss%25@db.neon.tech/db?sslmode=require"
    )


@pytest.mark.parametrize(
    "url",
    [
        "postgresql://jayy:secret@localhost/focusarc",
        "postgresql://focusarc_test:secret@production.neon.tech/focusarc_test",
        "postgresql://focusarc_test:secret@localhost/focusarc_migration_rehearsal",
    ],
)
def test_destructive_guard_refuses_personal_databases(monkeypatch, url):
    monkeypatch.setenv("TEST_DATABASE_URL", url)
    with pytest.raises(RuntimeError, match="Refusing destructive tests"):
        _get_test_database_url()


def test_cors_allows_credentials_from_configured_origin_only():
    with TestClient(app) as client:
        headers = {
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        }
        response = client.options("/api/auth/login", headers=headers)
        assert response.status_code == 200
        assert response.headers["access-control-allow-credentials"] == "true"

        headers["Origin"] = "https://untrusted.example"
        assert client.options("/api/auth/login", headers=headers).status_code == 400


def test_untrusted_browser_origin_cannot_mutate(client, db_session):
    response = client.post(
        "/api/auth/register",
        headers={"Origin": "https://untrusted.example"},
        json={"username": "attacker", "password": "password1", "confirm": True},
    )

    assert response.status_code == 403
    assert db_session.get(User, "attacker") is None


def test_readiness_requires_a_signed_session(client):
    assert client.get("/api/ready").status_code == 401


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/timers"),
        ("POST", "/api/timers"),
        ("GET", "/api/sessions"),
        ("GET", "/api/active-session"),
        ("POST", "/api/stop"),
        ("GET", "/api/stats/day"),
        ("GET", "/api/schedule/day"),
        ("POST", "/api/totals/reset"),
        ("POST", "/api/end-day"),
    ],
)
def test_private_route_groups_require_a_signed_session(client, method, path):
    assert client.request(method, path).status_code == 401


def test_readiness_accepts_newer_readable_revision(client, db_session):
    _seed_user(db_session)
    _login(client)
    db_session.execute(text("DROP TABLE IF EXISTS alembic_version"))
    db_session.execute(
        text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
    )
    db_session.execute(text("INSERT INTO alembic_version VALUES ('0004_additive_change')"))
    db_session.commit()
    try:
        response = client.get("/api/ready")
        assert response.status_code == 200
        assert response.json() == {
            "status": "ok",
            "revision": "0004_additive_change",
        }
    finally:
        db_session.execute(text("DROP TABLE alembic_version"))
        db_session.commit()


def test_readiness_missing_schema_is_generic_503(client, db_session, caplog):
    _seed_user(db_session)
    _login(client)
    db_session.execute(text("DROP TABLE IF EXISTS alembic_version"))
    db_session.commit()

    response = client.get("/api/ready")

    assert response.status_code == 503
    assert response.json() == {"detail": "Database is not ready"}
    assert "ProgrammingError" in caplog.text
    assert "SELECT" not in caplog.text


def test_production_cookie_is_secure_and_http_only(engine, db_session):
    production_app = create_app(_production_settings())
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = session_factory()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    production_app.dependency_overrides[get_db] = override_get_db
    _seed_user(db_session)
    with TestClient(production_app, base_url="https://api.example.test") as client:
        response = _login(client)

    cookie = response.headers["set-cookie"].lower()
    assert "secure" in cookie
    assert "httponly" in cookie
    assert "samesite=none" in cookie
