from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models.session import Session as StudySession
from app.models.user import User
from test_api_integration import _register, _create_timer


def snapshot(client):
    response = client.get('/api/study-state')
    assert response.status_code == 200
    return response.json()


def command(client, path, **payload):
    state = snapshot(client)
    return client.post(path, json={**payload, 'expected_revision': state['revision'],
        'expected_active_session_id': state['active_session']['id'] if state['active_session'] else None})


def test_snapshot_revision_unchanged_and_archive(client):
    _register(client)
    initial = snapshot(client)
    assert initial['revision'] == 0
    assert initial['study_timezone'] == 'America/Toronto'
    timer = _create_timer(client, 'Study')
    changed = snapshot(client)
    assert changed['revision'] == 1
    assert changed['timers'][0]['completed_today_seconds'] == 0
    unchanged = client.get('/api/study-state', params={'known_revision': 1, 'known_day': changed['day_date']}).json()
    assert unchanged['changed'] is False
    assert 'timers' not in unchanged and 'active_session' not in unchanged
    assert client.get('/api/study-state', params={'known_revision': 1, 'known_day': '2000-01-01'}).json()['changed'] is True
    client.patch(f"/api/timers/{timer['id']}", json={'name': 'Study'})
    assert snapshot(client)['revision'] == 1
    client.delete(f"/api/timers/{timer['id']}")
    assert snapshot(client)['timers'][0]['is_archived'] is True
    assert snapshot(client)['revision'] == 2
    client.delete(f"/api/timers/{timer['id']}")
    assert snapshot(client)['revision'] == 2


def test_snapshot_and_heartbeat_reuse_the_active_session_lookup(client, monkeypatch):
    from app.services import sessions, study_state

    _register(client)
    timer = _create_timer(client, 'Study')
    assert command(client, f"/api/timers/{timer['id']}/start", client_tz='UTC').status_code == 200
    state = snapshot(client)
    original = sessions.get_active_session
    calls = 0

    def counted(db, username):
        nonlocal calls
        calls += 1
        return original(db, username)

    monkeypatch.setattr(study_state.sessions, 'get_active_session', counted)
    unchanged = client.get('/api/study-state', params={
        'known_revision': state['revision'], 'known_day': state['day_date']})
    assert unchanged.status_code == 200
    assert unchanged.json()['changed'] is False
    assert calls == 1

    calls = 0
    heartbeat = client.post('/api/study-heartbeat', json={
        'active_session_id': state['active_session']['id']})
    assert heartbeat.status_code == 204
    assert calls == 1


def test_stale_commands_and_legacy_cannot_stop_new_session(client):
    _register(client)
    a = _create_timer(client, 'A')
    b = _create_timer(client, 'B')
    assert command(client, f"/api/timers/{a['id']}/start", client_tz='UTC').status_code == 200
    stale = snapshot(client)
    assert command(client, f"/api/timers/{b['id']}/start", client_tz='UTC').status_code == 200
    assert client.post('/api/stop', json={'expected_revision': stale['revision'],
        'expected_active_session_id': stale['active_session']['id']}).status_code == 409
    for path, payload in [('/api/stop', {}), ('/api/totals/reset', {}),
            (f"/api/timers/{a['id']}/start", {'client_tz': 'UTC'}),
            ('/api/end-day', {'client_tz': 'UTC', 'day_date': stale['day_date']})]:
        response = client.post(path, json=payload)
        assert response.status_code == 409
        assert response.json()['detail']['code'] == 'reload_required'
    assert snapshot(client)['active_session']['timer_id'] == b['id']


def test_stop_ignores_device_clock_and_changes_once(client):
    _register(client)
    timer = _create_timer(client, 'A')
    command(client, f"/api/timers/{timer['id']}/start", client_tz='UTC')
    before = snapshot(client)
    result = command(client, '/api/stop', stopped_at_client='2000-01-01T00:00:00Z')
    assert result.status_code == 200
    assert datetime.fromisoformat(result.json()['stopped_session']['end_at']) >= datetime.fromisoformat(before['server_now'])
    assert snapshot(client)['revision'] == 3
    command(client, '/api/stop')
    assert snapshot(client)['revision'] == 3


