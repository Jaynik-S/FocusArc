from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel


class TimerTotal(BaseModel):
    timer_id: UUID
    total_seconds: int


class EndDayRequest(BaseModel):
    client_tz: str
    day_date: date


class EndDayResponse(BaseModel):
    ended_day_date: date
    finalized: bool
    totals: list[TimerTotal]
