from __future__ import annotations

import uuid
from datetime import date
from typing import Iterable
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.day_summary import DaySummary
from app.models.session import Session as SessionModel


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

    with db.begin():
        db.execute(stmt)
