from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.stats import EndDayRequest, EndDayResponse, TimerTotal
from app.services import sessions as sessions_service
from app.services import stats as stats_service

router = APIRouter(tags=["stats"])


@router.post("/end-day")
def end_day(
    payload: EndDayRequest, request: Request, db: Session = Depends(get_db)
) -> EndDayResponse:
    username = request.state.username

    try:
        sessions_service.stop_active_session_for_day(
            db, username, payload.client_tz, payload.day_date
        )
    except ValueError as exc:
        if str(exc) == "invalid_timezone":
            raise HTTPException(status_code=400, detail="Invalid client_tz")
        raise

    totals = stats_service.compute_day_totals(db, username, payload.day_date)
    stats_service.upsert_day_summaries(db, username, payload.day_date, totals)

    return EndDayResponse(
        ended_day_date=payload.day_date,
        finalized=True,
        totals=[
            TimerTotal(timer_id=timer_id, total_seconds=total_seconds)
            for timer_id, total_seconds in totals
        ],
    )
