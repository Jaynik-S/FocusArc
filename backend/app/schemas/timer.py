from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TimerBase(BaseModel):
    name: str = Field(min_length=1, max_length=32)
    color: str = Field(min_length=7, max_length=7, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: str = Field(default="book", min_length=1, max_length=32)


class TimerCreate(TimerBase):
    pass


class TimerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=32)
    color: str | None = Field(
        default=None, min_length=7, max_length=7, pattern=r"^#[0-9A-Fa-f]{6}$"
    )
    icon: str | None = Field(default=None, min_length=1, max_length=32)
    is_archived: bool | None = None


class TimerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    color: str
    icon: str
    cycle_total_seconds: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class TimerList(BaseModel):
    timers: list[TimerOut]
