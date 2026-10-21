"""Explicit local-only analytics fixtures for a dedicated demo account.

Run from backend: python -m app.demo_analytics --username focusarc_demo
Add --create-account to create credentials and history together. Existing accounts
are never overwritten; no reset operation or HTTP seed endpoint is exposed.
"""
from __future__ import annotations

import argparse
import getpass
import os
from datetime import date, datetime, time, timedelta, timezone
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine, select
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import Session

from app.models.session import Session as SessionModel
from app.models.timer import Timer
from app.models.user import User
from app.schemas.auth import LoginRequest
from app.security import hash_password
from app.settings import Settings, get_settings, normalize_database_url

DEMO_USERNAMES = ("demo", "focusarc_demo")


def validate_demo_target(settings: Settings, username: str) -> None:
    url = make_url(normalize_database_url(settings.database_url))
    if settings.app_env != "dev":
        raise ValueError("Demo fixtures require APP_ENV=dev")
    if url.drivername != "postgresql+psycopg" or url.host not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("Demo fixtures require an explicit localhost PostgreSQL database")
    if set(url.query) - {"sslmode", "application_name", "connect_timeout"}:
        raise ValueError("Demo fixtures refuse connection-routing URL overrides")
    if any(os.getenv(key) for key in ("PGSERVICE", "PGSERVICEFILE", "PGSYSCONFDIR")):
        raise ValueError("Demo fixtures refuse libpq service environment overrides")
    if username not in DEMO_USERNAMES:
        raise ValueError("Demo fixtures only support the dedicated demo or focusarc_demo account")


def create_demo_engine(settings: Settings, username: str) -> Engine:
    validate_demo_target(settings, username)
    url = make_url(normalize_database_url(settings.database_url))
    # hostaddr wins over DNS, PGHOSTADDR and service-file host defaults. Explicit
    # port also prevents PGPORT from choosing a different local database service.
    address = "::1" if url.host == "::1" else "127.0.0.1"
    return create_engine(url, connect_args={"hostaddr": address, "port": url.port or 5432, "connect_timeout": 5})


def generate_demo_rows(username: str, today: date) -> tuple[list[Timer], list[SessionModel]]:
    """Return deterministic fixtures for the 365 calendar days preceding today."""
    zone = ZoneInfo("America/Toronto")
    first = today - timedelta(days=365)
    courses = [
        ("MAT237 - Calculus", "#4F46E5", "calculator", False),
        ("CSC207 - Software Design", "#16A34A", "code", False),
        ("PHY151 - Mechanics", "#EA580C", "flask", False),
        ("HIS101 - World History", "#9333EA", "book", True),
    ]
    timers = [
        Timer(id=uuid5(NAMESPACE_URL, f"focusarc-demo/{username}/timer/{index}"), username=username,
              name=name, color=color, icon=icon, is_archived=archived)
        for index, (name, color, icon, archived) in enumerate(courses)
    ]
    sessions: list[SessionModel] = []

    def append(timer_index: int, start: datetime, end: datetime, recorded: int | None = None) -> None:
        start_utc, end_utc = start.astimezone(timezone.utc), end.astimezone(timezone.utc)
        sessions.append(SessionModel(
            id=uuid5(NAMESPACE_URL, f"focusarc-demo/{username}/{first}/{len(sessions)}"),
            username=username, timer_id=timers[timer_index].id,
            start_at=start_utc, end_at=end_utc,
            duration_seconds=recorded if recorded is not None else int((end_utc - start_utc).total_seconds()),
            client_tz=zone.key, day_date=start.date(), day_of_week=start.weekday(),
        ))

    for offset in range(365):
        day = first + timedelta(days=offset)
        early = datetime.combine(day, time(1, 30), zone)
        late = datetime.combine(day, time(3, 30), zone)
        if early.utcoffset() != late.utcoffset():
            append(1, early, late)
        # Recurring quiet weeks preserve occasional DST examples above.
        if (offset // 7) % 8 == 0:
            continue
        if day.weekday() == 6:
            continue
        for block in range(1 + offset % 3):
            start = datetime.combine(day, time(8 + block * 3 + offset % 2, 15), zone)
            minutes = 25 + (offset * 7 + block * 13) % 76
            end = start + timedelta(minutes=minutes)
            actual = minutes * 60
            recorded = actual + 600 if offset % 11 == 0 else max(0, actual - 300) if offset % 13 == 0 else actual
            append((offset + block) % 4, start, end, recorded)
        if offset % 17 == 0 and offset < 364:
            start = datetime.combine(day, time(23, 30), zone)
            append(0, start, start + timedelta(hours=1), 7200)
        if offset % 41 == 0:
            start = datetime.combine(day, time(17), zone)
            append(2, start, start, 900)
    return timers, sessions


def seed_demo_account(db: Session, username: str, today: date) -> tuple[int, int]:
    if username not in DEMO_USERNAMES:
        raise ValueError("Only the dedicated demo or focusarc_demo account can receive demo fixtures")
    account = db.scalar(select(User.username).where(
        User.username == username, User.password_hash.is_not(None)
    ).with_for_update())
    if account is None:
        raise ValueError("Create and authenticate the dedicated demo account before seeding")
    if db.scalar(select(Timer.id).where(Timer.username == username).limit(1)) is not None:
        raise ValueError("Demo account already has timers; no data was changed")
    if db.scalar(select(SessionModel.id).where(SessionModel.username == username).limit(1)) is not None:
        raise ValueError("Demo account already has sessions; no data was changed")
    timers, sessions = generate_demo_rows(username, today)
    db.add_all(timers)
    db.flush()
    db.add_all(sessions)
    db.flush()
    return len(timers), len(sessions)


def create_and_seed_demo_account(db: Session, username: str, password: str, today: date) -> tuple[int, int]:
    """Create credentials and fixtures within the caller's transaction."""
    credentials = LoginRequest(username=username, password=password)
    if credentials.username not in DEMO_USERNAMES:
        raise ValueError("Only dedicated demo accounts can be created")
    if db.get(User, credentials.username) is not None:
        raise ValueError("Demo account already exists; credentials and history were left unchanged")
    db.add(User(username=credentials.username, password_hash=hash_password(credentials.password)))
    db.flush()
    return seed_demo_account(db, credentials.username, today)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--username", required=True, choices=DEMO_USERNAMES)
    parser.add_argument("--create-account", action="store_true", help="Create a new account and history atomically; prompts for a password")
    args = parser.parse_args()
    settings = get_settings()
    try:
        engine = create_demo_engine(settings, args.username)
    except ValueError as exc:
        parser.exit(2, f"Refused: {exc}\n")
    try:
        with Session(engine) as db, db.begin():
            today = datetime.now(timezone.utc).astimezone(ZoneInfo("America/Toronto")).date()
            if args.create_account:
                password = os.getenv("FOCUSARC_DEMO_PASSWORD") or getpass.getpass("New demo password (8-128 characters): ")
                timer_count, session_count = create_and_seed_demo_account(db, args.username, password, today)
            else:
                timer_count, session_count = seed_demo_account(db, args.username, today)
    except ValueError as exc:
        parser.exit(2, f"Refused: {exc}\n")
    finally:
        engine.dispose()
    print(f"Created {timer_count} demo courses and {session_count} completed sessions for {args.username}.")


if __name__ == "__main__":
    main()