def test_heartbeat_expiry_stops_at_last_seen_without_revival(client, db_session):
    _register(client)
    timer = _create_timer(client, 'A')
    command(client, f"/api/timers/{timer['id']}/start", client_tz='UTC')
    state = snapshot(client)
    active_id = state['active_session']['id']
    assert client.post('/api/study-heartbeat', json={'active_session_id': active_id}).status_code == 204
    assert snapshot(client)['revision'] == 2
    active = db_session.scalar(select(StudySession).where(StudySession.username == 'jay'))
    last_seen = datetime.now(timezone.utc) - timedelta(minutes=6)
    active.start_at = last_seen - timedelta(seconds=120)
    db_session.get(User, 'jay').study_last_seen_at = last_seen
    db_session.commit()
    assert client.post('/api/study-heartbeat', json={'active_session_id': active_id}).status_code == 409
    expired = snapshot(client)
    assert expired['active_session'] is None and expired['lease_expires_at'] is None
    assert expired['revision'] == 3
    assert expired['timers'][0]['cycle_total_seconds'] == 120
    db_session.expire_all()
    assert db_session.get(StudySession, active.id).end_at == last_seen


def test_snapshot_is_account_scoped_and_reads_guard_revision(client):
    _register(client)
    _create_timer(client, 'Private')
    for path in ['/api/timers', '/api/sessions?from=2026-10-25&to=2026-10-25',
            '/api/schedule/day?day_date=2026-10-25', '/api/schedule/week?week_start=2026-10-25',
            '/api/stats/day?day_date=2026-10-25', '/api/stats/week?week_start=2026-10-25',
            '/api/stats/averages', '/api/stats/analytics?from=2026-10-25&to=2026-10-25&client_tz=UTC']:
        separator = '&' if '?' in path else '?'
        assert client.get(f'{path}{separator}expected_revision=0').status_code == 409
        assert client.get(f'{path}{separator}expected_revision=1').status_code == 200
    client.post('/api/auth/logout')
    _register(client, 'other')
    other = snapshot(client)
    assert other['revision'] == 0 and other['timers'] == [] and other['active_session'] is None


@pytest.mark.parametrize(('instant', 'hours'), [('2026-03-08T16:00:00+00:00', 23), ('2026-11-01T16:00:00+00:00', 25)])
def test_snapshot_day_bounds_follow_toronto_dst(client, monkeypatch, instant, hours):
    from app.services import sessions
    _register(client)
    frozen = datetime.fromisoformat(instant)
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return frozen
    monkeypatch.setattr(sessions, 'datetime', Clock)
    state = snapshot(client)
    assert (datetime.fromisoformat(state['day_end_at']) - datetime.fromisoformat(state['day_start_at'])).total_seconds() == hours * 3600


