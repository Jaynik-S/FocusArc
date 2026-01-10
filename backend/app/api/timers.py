from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.timer import TimerCreate, TimerList, TimerOut, TimerUpdate
from app.services import timers as timers_service

router = APIRouter(prefix="/timers", tags=["timers"])


@router.get("")
def list_timers(
    request: Request,
    db: Session = Depends(get_db),
    include_archived: bool = Query(default=False),
) -> TimerList:
    username = request.state.username
    timers = timers_service.list_timers(db, username, include_archived)
    return TimerList(timers=timers)


@router.post("", status_code=201)
def create_timer(
    payload: TimerCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> TimerOut:
    username = request.state.username
    try:
        timer = timers_service.create_timer(db, username, payload)
    except ValueError as exc:
        if str(exc) == "duplicate_name":
            raise HTTPException(status_code=409, detail="Timer name already exists")
        raise
    return TimerOut.model_validate(timer)


@router.patch("/{timer_id}")
def update_timer(
    timer_id: UUID,
    payload: TimerUpdate,
    request: Request,
    db: Session = Depends(get_db),
) -> TimerOut:
    username = request.state.username
    try:
        timer = timers_service.update_timer(db, username, timer_id, payload)
    except ValueError as exc:
        if str(exc) == "duplicate_name":
            raise HTTPException(status_code=409, detail="Timer name already exists")
        raise

    if timer is None:
        raise HTTPException(status_code=404, detail="Timer not found")
    return TimerOut.model_validate(timer)


@router.delete("/{timer_id}", status_code=204)
def delete_timer(
    timer_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> Response:
    username = request.state.username
    deleted = timers_service.archive_timer(db, username, timer_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Timer not found")
    return Response(status_code=204)
