"""Read-only analytics: completed sessions are the only source of totals."""
from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.session import Session as SessionModel
from app.models.timer import Timer
from app.services.analytics_time import AnalyticsWindow, allocate_interval, build_window


def validated_window(
    from_date: date, to_date: date, client_tz: str, *, now: datetime | None = None
) -> AnalyticsWindow:
    try:
        zone = ZoneInfo(client_tz)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid client_tz") from None
    if to_date < from_date:
        raise HTTPException(status_code=400, detail="from must be on or before to")
    if (to_date - from_date).days >= 365:
        raise HTTPException(status_code=400, detail="Analytics range cannot exceed 365 days")
    today = (now or datetime.now(timezone.utc)).astimezone(zone).date()
    if to_date > today:
        raise HTTPException(status_code=400, detail="to cannot be in the future")
    return build_window(from_date, to_date, client_tz)


def fetch_records(
    db: Session,
    username: str,
    window: AnalyticsWindow,
    timer_id: UUID | None = None,
    *,
    details: bool = False,
) -> list[Mapping[str, Any]]:
    if timer_id is not None:
        owned = db.scalar(select(Timer.id).where(Timer.id == timer_id, Timer.username == username))
        if owned is None:
            raise HTTPException(status_code=404, detail="Timer not found")
    columns = [SessionModel.start_at, SessionModel.end_at, SessionModel.duration_seconds]
    if details:
        columns.extend([
            SessionModel.id, SessionModel.timer_id, SessionModel.client_tz,
            SessionModel.day_date, SessionModel.day_of_week,
        ])
    statement = (
        select(*columns)
        .join(Timer, Timer.id == SessionModel.timer_id)
        .where(
            SessionModel.username == username,
            Timer.username == username,
            SessionModel.end_at.is_not(None),
            or_(
                and_(SessionModel.end_at > SessionModel.start_at,
                     SessionModel.start_at < window.end_utc,
                     SessionModel.end_at > window.start_utc),
                and_(SessionModel.end_at == SessionModel.start_at,
                     SessionModel.start_at >= window.start_utc,
                     SessionModel.start_at < window.end_utc),
            ),
        )
        .order_by(SessionModel.start_at.desc(), SessionModel.id.desc())
    )
    if timer_id is not None:
        statement = statement.where(SessionModel.timer_id == timer_id)
    return db.execute(statement).mappings().all()


def aggregate_records(
    records: Iterable[Mapping[str, Any]], window: AnalyticsWindow, today: date
) -> dict:
    count = (window.to_date - window.from_date).days + 1
    daily = {
        window.from_date + timedelta(days=i): {
            "day_date": window.from_date + timedelta(days=i),
            "recorded_seconds": 0, "timed_seconds": 0, "session_count": 0,
        }
        for i in range(count)
    }
    hourly = [0] * 24
    recorded_total = timed_total = session_count = 0
    for record in records:
        allocation = allocate_interval(record["start_at"], record["end_at"], record["duration_seconds"], window)
        if not allocation.daily:
            continue
        session_count += 1
        recorded_total += allocation.recorded_seconds
        timed_total += allocation.timed_seconds
        for day, (recorded, timed) in allocation.daily.items():
            daily[day]["recorded_seconds"] += recorded
            daily[day]["timed_seconds"] += timed
            daily[day]["session_count"] += 1
        for hour, seconds in enumerate(allocation.hourly):
            hourly[hour] += seconds

    weeks: dict[date, dict] = {}
    for day, value in daily.items():
        monday = day - timedelta(days=day.weekday())
        week = weeks.setdefault(monday, {
            "week_start": monday, "recorded_seconds": 0, "active_days": 0,
            "is_partial": monday < window.from_date or monday + timedelta(days=6) > window.to_date
            or monday + timedelta(days=6) >= today,
        })
        week["recorded_seconds"] += value["recorded_seconds"]
        week["active_days"] += int(value["recorded_seconds"] > 0)

    full_weeks = [week for week in weeks.values() if not week["is_partial"]]
    comparison = None
    if len(full_weeks) >= 2:
        previous, current = full_weeks[-2:]
        previous_seconds, current_seconds = previous["recorded_seconds"], current["recorded_seconds"]
        delta = current_seconds - previous_seconds
        comparison = {
            "previous_week_start": previous["week_start"], "current_week_start": current["week_start"],
            "previous_seconds": previous_seconds, "current_seconds": current_seconds, "delta_seconds": delta,
            "delta_percent": delta / previous_seconds * 100 if previous_seconds else None,
        }
    active_days = sum(value["recorded_seconds"] > 0 for value in daily.values())
    return {
        "range": {"from": window.from_date, "to": window.to_date, "client_tz": window.zone.key},
        "summary": {
            "recorded_seconds": recorded_total, "timed_seconds": timed_total, "session_count": session_count,
            "active_days": active_days, "day_count": count, "consistency_percent": round(active_days / count * 100, 1),
            "average_seconds_per_day": recorded_total / count,
        },
        "daily": list(daily.values()), "weekly": list(weeks.values()),
        "hourly": [{"hour": hour, "timed_seconds": seconds} for hour, seconds in enumerate(hourly)],
        "comparison": comparison,
    }


def compute_analytics(db: Session, username: str, window: AnalyticsWindow, timer_id: UUID | None = None) -> dict:
    today = datetime.now(timezone.utc).astimezone(window.zone).date()
    return aggregate_records(fetch_records(db, username, window, timer_id), window, today)


def compute_analytics_sessions(db: Session, username: str, window: AnalyticsWindow, timer_id: UUID | None = None) -> dict:
    sessions = []
    for record in fetch_records(db, username, window, timer_id, details=True):
        allocation = allocate_interval(record["start_at"], record["end_at"], record["duration_seconds"], window)
        if not allocation.daily:
            continue
        sessions.append(dict(record) | {
            "range_recorded_seconds": allocation.recorded_seconds,
            "range_timed_seconds": allocation.timed_seconds,
        })
    return {"sessions": sessions}
