from datetime import date

from pydantic import BaseModel, Field

from app.schemas.session import SessionOut


class AnalyticsRange(BaseModel):
    from_date: date = Field(alias="from")
    to: date
    client_tz: str


class AnalyticsSummary(BaseModel):
    recorded_seconds: int
    timed_seconds: int
    session_count: int
    active_days: int
    day_count: int
    consistency_percent: float
    average_seconds_per_day: float


class AnalyticsDay(BaseModel):
    day_date: date
    recorded_seconds: int
    timed_seconds: int
    session_count: int


class AnalyticsWeek(BaseModel):
    week_start: date
    recorded_seconds: int
    active_days: int
    is_partial: bool


class AnalyticsHour(BaseModel):
    hour: int
    timed_seconds: int


class AnalyticsComparison(BaseModel):
    previous_week_start: date
    current_week_start: date
    previous_seconds: int
    current_seconds: int
    delta_seconds: int
    delta_percent: float | None


class AnalyticsResponse(BaseModel):
    range: AnalyticsRange
    summary: AnalyticsSummary
    daily: list[AnalyticsDay]
    weekly: list[AnalyticsWeek]
    hourly: list[AnalyticsHour]
    comparison: AnalyticsComparison | None


class AnalyticsSession(SessionOut):
    range_recorded_seconds: int
    range_timed_seconds: int


class AnalyticsSessionsResponse(BaseModel):
    sessions: list[AnalyticsSession]
