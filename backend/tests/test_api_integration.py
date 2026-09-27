from app.models.timer import Timer


def _register(client, username: str = "jay", password: str = "password1"):
    response = client.post(
        "/api/auth/register",
        json={"username": username, "password": password, "confirm": True},
    )
    assert response.status_code == 201
    return response.json()


def _create_timer(client, name: str):
    response = client.post(
        "/api/timers",
        json={"name": name, "color": "#22C55E", "icon": "flask"},
    )
    assert response.status_code == 201
    return response.json()


def test_missing_session_rejected(client):
    response = client.get("/api/me")
    assert response.status_code == 401


def test_timer_flow_and_single_active_enforced(client):
    _register(client)
    timer_a = _create_timer(client, "BIO130")
    timer_b = _create_timer(client, "CHEM200")

    response = client.post(
        f"/api/timers/{timer_a['id']}/start",
        json={"client_tz": "UTC"},
    )
    assert response.status_code == 200
    assert response.json()["active_session"]["timer_id"] == timer_a["id"]

    response = client.post(
        f"/api/timers/{timer_b['id']}/start",
        json={"client_tz": "UTC"},
    )
    body = response.json()
    assert body["stopped_session"]["timer_id"] == timer_a["id"]
    assert body["active_session"]["timer_id"] == timer_b["id"]

    response = client.get("/api/active-session")
    assert response.json()["active_session"]["timer_id"] == timer_b["id"]

    response = client.post("/api/stop")
    assert response.json()["stopped_session"]["end_at"] is not None


def test_duplicate_timer_name_returns_conflict(client):
    _register(client)
    _create_timer(client, "BIO130")

    response = client.post(
        "/api/timers",
        json={"name": "BIO130", "color": "#22C55E", "icon": "flask"},
    )
    assert response.status_code == 409


def test_end_day_finalizes_totals(client):
    _register(client)
    timer = _create_timer(client, "BIO130")

    start_response = client.post(
        f"/api/timers/{timer['id']}/start",
        json={"client_tz": "UTC"},
    )
    assert start_response.status_code == 200
    day_date = start_response.json()["active_session"]["day_date"]
    client.post("/api/stop")

    response = client.post(
        "/api/end-day",
        json={"client_tz": "UTC", "day_date": day_date},
    )
    assert response.status_code == 200
    totals = response.json()["totals"]
    assert any(total["timer_id"] == timer["id"] for total in totals)


def test_end_day_stops_active_session(client):
    _register(client)
    timer = _create_timer(client, "BIO130")

    start_response = client.post(
        f"/api/timers/{timer['id']}/start",
        json={"client_tz": "UTC"},
    )
    assert start_response.status_code == 200
    day_date = start_response.json()["active_session"]["day_date"]

    response = client.post(
        "/api/end-day",
        json={"client_tz": "UTC", "day_date": day_date},
    )
    assert response.status_code == 200

    active_response = client.get("/api/active-session")
    assert active_response.json()["active_session"] is None


def test_accounts_cannot_access_each_others_data(client, db_session):
    _register(client, "alice")
    alice_timer = _create_timer(client, "Alice private timer")
    started = client.post(
        f"/api/timers/{alice_timer['id']}/start",
        json={"client_tz": "UTC"},
    )
    assert started.status_code == 200
    alice_day = started.json()["active_session"]["day_date"]
    assert client.post("/api/stop").status_code == 200
    assert client.post("/api/auth/logout", json={}).status_code == 204

    _register(client, "bob")
    assert client.get("/api/timers").json() == {"timers": []}
    assert client.get("/api/active-session").json() == {"active_session": None}
    assert client.get(
        f"/api/sessions?from={alice_day}&to={alice_day}"
    ).json() == {"sessions": []}
    assert client.get(f"/api/stats/day?day_date={alice_day}").json() == {
        "day_date": alice_day,
        "totals": [],
    }

    assert client.patch(
        f"/api/timers/{alice_timer['id']}", json={"name": "Stolen"}
    ).status_code == 404
    assert client.delete(f"/api/timers/{alice_timer['id']}").status_code == 404
    assert client.post(
        f"/api/timers/{alice_timer['id']}/start", json={"client_tz": "UTC"}
    ).status_code == 404

    db_session.expire_all()
    stored = db_session.get(Timer, alice_timer["id"])
    assert stored is not None
    assert stored.username == "alice"
    assert stored.name == "Alice private timer"