def test_revisions_cover_adjust_reset_endday_noops_and_rollback(client, monkeypatch):
    from test_sessions_unit import _freeze_time
    _register(client)
    a = _create_timer(client, 'A')
    b = _create_timer(client, 'B')
    instant = datetime(2026, 10, 25, 15, tzinfo=timezone.utc)
    _freeze_time(monkeypatch, instant)
    started = command(client, f"/api/timers/{a['id']}/start", client_tz='UTC').json()['active_session']
    assert snapshot(client)['revision'] == 3
    command(client, f"/api/timers/{a['id']}/start", client_tz='UTC')
    assert snapshot(client)['revision'] == 3
    payload = {'delta_seconds': 600, 'expected_start_at': started['start_at'], 'expected_end_at': None, 'expected_revision': 3}
    adjusted = client.post(f"/api/sessions/{started['id']}/adjust", json=payload)
    assert adjusted.status_code == 200
    assert snapshot(client)['revision'] == 4
    assert client.post(f"/api/sessions/{started['id']}/adjust", json=payload).status_code == 409
    assert snapshot(client)['revision'] == 4
    no_op = {**payload, 'delta_seconds': 0, 'expected_start_at': adjusted.json()['start_at'], 'expected_revision': 4}
    assert client.post(f"/api/sessions/{started['id']}/adjust", json=no_op).status_code == 200
    assert snapshot(client)['revision'] == 4
    assert client.patch(f"/api/timers/{b['id']}", json={'name': 'A'}).status_code == 409
    assert snapshot(client)['revision'] == 4
    command(client, '/api/totals/reset')
    state = snapshot(client)
    assert state['revision'] == 5
    assert state['active_session'] is None
    assert state['timers'][0]['cycle_total_seconds'] == 0
    assert state['timers'][0]['completed_today_seconds'] == 600
    command(client, '/api/totals/reset')
    assert snapshot(client)['revision'] == 5
    command(client, f"/api/timers/{a['id']}/start", client_tz='UTC')
    assert snapshot(client)['revision'] == 6
    command(client, '/api/end-day', client_tz='UTC', day_date='2026-10-25')
    assert snapshot(client)['revision'] == 7
    command(client, '/api/end-day', client_tz='UTC', day_date='2026-10-25')
    assert snapshot(client)['revision'] == 7


