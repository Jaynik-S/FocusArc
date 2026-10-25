from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.session import (
    ActiveSessionResponse,
    AdjustSessionRequest,
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


@router.get("/timers/{timer_id}/latest-session")
def latest_timer_session(timer_id: UUID, request: Request, db: Session = Depends(get_db)) -> SessionOut | None:
    try:
        session = sessions_service.latest_timer_session(db, request.state.username, timer_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Timer not found")
    return SessionOut.model_validate(session) if session else None


@router.post("/sessions/{session_id}/adjust")
def adjust_session(session_id: UUID, payload: AdjustSessionRequest, request: Request,
                   db: Session = Depends(get_db)) -> SessionOut:
    try:
        session = sessions_service.adjust_session(db, request.state.username, session_id, payload)
    except ValueError as exc:
        if str(exc) == "session_changed":
            raise HTTPException(status_code=409, detail="Session changed. Refresh before adjusting again.")
        raise
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionOut.model_validate(session)


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
            db,
            username,
            timer_id,
            payload.client_tz,
            payload.stopped_adjustment_seconds,
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
    request: Request,
    db: Session = Depends(get_db),
    payload: StopTimerRequest | None = None,
) -> StopTimerResponse:
    username = request.state.username
    adjustment_seconds = payload.adjustment_seconds if payload else None
    stopped_at_client = payload.stopped_at_client if payload else None
    stopped_session = sessions_service.stop_active_session(
        db, username, adjustment_seconds, stopped_at_client
    )
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
    client_tz: str | None = None,
    db: Session = Depends(get_db),
) -> DaySchedule:
    username = request.state.username
    try:
        sessions = sessions_service.schedule_sessions(db, username, day_date, day_date, client_tz)[day_date]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid client_tz")
    return DaySchedule(
        day_date=day_date,
        sessions=[SessionOut.model_validate(session) for session in sessions],
    )


@router.get("/schedule/week")
def schedule_week(
    request: Request,
    week_start: date = Query(...),
    client_tz: str | None = None,
    db: Session = Depends(get_db),
) -> WeekSchedule:
    username = request.state.username
    week_end = week_start + timedelta(days=6)
    try:
        sessions_by_day = sessions_service.schedule_sessions(db, username, week_start, week_end, client_tz)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid client_tz")
    days_map = {day: [SessionOut.model_validate(session) for session in sessions]
                for day, sessions in sessions_by_day.items()}

    return WeekSchedule(
        week_start=week_start,
        days=[
            WeekScheduleDay(day_date=day, sessions=days_map[day])
            for day in sorted(days_map.keys())
        ],
    )
