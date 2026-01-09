def _create_timer(client, headers, name: str):
    response = client.post(
        "/api/timers",
        json={"name": name, "color": "#22C55E", "icon": "flask"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_missing_username_rejected(client):
    response = client.get("/api/me")
    assert response.status_code == 400


def test_timer_flow_and_single_active_enforced(client):
    headers = {"X-Username": "jay"}
    timer_a = _create_timer(client, headers, "BIO130")
    timer_b = _create_timer(client, headers, "CHEM200")

    response = client.post(
        f"/api/timers/{timer_a['id']}/start",
        json={"client_tz": "UTC"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["active_session"]["timer_id"] == timer_a["id"]

    response = client.post(
        f"/api/timers/{timer_b['id']}/start",
        json={"client_tz": "UTC"},
        headers=headers,
    )
    body = response.json()
    assert body["stopped_session"]["timer_id"] == timer_a["id"]
    assert body["active_session"]["timer_id"] == timer_b["id"]

    response = client.get("/api/active-session", headers=headers)
    assert response.json()["active_session"]["timer_id"] == timer_b["id"]

    response = client.post("/api/stop", headers=headers)
    assert response.json()["stopped_session"]["end_at"] is not None


def test_duplicate_timer_name_returns_conflict(client):
    headers = {"X-Username": "jay"}
    _create_timer(client, headers, "BIO130")

    response = client.post(
        "/api/timers",
        json={"name": "BIO130", "color": "#22C55E", "icon": "flask"},
        headers=headers,
    )
    assert response.status_code == 409


def test_end_day_finalizes_totals(client):
    headers = {"X-Username": "jay"}
    timer = _create_timer(client, headers, "BIO130")

    start_response = client.post(
        f"/api/timers/{timer['id']}/start",
        json={"client_tz": "UTC"},
        headers=headers,
    )
    assert start_response.status_code == 200
    day_date = start_response.json()["active_session"]["day_date"]
    client.post("/api/stop", headers=headers)

    response = client.post(
        "/api/end-day",
        json={"client_tz": "UTC", "day_date": day_date},
        headers=headers,
    )
    assert response.status_code == 200
    totals = response.json()["totals"]
    assert any(total["timer_id"] == timer["id"] for total in totals)


def test_end_day_stops_active_session(client):
    headers = {"X-Username": "jay"}
    timer = _create_timer(client, headers, "BIO130")

    start_response = client.post(
        f"/api/timers/{timer['id']}/start",
        json={"client_tz": "UTC"},
        headers=headers,
    )
    assert start_response.status_code == 200
    day_date = start_response.json()["active_session"]["day_date"]

    response = client.post(
        "/api/end-day",
        json={"client_tz": "UTC", "day_date": day_date},
        headers=headers,
    )
    assert response.status_code == 200

    active_response = client.get("/api/active-session", headers=headers)
    assert active_response.json()["active_session"] is None