def test_one_awake_device_renews_other_device_session_and_adjust_does_not_renew(client, db_session, monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    from test_sessions_unit import _freeze_time
    _register(client)
    timer = _create_timer(client, 'A')
    initial = datetime(2026, 10, 25, 15, tzinfo=timezone.utc)
    _freeze_time(monkeypatch, initial)
    started = command(client, f"/api/timers/{timer['id']}/start", client_tz='UTC').json()['active_session']
    with TestClient(app) as observer:
        assert observer.post('/api/auth/login', json={'username': 'jay', 'password': 'password1'}).status_code == 200
        for minute in (4, 8, 12):
            _freeze_time(monkeypatch, initial + timedelta(minutes=minute))
            assert observer.post('/api/study-heartbeat', json={'active_session_id': started['id']}).status_code == 204
        state = snapshot(client)
        assert state['active_session']['id'] == started['id']
        assert state['revision'] == 2
        lease = state['lease_expires_at']
        assert client.post(f"/api/sessions/{started['id']}/adjust", json={
            'delta_seconds': 600, 'expected_start_at': started['start_at'], 'expected_end_at': None}).status_code == 200
        assert snapshot(client)['lease_expires_at'] == lease
        _freeze_time(monkeypatch, initial + timedelta(minutes=18))
        # A fresh process/request reconstructs expiry from persisted timestamps.
        expired = snapshot(observer)
        assert expired['active_session'] is None and expired['revision'] == 4
        assert expired['timers'][0]['cycle_total_seconds'] == 1320


def test_sweeper_skip_locked_and_expires_exactly_once(client, db_session, engine):
    from sqlalchemy.orm import Session
    from app.services.study_state import expire_stale_accounts
    _register(client)
    timer = _create_timer(client, 'A')
    command(client, f"/api/timers/{timer['id']}/start", client_tz='UTC')
    now = datetime.now(timezone.utc)
    db_session.get(User, 'jay').study_last_seen_at = now - timedelta(minutes=6)
    active = db_session.scalar(select(StudySession).where(StudySession.username == 'jay'))
    active.start_at = now - timedelta(minutes=8)
    db_session.commit()
    with Session(engine) as owner, Session(engine) as sweeper:
        owner.execute(select(User).where(User.username == 'jay').with_for_update())
        assert expire_stale_accounts(sweeper, now) == 0
        sweeper.commit()
        owner.rollback()
        assert expire_stale_accounts(sweeper, now) == 1
        sweeper.commit()
        assert expire_stale_accounts(sweeper, now) == 0
    assert snapshot(client)['revision'] == 3
    assert snapshot(client)['timers'][0]['cycle_total_seconds'] == 120


def test_competing_versioned_starts_only_one_succeeds(client, engine):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from uuid import UUID
    from fastapi import HTTPException
    from sqlalchemy.orm import Session
    from app.schemas.session import StartTimerRequest
    from app.services.sessions import start_timer
    from app.services.study_state import prepare_command
    _register(client)
    a = _create_timer(client, 'A')
    b = _create_timer(client, 'B')
    gate = Barrier(2)
    def start(timer):
        with Session(engine) as db:
            gate.wait(timeout=5)
            try:
                payload = StartTimerRequest(client_tz='UTC', expected_revision=2, expected_active_session_id=None)
                prepare_command(db, 'jay', payload)
                start_timer(db, 'jay', UUID(timer['id']), 'UTC')
                db.commit()
                return 200
            except HTTPException as exc:
                db.rollback()
                return exc.status_code
    with ThreadPoolExecutor(max_workers=2) as workers:
        assert sorted(workers.map(start, [a, b])) == [200, 409]
    assert snapshot(client)['revision'] == 3


def test_snapshot_blocks_stop_until_whole_snapshot_is_read(client, engine, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from sqlalchemy.orm import Session
    from app.services.study_state import get_study_state
    from app.services.sessions import stop_active_session
    from test_sessions_unit import _freeze_time
    _register(client)
    timer = _create_timer(client, 'A')
    _freeze_time(monkeypatch, datetime(2026, 10, 25, 15, tzinfo=timezone.utc))
    command(client, f"/api/timers/{timer['id']}/start", client_tz='UTC')
    entered = Event()
    def stop():
        with Session(engine) as db:
            entered.set()
            stop_active_session(db, 'jay', adjustment_seconds=600)
            db.commit()
    with ThreadPoolExecutor(max_workers=1) as worker:
        with Session(engine) as reader:
            before = get_study_state(reader, 'jay')
            future = worker.submit(stop)
            assert entered.wait(timeout=5)
            assert before['active_session'] is not None
            assert before['timers'][0]['cycle_total_seconds'] == 0
            assert not future.done()
            reader.commit()
        future.result(timeout=5)
    after = snapshot(client)
    assert after['active_session'] is None
    assert after['timers'][0]['cycle_total_seconds'] == 600


def test_midnight_changes_daily_snapshot_without_new_revision(client, db_session, monkeypatch):
    from uuid import UUID
    from test_sessions_unit import _freeze_time
    _register(client)
    timer = _create_timer(client, 'Overnight')
    start = datetime(2026, 10, 25, 3, 50, tzinfo=timezone.utc)
    end = datetime(2026, 10, 25, 4, 10, tzinfo=timezone.utc)
    db_session.add(StudySession(username='jay', timer_id=UUID(timer['id']), start_at=start,
        end_at=end, duration_seconds=1200, client_tz='UTC', day_date=start.date(), day_of_week=start.weekday()))
    db_session.commit()
    _freeze_time(monkeypatch, datetime(2026, 10, 25, 3, 59, tzinfo=timezone.utc))
    previous = snapshot(client)
    assert previous['day_date'] == '2026-10-24'
    assert previous['timers'][0]['completed_today_seconds'] == 600
    _freeze_time(monkeypatch, datetime(2026, 10, 25, 4, 1, tzinfo=timezone.utc))
    current = client.get('/api/study-state', params={'known_revision': previous['revision'], 'known_day': previous['day_date']}).json()
    assert current['changed'] is True and current['revision'] == previous['revision']
    assert current['day_date'] == '2026-10-25'
    assert current['timers'][0]['completed_today_seconds'] == 600


def test_migration_preserves_active_accounts_and_rehearses_twice(engine):
    import importlib.util
    from pathlib import Path
    from uuid import uuid4
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import text
    path = Path(__file__).parents[1] / 'alembic/versions/0005_study_sync.py'
    spec = importlib.util.spec_from_file_location('study_sync_migration', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    schema = f'study_sync_{uuid4().hex}'
    with engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
        connection.execute(text('CREATE TABLE users (username text PRIMARY KEY)'))
        connection.execute(text('CREATE TABLE sessions (username text, end_at timestamptz)'))
        connection.execute(text("INSERT INTO users VALUES ('active'), ('idle')"))
        connection.execute(text("INSERT INTO sessions VALUES ('active', NULL)"))
        for iteration in range(2):
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
            users = connection.execute(text('SELECT * FROM users ORDER BY username')).mappings().all()
            assert users[0]['study_revision'] == users[1]['study_revision'] == 0
            assert users[0]['study_timezone'] == users[1]['study_timezone'] == 'America/Toronto'
            assert users[0]['study_last_seen_at'] is not None
            assert users[1]['study_last_seen_at'] is None
            with Operations.context(MigrationContext.configure(connection)):
                migration.downgrade()
        connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))


def test_snapshot_samples_clock_after_waiting_for_account_lock(client, monkeypatch):
    from app.services import study_state
    from test_sessions_unit import _freeze_time
    _register(client)
    before_midnight = datetime(2026, 10, 25, 3, 59, 59, tzinfo=timezone.utc)
    after_midnight = datetime(2026, 10, 25, 4, 0, 1, tzinfo=timezone.utc)
    _freeze_time(monkeypatch, before_midnight)
    original_lock = study_state.lock_current_state
    def delayed_lock(*args, **kwargs):
        user = original_lock(*args, **kwargs)
        _freeze_time(monkeypatch, after_midnight)
        return user
    monkeypatch.setattr(study_state, 'lock_current_state', delayed_lock)
    state = snapshot(client)
    assert datetime.fromisoformat(state['server_now']) == after_midnight
    assert state['day_date'] == '2026-10-25'


@pytest.mark.parametrize('operations', [('stop', 'adjust'), ('reset', 'start'), ('reset', 'reset')])
def test_competing_study_commands_reject_one_stale_writer(client, engine, operations):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from types import SimpleNamespace
    from uuid import UUID
    from fastapi import HTTPException
    from sqlalchemy.orm import Session
    from app.api.totals import reset_totals
    from app.schemas.session import AdjustSessionRequest, StopTimerRequest
    from app.services import sessions
    from app.services.study_state import prepare_command
    _register(client)
    first = _create_timer(client, 'A')
    second = _create_timer(client, 'B')
    command(client, f"/api/timers/{first['id']}/start", client_tz='UTC')
    state = snapshot(client)
    active = state['active_session']
    guard = StopTimerRequest(expected_revision=state['revision'], expected_active_session_id=active['id'])
    gate = Barrier(2)
    def write(operation):
        with Session(engine) as db:
            gate.wait(timeout=5)
            try:
                if operation == 'adjust':
                    sessions.adjust_session(db, 'jay', UUID(active['id']), AdjustSessionRequest(
                        delta_seconds=600, expected_revision=state['revision'],
                        expected_start_at=active['start_at'], expected_end_at=None))
                elif operation == 'reset':
                    reset_totals(SimpleNamespace(state=SimpleNamespace(username='jay')), db, guard)
                else:
                    prepare_command(db, 'jay', guard)
                    if operation == 'start':
                        sessions.start_timer(db, 'jay', UUID(second['id']), 'UTC')
                    else:
                        sessions.stop_active_session(db, 'jay')
                db.commit()
                return 200
            except HTTPException as exc:
                db.rollback()
                return exc.status_code
    with ThreadPoolExecutor(max_workers=2) as workers:
        assert sorted(workers.map(write, operations)) == [200, 409]
    assert snapshot(client)['revision'] == state['revision'] + 1


def test_wrong_active_guard_and_foreign_heartbeat_preserve_lease(client):
    from uuid import uuid4
    _register(client)
    timer = _create_timer(client, 'A')
    command(client, f"/api/timers/{timer['id']}/start", client_tz='UTC')
    state = snapshot(client)
    wrong = str(uuid4())
    assert client.post('/api/stop', json={'expected_revision': state['revision'],
        'expected_active_session_id': wrong}).status_code == 409
    assert client.post('/api/study-heartbeat', json={'active_session_id': wrong}).status_code == 409
    unchanged = snapshot(client)
    assert unchanged['lease_expires_at'] == state['lease_expires_at']
    assert unchanged['revision'] == state['revision']
    assert unchanged['active_session']['id'] == state['active_session']['id']


def test_expiry_clamps_to_adjusted_start_and_persists_before_stale_command(client, monkeypatch):
    from test_sessions_unit import _freeze_time
    _register(client)
    timer = _create_timer(client, 'A')
    start = datetime(2026, 10, 25, 15, tzinfo=timezone.utc)
    _freeze_time(monkeypatch, start)
    active = command(client, f"/api/timers/{timer['id']}/start", client_tz='UTC').json()['active_session']
    _freeze_time(monkeypatch, start + timedelta(minutes=2))
    adjusted = client.post(f"/api/sessions/{active['id']}/adjust", json={
        'delta_seconds': -600, 'expected_start_at': active['start_at'], 'expected_end_at': None}).json()
    _freeze_time(monkeypatch, start + timedelta(minutes=6))
    assert client.post('/api/stop', json={'expected_revision': 3,
        'expected_active_session_id': active['id']}).status_code == 409
    after = snapshot(client)
    assert after['active_session'] is None and after['revision'] == 4
    assert after['timers'][0]['cycle_total_seconds'] == 0
    completed = client.get(f"/api/timers/{timer['id']}/latest-session").json()
    assert datetime.fromisoformat(completed['end_at']) == datetime.fromisoformat(adjusted['start_at'])


def test_full_and_unchanged_snapshot_identify_authenticated_account(client):
    _register(client, 'alice')
    full = snapshot(client)
    assert full['username'] == 'alice'
    unchanged = client.get('/api/study-state', params={
        'known_revision': full['revision'], 'known_day': full['day_date'],
        'expected_username': 'alice'}).json()
    assert unchanged['changed'] is False
    assert unchanged['username'] == 'alice'


@pytest.mark.parametrize('action', ['snapshot', 'unchanged', 'list', 'reset', 'start', 'create', 'patch', 'delete', 'heartbeat'])
def test_stale_account_assertion_rejects_cookie_switch_before_reads_or_writes(client, db_session, action):
    from uuid import UUID, uuid4
    from app.models.timer import Timer
    _register(client, 'alice')
    _create_timer(client, 'Alice course')
    alice = snapshot(client)
    client.post('/api/auth/logout')
    _register(client, 'bob')
    timer = _create_timer(client, 'Bob course')
    db_session.get(Timer, UUID(timer['id'])).cycle_total_seconds = 600
    db_session.commit()
    bob = snapshot(client)
    assert bob['revision'] == alice['revision']
    guard = {'expected_revision': alice['revision'], 'expected_active_session_id': None}
    path, payload, method = {
        'snapshot': ('/api/study-state', None, 'GET'),
        'unchanged': (f"/api/study-state?known_revision={alice['revision']}&known_day={alice['day_date']}", None, 'GET'),
        'list': ('/api/timers', None, 'GET'),
        'reset': ('/api/totals/reset', guard, 'POST'),
        'start': (f"/api/timers/{timer['id']}/start", {**guard, 'client_tz': 'UTC'}, 'POST'),
        'create': ('/api/timers', {'name': 'Unexpected', 'color': '#22C55E', 'icon': 'book'}, 'POST'),
        'patch': (f"/api/timers/{timer['id']}", {'name': 'Unexpected'}, 'PATCH'),
        'delete': (f"/api/timers/{timer['id']}", None, 'DELETE'),
        'heartbeat': ('/api/study-heartbeat', {'active_session_id': str(uuid4())}, 'POST'),
    }[action]
    separator = '&' if '?' in path else '?'
    response = client.request(method, f'{path}{separator}expected_username=alice', json=payload)
    assert response.status_code == 409
    assert response.json()['detail']['code'] == 'account_changed'
    after = snapshot(client)
    assert after['revision'] == bob['revision']
    assert after['active_session'] is None
    assert after['timers'] == bob['timers']
    assert client.get('/api/study-state', params={'expected_username': 'bob'}).status_code == 200
