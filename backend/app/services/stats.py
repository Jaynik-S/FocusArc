from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Iterable
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.day_summary import DaySummary
from app.models.session import Session as SessionModel
from app.models.timer import Timer


def compute_day_totals(
    db: Session, username: str, day_date: date
) -> list[tuple[UUID, int]]:
    stmt = (
        select(
            SessionModel.timer_id,
            func.coalesce(func.sum(SessionModel.duration_seconds), 0).label("total"),
        )
        .where(
            SessionModel.username == username,
            SessionModel.day_date == day_date,
            SessionModel.end_at.is_not(None),
        )
        .group_by(SessionModel.timer_id)
    )

    rows = db.execute(stmt).all()
    return [(row.timer_id, int(row.total)) for row in rows]


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
    stmt = (
        select(
            SessionModel.day_date,
            SessionModel.timer_id,
            func.coalesce(func.sum(SessionModel.duration_seconds), 0).label("total"),
        )
        .where(
            SessionModel.username == username,
            SessionModel.day_date >= week_start,
            SessionModel.day_date <= week_end,
            SessionModel.end_at.is_not(None),
        )
        .group_by(SessionModel.day_date, SessionModel.timer_id)
        .order_by(SessionModel.day_date.asc(), SessionModel.timer_id.asc())
    )
    rows = db.execute(stmt).all()

    day_map: dict[date, list[tuple[UUID, int]]] = {
        week_start + timedelta(days=offset): [] for offset in range(7)
    }
    for row in rows:
        day_map[row.day_date].append((row.timer_id, int(row.total)))

    return [(day, day_map[day]) for day in sorted(day_map.keys())]


def compute_averages(
    db: Session, username: str, days: int
) -> list[tuple[UUID, int]]:
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    totals_subq = (
        select(
            SessionModel.day_date,
            SessionModel.timer_id,
            func.sum(SessionModel.duration_seconds).label("total_seconds"),
        )
        .where(
            SessionModel.username == username,
            SessionModel.day_date >= start_date,
            SessionModel.day_date <= end_date,
            SessionModel.end_at.is_not(None),
        )
        .group_by(SessionModel.day_date, SessionModel.timer_id)
        .subquery()
    )

    day_count = float(days)
    stmt = (
        select(
            Timer.id,
            func.coalesce(func.sum(totals_subq.c.total_seconds), 0)
            / day_count,
        )
        .select_from(Timer)
        .outerjoin(totals_subq, totals_subq.c.timer_id == Timer.id)
        .where(Timer.username == username, Timer.is_archived.is_(False))
        .group_by(Timer.id)
    )

    rows = db.execute(stmt).all()
    return [(row[0], int(row[1])) for row in rows]
