"""Account snapshots, optimistic commands and server-owned inactivity leases."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.session import Session as SessionModel
from app.models.user import User
from app.schemas.session import SessionOut, StudyCommand
from app.schemas.timer import TimerOut
from app.services import sessions, timers
from app.services.analytics_time import allocate_interval, build_window

LEASE = timedelta(minutes=5)


def check_revision(user: User, expected_revision: int) -> None:
    if user.study_revision != expected_revision:
        raise HTTPException(status_code=409, detail={'code': 'study_changed', 'message': 'Study data changed on another device. Sync and try again.'})


def expire_locked(db: Session, user: User, now: datetime) -> bool:
    active = sessions.get_active_session(db, user.username)
    if active is None:
        return False
    seen = user.study_last_seen_at or active.start_at
    if now < seen + LEASE:
        return False
    sessions._finish_session(db, active, max(active.start_at, seen))
    user.study_last_seen_at = None
    sessions.increment_study_revision(db, user.username)
    return True


def prepare_command(db: Session, username: str, payload: StudyCommand | None) -> User:
    user = sessions.lock_study_data(db, username)
    if expire_locked(db, user, sessions.datetime.now(timezone.utc)):
        # Expiry must survive a subsequently rejected stale command.
        db.commit()
        user = sessions.lock_study_data(db, username)
    if payload is None or payload.expected_revision is None or 'expected_active_session_id' not in payload.model_fields_set:
        raise HTTPException(status_code=409, detail={'code': 'reload_required', 'message': 'Reload FocusArc to use the updated timer controls.'})
    check_revision(user, payload.expected_revision)
    active = sessions.get_active_session(db, username)
    if (active.id if active else None) != payload.expected_active_session_id:
        raise HTTPException(status_code=409, detail={'code': 'study_changed', 'message': 'The active timer changed. Sync and try again.'})
    return user


def guard_read_revision(request: Request, expected_revision: int | None = None,
                        expected_username: str | None = None,
                        db: Session = Depends(get_db)) -> None:
    if expected_username is not None and expected_username != request.state.username:
        raise HTTPException(status_code=409, detail={
            'code': 'account_changed', 'message': 'Account changed. Sign in again.'})
    if request.method != 'GET' or expected_revision is None:
        return
    user = lock_current_state(db, request.state.username)
    check_revision(user, expected_revision)


def lock_current_state(db: Session, username: str) -> User:
    def read_lock():
        return db.scalar(select(User).where(User.username == username)
                         .with_for_update(read=True).execution_options(populate_existing=True))
    user = read_lock()
    now = sessions.datetime.now(timezone.utc)
    active = sessions.get_active_session(db, username)
    if active and now >= (user.study_last_seen_at or active.start_at) + LEASE:
        # Release the shared lock before upgrading, avoiding competing-reader deadlocks.
        db.rollback()
        user = sessions.lock_study_data(db, username)
        expire_locked(db, user, sessions.datetime.now(timezone.utc))
        db.commit()
        user = read_lock()
    return user


def get_study_state(db: Session, username: str, known_revision: int | None = None,
                    known_day: date | None = None) -> dict:
    user = lock_current_state(db, username)
    now = sessions.datetime.now(timezone.utc)
    day = now.astimezone(sessions._get_timezone(user.study_timezone)).date()
    window = build_window(day, day, user.study_timezone)
    active = sessions.get_active_session(db, username)
    result = dict(username=username, changed=known_revision != user.study_revision or known_day != day,
                  revision=user.study_revision, server_now=now,
                  study_timezone=user.study_timezone, day_date=day,
                  day_start_at=window.start_utc, day_end_at=window.end_utc,
                  lease_expires_at=(user.study_last_seen_at + LEASE) if active and user.study_last_seen_at else None)
    if not result['changed']:
        return result
    completed = db.scalars(select(SessionModel).where(
        SessionModel.username == username, SessionModel.end_at.is_not(None),
        SessionModel.start_at < window.end_utc, SessionModel.end_at >= window.start_utc,
    )).all()
    totals: dict[UUID, int] = {}
    for record in completed:
        allocation = allocate_interval(record.start_at, record.end_at, record.duration_seconds, window)
        totals[record.timer_id] = totals.get(record.timer_id, 0) + allocation.recorded_seconds
    result['active_session'] = SessionOut.model_validate(active).model_dump(mode='json') if active else None
    result['timers'] = [dict(TimerOut.model_validate(timer).model_dump(mode='json'),
                            completed_today_seconds=totals.get(timer.id, 0))
                        for timer in timers.list_timers(db, username, True)]
    return result


def heartbeat(db: Session, username: str, active_session_id: UUID) -> bool:
    user = sessions.lock_study_data(db, username)
    now = sessions.datetime.now(timezone.utc)
    expire_locked(db, user, now)
    active = sessions.get_active_session(db, username)
    if active is None or active.id != active_session_id:
        return False
    user.study_last_seen_at = now
    db.flush()
    return True


def expire_stale_accounts(db: Session, now: datetime | None = None) -> int:
    now = now or sessions.datetime.now(timezone.utc)
    users = db.scalars(select(User).where(
        User.study_last_seen_at <= now - LEASE,
        select(SessionModel.id).where(SessionModel.username == User.username,
                                      SessionModel.end_at.is_(None)).exists(),
    ).with_for_update(skip_locked=True).execution_options(populate_existing=True)).all()
    return sum(expire_locked(db, user, now) for user in users)
