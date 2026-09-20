import hashlib

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import get_db
from app.main import app
from app.settings import Settings
from app.settings import normalize_database_url
from conftest import _get_test_database_url

KEY = "test-only-personal-access-key"


@pytest.fixture
def personal(monkeypatch):
    settings = Settings(_env_file=None, auth_mode="personal", owner_username="jayy",
                        personal_access_key_sha256=hashlib.sha256(KEY.encode()).hexdigest())
    monkeypatch.setattr("app.auth.get_settings", lambda: settings)


@pytest.mark.parametrize("headers,status", [({}, 401), ({"Authorization": "Basic wrong"}, 401),
    ({"Authorization": "Bearer wrong"}, 401),
    ({"Authorization": f"Bearer {KEY}", "X-Username": "attacker"}, 403)])
def test_rejected_access_never_opens_database(personal, headers, status):
    def forbidden_database():
        raise AssertionError("Authentication must run before opening a database session")
    app.dependency_overrides[get_db] = forbidden_database
    try:
        with TestClient(app) as client:
            response = client.get("/api/me", headers=headers)
        assert response.status_code == status
        assert response.headers["cache-control"] == "no-store"
    finally:
        app.dependency_overrides.clear()


def test_personal_owner_and_cross_request_persistence(personal, client):
    headers = {"Authorization": f"Bearer {KEY}"}
    assert client.get("/api/me", headers=headers).json()["username"] == "jayy"
    timer = client.post("/api/timers", headers=headers,
                        json={"name": "Persistence", "color": "#22C55E", "icon": "flask"}).json()
    assert client.post(f"/api/timers/{timer['id']}/start", headers=headers,
                       json={"client_tz": "UTC"}).status_code == 200
    assert client.get("/api/active-session", headers=headers).json()["active_session"]["timer_id"] == timer["id"]


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


def test_production_requires_tls_and_exact_https_origin():
    good = dict(_env_file=None, app_env="prod", auth_mode="personal", owner_username="jayy",
                personal_access_key_sha256="a" * 64, database_url="postgres://user:p%40ss@db.neon.tech/db?sslmode=require",
                cors_origins="https://focusarc.onrender.com")
    Settings(**good).validate_production()
    for change in ({"database_url": "postgresql://user:pass@db.neon.tech/db"},
                   {"cors_origins": "https://*.onrender.com"}, {"auth_mode": "local"}):
        with pytest.raises(ValueError):
            Settings(**(good | change)).validate_production()


def test_url_normalization_preserves_credentials():
    assert normalize_database_url("postgres://user:p%40ss%25@db.neon.tech/db?sslmode=require") == "postgresql+psycopg://user:p%40ss%25@db.neon.tech/db?sslmode=require"


@pytest.mark.parametrize("url", ["postgresql://jayy:secret@localhost/focusarc",
    "postgresql://focusarc_test:secret@production.neon.tech/focusarc_test",
    "postgresql://focusarc_test:secret@localhost/focusarc_migration_rehearsal"])
def test_destructive_guard_refuses_personal_databases(monkeypatch, url):
    monkeypatch.setenv("TEST_DATABASE_URL", url)
    with pytest.raises(RuntimeError, match="Refusing destructive tests"):
        _get_test_database_url()


def test_cors_allows_bearer_from_configured_origin_only():
    with TestClient(app) as client:
        headers = {"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET",
                   "Access-Control-Request-Headers": "authorization,content-type"}
        assert client.options("/api/me", headers=headers).status_code == 200
        headers["Origin"] = "https://untrusted.example"
        assert client.options("/api/me", headers=headers).status_code == 400


def test_readiness_is_protected_before_database(personal):
    def forbidden_database():
        raise AssertionError("Readiness must authenticate first")
    app.dependency_overrides[get_db] = forbidden_database
    try:
        with TestClient(app) as client:
            assert client.get("/api/ready").status_code == 401
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("method,path", [("GET", "/api/timers"), ("POST", "/api/timers"),
    ("GET", "/api/sessions"), ("GET", "/api/active-session"), ("POST", "/api/stop"),
    ("GET", "/api/stats/day"), ("GET", "/api/schedule/day"),
    ("POST", "/api/totals/reset"), ("POST", "/api/end-day")])
def test_private_route_groups_authenticate_before_database(personal, method, path):
    def forbidden_database():
        raise AssertionError("Private route opened database before authentication")
    app.dependency_overrides[get_db] = forbidden_database
    try:
        with TestClient(app) as client:
            assert client.request(method, path).status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_readiness_accepts_newer_readable_revision(personal, client, db_session):
    # db_session is guarded before any destructive statement, including this table.
    db_session.execute(text("DROP TABLE IF EXISTS alembic_version"))
    db_session.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
    db_session.execute(text("INSERT INTO alembic_version VALUES ('0003_additive_change')"))
    db_session.commit()
    try:
        response = client.get("/api/ready", headers={"Authorization": f"Bearer {KEY}"})
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "revision": "0003_additive_change"}
    finally:
        db_session.execute(text("DROP TABLE alembic_version"))
        db_session.commit()


def test_readiness_missing_schema_is_generic_503(personal, client, db_session, caplog):
    db_session.execute(text("DROP TABLE IF EXISTS alembic_version"))
    db_session.commit()
    response = client.get("/api/ready", headers={"Authorization": f"Bearer {KEY}"})
    assert response.status_code == 503
    assert response.json() == {"detail": "Database is not ready"}
    assert "ProgrammingError" in caplog.text
    assert "SELECT" not in caplog.text
