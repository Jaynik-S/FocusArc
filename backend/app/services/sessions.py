from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Tuple
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.session import Session as SessionModel
from app.models.timer import Timer


def _increment_cycle_total(db: Session, timer_id: UUID, delta_seconds: int) -> None:
    if delta_seconds <= 0:
        return
    timer = db.get(Timer, timer_id)
    if timer is None:
        return
    timer.cycle_total_seconds += delta_seconds


def _get_timezone(client_tz: str) -> ZoneInfo:
    if not client_tz:
        raise ValueError("invalid_timezone")

    try:
        return ZoneInfo(client_tz)
    except Exception as exc:
        raise ValueError("invalid_timezone") from exc


def _derive_day(client_tz: str, at_utc: datetime) -> tuple[date, int]:
    tz = _get_timezone(client_tz)
    local_time = at_utc.astimezone(tz)
    return local_time.date(), local_time.weekday()


def _end_of_day_utc(day_date: date, tz: ZoneInfo) -> datetime:
    local_end = datetime.combine(day_date, time(23, 59, 59, 999000), tzinfo=tz)
    return local_end.astimezone(timezone.utc)


def get_active_session(db: Session, username: str) -> SessionModel | None:
    return (
        db.execute(
            select(SessionModel).where(
                SessionModel.username == username,
                SessionModel.end_at.is_(None),
            )
        )
        .scalars()
        .first()
    )


def start_timer(
    db: Session, username: str, timer_id: UUID, client_tz: str
) -> Tuple[SessionModel | None, SessionModel]:
    timer = db.get(Timer, timer_id)
    if timer is None or timer.username != username:
        raise LookupError("timer_not_found")

    now = datetime.now(timezone.utc)
    day_date, day_of_week = _derive_day(client_tz, now)

    stopped_session: SessionModel | None = None

    try:
        with db.begin_nested():
            active = (
                db.execute(
                    select(SessionModel)
                    .where(
                        SessionModel.username == username,
                        SessionModel.end_at.is_(None),
                    )
                    .with_for_update()
                )
                .scalars()
                .first()
            )

            if active and active.timer_id == timer_id:
                return None, active

            if active is not None:
                active.end_at = now
                active.duration_seconds = max(
                    0, int((active.end_at - active.start_at).total_seconds())
                )
                stopped_session = active
                _increment_cycle_total(
                    db, active.timer_id, active.duration_seconds or 0
                )

            new_session = SessionModel(
                username=username,
                timer_id=timer_id,
                start_at=now,
                end_at=None,
                duration_seconds=None,
                client_tz=client_tz,
                day_date=day_date,
                day_of_week=day_of_week,
            )
            db.add(new_session)

        db.refresh(new_session)
        if stopped_session is not None:
            db.refresh(stopped_session)
        return stopped_session, new_session
    except IntegrityError:
        db.rollback()
        active = get_active_session(db, username)
        if active is not None:
            return None, active
        raise


def stop_active_session(db: Session, username: str) -> SessionModel | None:
    now = datetime.now(timezone.utc)

    with db.begin_nested():
        active = (
            db.execute(
                select(SessionModel)
                .where(
                    SessionModel.username == username,
                    SessionModel.end_at.is_(None),
                )
                .with_for_update()
            )
            .scalars()
            .first()
        )

        if active is None:
            return None

        active.end_at = now
        active.duration_seconds = max(
            0, int((active.end_at - active.start_at).total_seconds())
        )
        _increment_cycle_total(db, active.timer_id, active.duration_seconds or 0)

    db.refresh(active)
    return active


def list_sessions(
    db: Session,
    username: str,
    start_date: date,
    end_date: date,
    timer_id: UUID | None = None,
) -> list[SessionModel]:
    stmt = select(SessionModel).where(
        SessionModel.username == username,
        SessionModel.day_date >= start_date,
        SessionModel.day_date <= end_date,
    )
    if timer_id is not None:
        stmt = stmt.where(SessionModel.timer_id == timer_id)
    stmt = stmt.order_by(SessionModel.start_at.asc())
    return list(db.execute(stmt).scalars().all())


def stop_active_session_for_day(
    db: Session, username: str, client_tz: str, day_date: date
) -> SessionModel | None:
    tz = _get_timezone(client_tz)
    now = datetime.now(timezone.utc)

    with db.begin_nested():
        active = (
            db.execute(
                select(SessionModel)
                .where(
                    SessionModel.username == username,
                    SessionModel.end_at.is_(None),
                )
                .with_for_update()
            )
            .scalars()
            .first()
        )

        if active is None:
            return None

        if active.day_date == day_date:
            end_at = now
        else:
            previous_day = day_date - timedelta(days=1)
            end_at = _end_of_day_utc(previous_day, tz)
            if end_at < active.start_at:
                end_at = active.start_at

        active.end_at = end_at
        active.duration_seconds = max(
            0, int((active.end_at - active.start_at).total_seconds())
        )
        _increment_cycle_total(db, active.timer_id, active.duration_seconds or 0)

    db.refresh(active)
    return active
