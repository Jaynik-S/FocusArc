from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.timer import Timer
from app.schemas.stats import TimerTotal
from app.schemas.totals import ResetTotalsResponse
from app.services import sessions as sessions_service

router = APIRouter(prefix="/totals", tags=["totals"])


@router.post("/reset")
def reset_totals(
    request: Request,
    db: Session = Depends(get_db),
) -> ResetTotalsResponse:
    username = request.state.username

    sessions_service.stop_active_session(db, username)

    with db.begin_nested():
        db.execute(
            update(Timer)
            .where(Timer.username == username)
            .values(cycle_total_seconds=0)
        )

    timers = db.execute(
        select(Timer.id).where(Timer.username == username)
    ).all()

    return ResetTotalsResponse(
        totals=[
            TimerTotal(timer_id=row.id, total_seconds=0) for row in timers
        ]
    )
