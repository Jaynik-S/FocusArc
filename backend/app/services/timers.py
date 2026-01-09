from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.timer import Timer
from app.schemas.timer import TimerCreate, TimerUpdate


def list_timers(db: Session, username: str, include_archived: bool) -> list[Timer]:
    stmt = select(Timer).where(Timer.username == username)
    if not include_archived:
        stmt = stmt.where(Timer.is_archived.is_(False))
    stmt = stmt.order_by(Timer.created_at.asc())
    return list(db.execute(stmt).scalars().all())


def create_timer(db: Session, username: str, data: TimerCreate) -> Timer:
    timer = Timer(
        username=username,
        name=data.name,
        color=data.color,
        icon=data.icon,
    )
    db.add(timer)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("duplicate_name") from exc
    db.refresh(timer)
    return timer


def update_timer(
    db: Session, username: str, timer_id: UUID, data: TimerUpdate
) -> Timer | None:
    timer = db.get(Timer, timer_id)
    if timer is None or timer.username != username:
        return None

    if data.name is not None:
        timer.name = data.name
    if data.color is not None:
        timer.color = data.color
    if data.icon is not None:
        timer.icon = data.icon
    if data.is_archived is not None:
        timer.is_archived = data.is_archived

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("duplicate_name") from exc
    db.refresh(timer)
    return timer


def archive_timer(db: Session, username: str, timer_id: UUID) -> bool:
    timer = db.get(Timer, timer_id)
    if timer is None or timer.username != username:
        return False
    if not timer.is_archived:
        timer.is_archived = True
        db.commit()
    return True
