from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Iterable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.day_summary import DaySummary
from app.models.session import Session as SessionModel
from app.models.timer import Timer
from app.services.analytics_time import allocate_interval, build_window


def _interval_totals(db: Session, username: str, start: date, end: date) -> dict[date, dict[UUID, int]]:
    lower = datetime.combine(start - timedelta(days=2), time.min, timezone.utc)
    upper = datetime.combine(end + timedelta(days=3), time.min, timezone.utc)
    records = db.scalars(select(SessionModel).where(
        SessionModel.username == username, SessionModel.end_at.is_not(None),
        SessionModel.start_at < upper, SessionModel.end_at >= lower,
    )).all()
    totals = {start + timedelta(days=i): {} for i in range((end - start).days + 1)}
    windows = {}
    for session in records:
        if session.client_tz not in windows:
            windows[session.client_tz] = build_window(start, end, session.client_tz)
        allocation = allocate_interval(session.start_at, session.end_at, session.duration_seconds,
                                       windows[session.client_tz])
        for day, (seconds, _) in allocation.daily.items():
            totals[day][session.timer_id] = totals[day].get(session.timer_id, 0) + seconds
    return totals


def compute_day_totals(
    db: Session, username: str, day_date: date
) -> list[tuple[UUID, int]]:
    return list(_interval_totals(db, username, day_date, day_date)[day_date].items())


def upsert_day_summaries(
    db: Session, username: str, day_date: date, totals: Iterable[tuple[UUID, int]]
) -> None:
    rows = [
        {
            "id": uuid.uuid4(),
            "username": username,
            "day_date": day_date,
            "timer_id": timer_id,
            "total_seconds": total_seconds,
        }
        for timer_id, total_seconds in totals
    ]

    if not rows:
        return

    stmt = insert(DaySummary).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=[
            DaySummary.username,
            DaySummary.day_date,
            DaySummary.timer_id,
        ],
        set_={"total_seconds": stmt.excluded.total_seconds},
    )

    with db.begin_nested():
        db.execute(stmt)


def compute_week_totals(
    db: Session, username: str, week_start: date
) -> list[tuple[date, list[tuple[UUID, int]]]]:
    week_end = week_start + timedelta(days=6)
    totals = _interval_totals(db, username, week_start, week_end)
    return [(day, sorted(values.items())) for day, values in totals.items()]


def compute_averages(
    db: Session, username: str, days: int
) -> list[tuple[UUID, int]]:
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    totals = _interval_totals(db, username, start_date, end_date)
    timer_ids = db.scalars(select(Timer.id).where(Timer.username == username, Timer.is_archived.is_(False))).all()
    return [(timer_id, sum(values.get(timer_id, 0) for values in totals.values()) // days) for timer_id in timer_ids]
