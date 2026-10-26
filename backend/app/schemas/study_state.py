from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.session import SessionOut
from app.schemas.timer import TimerOut


class StudyClock(BaseModel):
    username: str
    revision: int
    server_now: datetime
    study_timezone: str
    day_date: date
    day_start_at: datetime
    day_end_at: datetime
    lease_expires_at: datetime | None


class StudyTimerOut(TimerOut):
    completed_today_seconds: int


class StudyStateUnchanged(StudyClock):
    changed: Literal[False]


class StudyStateChanged(StudyClock):
    changed: Literal[True]
    active_session: SessionOut | None
    timers: list[StudyTimerOut]


class StudyHeartbeat(BaseModel):
    active_session_id: UUID
