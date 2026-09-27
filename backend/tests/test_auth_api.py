from unittest.mock import patch

from app.models.user import User
from app.security import hash_password


def _credentials(username: str = "new-user", password: str = "password1") -> dict:
    return {"username": username, "password": password}


def _register(client, username: str = "new-user", password: str = "password1"):
    return client.post(
        "/api/auth/register",
        json={**_credentials(username, password), "confirm": True},
    )


def test_unknown_login_requires_explicit_registration_confirmation(client):
    login = client.post("/api/auth/login", json=_credentials())

    assert login.status_code == 404
    assert login.json()["detail"]["code"] == "username_not_registered"

    rejected = client.post(
        "/api/auth/register",
        json={**_credentials(), "confirm": False},
    )
    assert rejected.status_code == 422
    assert client.get("/api/auth/session").status_code == 401


def test_registration_signs_in_and_normalizes_username(client):
    response = _register(client, " New-User ")

    assert response.status_code == 201
    assert response.json() == {"username": "new-user"}
    assert "focusarc_session=" in response.headers["set-cookie"]
    assert "httponly" in response.headers["set-cookie"].lower()
    assert client.get("/api/auth/session").json() == {"username": "new-user"}


def test_logout_clears_authenticated_session(client):
    assert _register(client).status_code == 201

    response = client.post("/api/auth/logout", json={})

    assert response.status_code == 204
    assert client.get("/api/auth/session").status_code == 401


def test_wrong_password_does_not_register_or_replace_hash(client, db_session):
    original_hash = hash_password("password1")
    db_session.add(User(username="jayy", password_hash=original_hash))
    db_session.commit()

    response = client.post(
        "/api/auth/login", json=_credentials("jayy", "wrongpass")
    )

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "incorrect_password"
    db_session.expire_all()
    assert db_session.get(User, "jayy").password_hash == original_hash


def test_duplicate_and_reserved_usernames_are_never_claimed(client, db_session):
    db_session.add_all(
        [
            User(username="taken", password_hash=hash_password("password1")),
            User(username="jayy", password_hash=None),
        ]
    )
    db_session.commit()

    for username in ("taken", "jayy"):
        response = _register(client, username, "password2")
        assert response.status_code == 409
        assert response.json()["detail"]["code"] == "username_unavailable"


def test_reserved_username_requires_private_password_setup(client, db_session):
    db_session.add(User(username="jayy", password_hash=None))
    db_session.commit()

    response = client.post("/api/auth/login", json=_credentials("jayy"))

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "password_setup_required"


def test_tampered_cookie_and_x_username_are_rejected(client):
    client.cookies.set("focusarc_session", "forged")

    assert client.get("/api/auth/session").status_code == 401
    assert client.get("/api/me", headers={"X-Username": "jayy"}).status_code == 401


def test_login_rate_limit_returns_retry_after(client):
    for _ in range(8):
        response = client.post(
            "/api/auth/login", json=_credentials("target", "wrongpass")
        )
        assert response.status_code == 404

    denied = client.post(
        "/api/auth/login", json=_credentials("target", "wrongpass")
    )
    assert denied.status_code == 429
    assert int(denied.headers["Retry-After"]) > 0


def test_registration_rate_limit_returns_retry_after(client):
    for index in range(5):
        response = _register(client, f"student-{index}")
        assert response.status_code == 201

    denied = _register(client, "student-5")
    assert denied.status_code == 429
    assert int(denied.headers["Retry-After"]) > 0


def test_signed_session_expires(client):
    with patch("itsdangerous.timed.time.time", return_value=1_000):
        assert _register(client).status_code == 201
        assert client.get("/api/auth/session").status_code == 200

    with patch("itsdangerous.timed.time.time", return_value=605_801):
        assert client.get("/api/auth/session").status_code == 401
