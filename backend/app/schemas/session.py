from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    timer_id: UUID
    start_at: datetime
    end_at: datetime | None
    duration_seconds: int | None
    client_tz: str
    day_date: date
    day_of_week: int


class ActiveSessionResponse(BaseModel):
    active_session: SessionOut | None


class StartTimerRequest(BaseModel):
    client_tz: str
    started_at_client: datetime | None = None


class StartTimerResponse(BaseModel):
    stopped_session: SessionOut | None
    active_session: SessionOut


class StopTimerRequest(BaseModel):
    stopped_at_client: datetime | None = None


class StopTimerResponse(BaseModel):
    stopped_session: SessionOut | None


class SessionList(BaseModel):
    sessions: list[SessionOut]


class DaySchedule(BaseModel):
    day_date: date
    sessions: list[SessionOut]


class WeekScheduleDay(BaseModel):
    day_date: date
    sessions: list[SessionOut]


class WeekSchedule(BaseModel):
    week_start: date
    days: list[WeekScheduleDay]
