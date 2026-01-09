from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.stats import (
    DayStatsResponse,
    TimerTotal,
    WeekStatsDay,
    WeekStatsResponse,
)
from app.services import stats as stats_service

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/day")
def stats_day(
    request: Request,
    day_date: date = Query(...),
    db: Session = Depends(get_db),
) -> DayStatsResponse:
    username = request.state.username
    totals = stats_service.compute_day_totals(db, username, day_date)
    return DayStatsResponse(
        day_date=day_date,
        totals=[
            TimerTotal(timer_id=timer_id, total_seconds=total_seconds)
            for timer_id, total_seconds in totals
        ],
    )


@router.get("/week")
def stats_week(
    request: Request,
    week_start: date = Query(...),
    db: Session = Depends(get_db),
) -> WeekStatsResponse:
    username = request.state.username
    days = stats_service.compute_week_totals(db, username, week_start)
    return WeekStatsResponse(
        week_start=week_start,
        daily=[
            WeekStatsDay(
                day_date=day_date,
                totals=[
                    TimerTotal(timer_id=timer_id, total_seconds=total_seconds)
                    for timer_id, total_seconds in totals
                ],
            )
            for day_date, totals in days
        ],
    )


@router.get("/averages")
def stats_averages(
    request: Request,
    days: int = Query(14, ge=1, le=365),
    db: Session = Depends(get_db),
) -> dict:
    username = request.state.username
    averages = stats_service.compute_averages(db, username, days)
    return {
        "days": days,
        "averages": [
            {"timer_id": str(timer_id), "avg_seconds_per_day": avg_seconds}
            for timer_id, avg_seconds in averages
        ],
    }
