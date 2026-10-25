from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Tuple
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.session import Session as SessionModel
from app.models.timer import Timer
from app.models.user import User
from app.schemas.session import AdjustSessionRequest
from app.services.analytics_time import allocate_interval, build_window


def _increment_cycle_total(db: Session, timer_id: UUID, delta_seconds: int) -> None:
    timer = db.get(Timer, timer_id)
    if timer is None:
        return
    timer.cycle_total_seconds = max(0, timer.cycle_total_seconds + delta_seconds)


def lock_study_data(db: Session, username: str) -> None:
    # Serialize session edits, stops, switches and resets in the same lock order.
    db.execute(select(User.username).where(User.username == username).with_for_update())


def _move_start(session: SessionModel, delta_seconds: int, end_at: datetime) -> None:
    end_at = end_at.astimezone(timezone.utc)
    session.start_at = min(session.start_at.astimezone(timezone.utc) - timedelta(seconds=delta_seconds), end_at)
    session.day_date, session.day_of_week = _derive_day(session.client_tz, session.start_at)
    if session.end_at is not None:
        session.duration_seconds = max(0, int((end_at - session.start_at).total_seconds()))


def _finish_session(db: Session, session: SessionModel, end_at: datetime, adjustment: int = 0) -> None:
    session.end_at = end_at
    _move_start(session, adjustment, end_at)
    _increment_cycle_total(db, session.timer_id, session.duration_seconds or 0)
    db.flush()
    _refresh_summaries(db, session.username)


def _refresh_summaries(db: Session, username: str) -> None:
    from app.models.day_summary import DaySummary
    from app.services.stats import compute_day_totals

    # Existing finalized summaries are caches; replace their values rather than add.
    summaries = db.scalars(select(DaySummary).where(DaySummary.username == username)).all()
    totals = {day: dict(compute_day_totals(db, username, day)) for day in {s.day_date for s in summaries}}
    for summary in summaries:
        summary.total_seconds = totals[summary.day_date].get(summary.timer_id, 0)


def adjust_session(db: Session, username: str, session_id: UUID, data: AdjustSessionRequest) -> SessionModel | None:
    lock_study_data(db, username)
    session = db.scalar(select(SessionModel).where(
        SessionModel.id == session_id, SessionModel.username == username,
    ).with_for_update().execution_options(populate_existing=True))
    if session is None:
        return None
    actual_end = session.end_at.astimezone(timezone.utc) if session.end_at else None
    expected_end = data.expected_end_at.astimezone(timezone.utc) if data.expected_end_at else None
    if session.start_at.astimezone(timezone.utc) != data.expected_start_at.astimezone(timezone.utc) or actual_end != expected_end:
        raise ValueError("session_changed")
    previous_duration = session.duration_seconds or 0
    _move_start(session, data.delta_seconds, session.end_at or datetime.now(timezone.utc))
    if session.end_at is not None:
        timer = db.get(Timer, session.timer_id)
        if timer.cycle_reset_at is None or actual_end > timer.cycle_reset_at.astimezone(timezone.utc):
            _increment_cycle_total(db, session.timer_id, session.duration_seconds - previous_duration)
    db.flush()
    _refresh_summaries(db, username)
    return session


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


def latest_timer_session(db: Session, username: str, timer_id: UUID) -> SessionModel | None:
    timer = db.get(Timer, timer_id)
    if timer is None or timer.username != username:
        raise LookupError("timer_not_found")
    return db.scalar(select(SessionModel).where(
        SessionModel.username == username, SessionModel.timer_id == timer_id,
    ).order_by(SessionModel.created_at.desc(), SessionModel.id.desc()).limit(1))


def start_timer(
    db: Session,
    username: str,
    timer_id: UUID,
    client_tz: str,
    stopped_adjustment_seconds: int | None = None,
) -> Tuple[SessionModel | None, SessionModel]:
    lock_study_data(db, username)
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
                _finish_session(db, active, now, stopped_adjustment_seconds or 0)
                stopped_session = active

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


def stop_active_session(
    db: Session,
    username: str,
    adjustment_seconds: int | None = None,
    stopped_at_client: datetime | None = None,
) -> SessionModel | None:
    lock_study_data(db, username)
    now = datetime.now(timezone.utc)
    end_at = now
    if stopped_at_client is not None:
        if stopped_at_client.tzinfo is None:
            stopped_at_client = stopped_at_client.replace(tzinfo=timezone.utc)
        else:
            stopped_at_client = stopped_at_client.astimezone(timezone.utc)
        end_at = min(now, stopped_at_client)

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

        _finish_session(db, active, end_at, adjustment_seconds or 0)

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
    lock_study_data(db, username)
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

        if now.astimezone(tz).date() == day_date:
            end_at = now
        else:
            previous_day = day_date - timedelta(days=1)
            end_at = _end_of_day_utc(previous_day, tz)
            if end_at < active.start_at:
                end_at = active.start_at

        _finish_session(db, active, end_at)

    db.refresh(active)
    return active


def schedule_sessions(db: Session, username: str, start_date: date, end_date: date,
                      client_tz: str | None = None) -> dict[date, list[SessionModel]]:
    if client_tz:
        _get_timezone(client_tz)
    # Use the requested display zone, or each session's saved zone for old clients.
    lower = datetime.combine(start_date - timedelta(days=2), time.min, timezone.utc)
    upper = datetime.combine(end_date + timedelta(days=3), time.min, timezone.utc)
    records = db.scalars(select(SessionModel).where(
        SessionModel.username == username, SessionModel.start_at < upper,
        or_(SessionModel.end_at >= lower, SessionModel.end_at.is_(None)),
    ).order_by(SessionModel.start_at)).all()
    days = {start_date + timedelta(days=i): [] for i in range((end_date - start_date).days + 1)}
    windows = {}
    for session in records:
        zone = client_tz or session.client_tz
        if zone not in windows:
            windows[zone] = build_window(start_date, end_date, zone)
        allocation = allocate_interval(session.start_at, session.end_at or datetime.now(timezone.utc),
                                       session.duration_seconds, windows[zone])
        for day in allocation.daily:
            days[day].append(session)
    return days
