from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.session import (
    ActiveSessionResponse,
    DaySchedule,
    SessionList,
    SessionOut,
    StartTimerRequest,
    StartTimerResponse,
    StopTimerRequest,
    StopTimerResponse,
    WeekSchedule,
    WeekScheduleDay,
)
from app.services import sessions as sessions_service

router = APIRouter(tags=["sessions"])


@router.get("/active-session")
def get_active_session(
    request: Request, db: Session = Depends(get_db)
) -> ActiveSessionResponse:
    username = request.state.username
    active = sessions_service.get_active_session(db, username)
    return ActiveSessionResponse(
        active_session=SessionOut.model_validate(active) if active else None
    )


@router.post("/timers/{timer_id}/start")
def start_timer(
    timer_id: UUID,
    payload: StartTimerRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> StartTimerResponse:
    username = request.state.username
    try:
        stopped_session, active_session = sessions_service.start_timer(
            db, username, timer_id, payload.client_tz
        )
    except LookupError as exc:
        if str(exc) == "timer_not_found":
            raise HTTPException(status_code=404, detail="Timer not found")
        raise
    except ValueError as exc:
        if str(exc) == "invalid_timezone":
            raise HTTPException(status_code=400, detail="Invalid client_tz")
        raise

    return StartTimerResponse(
        stopped_session=SessionOut.model_validate(stopped_session)
        if stopped_session
        else None,
        active_session=SessionOut.model_validate(active_session),
    )


@router.post("/stop")
def stop_timer(
    payload: StopTimerRequest | None = None,
    request: Request,
    db: Session = Depends(get_db),
) -> StopTimerResponse:
    _ = payload
    username = request.state.username
    stopped_session = sessions_service.stop_active_session(db, username)
    return StopTimerResponse(
        stopped_session=SessionOut.model_validate(stopped_session)
        if stopped_session
        else None
    )


@router.get("/sessions")
def list_sessions(
    request: Request,
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    timer_id: UUID | None = None,
    db: Session = Depends(get_db),
) -> SessionList:
    if from_date > to_date:
        raise HTTPException(status_code=400, detail="Invalid date range")
    username = request.state.username
    sessions = sessions_service.list_sessions(
        db, username, from_date, to_date, timer_id
    )
    return SessionList(
        sessions=[SessionOut.model_validate(session) for session in sessions]
    )


@router.get("/schedule/day")
def schedule_day(
    request: Request,
    day_date: date = Query(...),
    db: Session = Depends(get_db),
) -> DaySchedule:
    username = request.state.username
    sessions = sessions_service.list_sessions(db, username, day_date, day_date)
    return DaySchedule(
        day_date=day_date,
        sessions=[SessionOut.model_validate(session) for session in sessions],
    )


@router.get("/schedule/week")
def schedule_week(
    request: Request,
    week_start: date = Query(...),
    db: Session = Depends(get_db),
) -> WeekSchedule:
    username = request.state.username
    week_end = week_start + timedelta(days=6)
    sessions = sessions_service.list_sessions(db, username, week_start, week_end)

    days_map: dict[date, list[SessionOut]] = {
        week_start + timedelta(days=offset): [] for offset in range(7)
    }
    for session in sessions:
        days_map[session.day_date].append(SessionOut.model_validate(session))

    return WeekSchedule(
        week_start=week_start,
        days=[
            WeekScheduleDay(day_date=day, sessions=days_map[day])
            for day in sorted(days_map.keys())
        ],
    )
