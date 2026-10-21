"""Pure, integer-precision allocation of completed sessions in a display zone."""
from __future__ import annotations

from bisect import bisect_right
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

UTC = timezone.utc
SECOND_US = 1_000_000


@dataclass(frozen=True)
class AnalyticsWindow:
    from_date: date
    to_date: date
    zone: ZoneInfo
    start_utc: datetime
    end_utc: datetime
    hour_bounds: tuple[datetime, ...]
    hours: tuple[int, ...]
    dates: tuple[date, ...]


@dataclass
class IntervalAllocation:
    recorded_seconds: int
    timed_seconds: int
    daily: dict[date, tuple[int, int]]
    hourly: list[int]


def _microseconds(delta: timedelta) -> int:
    return (delta.days * 86400 + delta.seconds) * SECOND_US + delta.microseconds


def _transition_between(start: datetime, end: datetime, zone: ZoneInfo) -> datetime:
    """Find an IANA offset transition, whose timestamps have second precision."""
    offset = start.astimezone(zone).utcoffset()
    seconds = _microseconds(end - start) // SECOND_US
    low, high = 0, seconds
    while low + 1 < high:
        middle = (low + high) // 2
        if (start + timedelta(seconds=middle)).astimezone(zone).utcoffset() == offset:
            low = middle
        else:
            high = middle
    return start + timedelta(seconds=high)


def build_window(from_date: date, to_date: date, client_tz: str) -> AnalyticsWindow:
    """Build reusable UTC day/hour boundaries only for the selected calendar range.

    Round trips reject nonexistent wall hours and retain both valid folds. Offset
    transitions also split bins, including changes at a fractional hour or midnight.
    IANA transitions are separated by more than one hour; scan UTC hours to locate
    them, then bisect to their exact second rather than assuming one-hour DST.
    """
    zone = ZoneInfo(client_tz)
    count = (to_date - from_date).days + 1
    midnights = [
        tuple(datetime.combine(from_date + timedelta(days=i), time.min, zone)
              .replace(fold=fold).astimezone(UTC) for fold in (0, 1))
        for i in range(count + 1)
    ]
    # Midnight can repeat and the clock can return to the previous local date.
    # Query a containing UTC envelope, then filter every segment by its real date.
    start, end = min(midnights[0]), max(midnights[-1])
    boundaries = {start, end}
    boundaries.update(instant for pair in midnights for instant in pair if start < instant < end)
    for offset in range(count):
        day = from_date + timedelta(days=offset)
        for hour in range(24):
            wall = datetime.combine(day, time(hour))
            for fold in (0, 1):
                instant = wall.replace(tzinfo=zone, fold=fold).astimezone(UTC)
                if start < instant < end and instant.astimezone(zone).replace(tzinfo=None) == wall:
                    boundaries.add(instant)

    cursor = start
    while cursor < end:
        following = min(cursor + timedelta(hours=1), end)
        if cursor.astimezone(zone).utcoffset() != following.astimezone(zone).utcoffset():
            boundaries.add(_transition_between(cursor, following, zone))
        cursor = following
    hour_bounds = tuple(sorted(boundaries))
    hours = tuple(instant.astimezone(zone).hour for instant in hour_bounds[:-1])
    dates = tuple(instant.astimezone(zone).date() for instant in hour_bounds[:-1])
    return AnalyticsWindow(from_date, to_date, zone, start, end, hour_bounds, hours, dates)


def allocate_interval(
    start_at: datetime,
    end_at: datetime,
    duration_seconds: int | None,
    window: AnalyticsWindow,
) -> IntervalAllocation:
    """Allocate a single session, conserving cumulative floors in every drilldown.

    Stored seconds weight recorded totals; actual UTC overlap supplies timed totals.
    The daily mapping contains every touching day, even when both allocations are 0.
    """
    start, end = start_at.astimezone(UTC), end_at.astimezone(UTC)
    recorded = duration_seconds or 0
    daily: dict[date, tuple[int, int]] = {}
    hourly = [0] * 24
    if start == end:
        day = start.astimezone(window.zone).date()
        if window.from_date <= day <= window.to_date:
            daily[day] = (recorded, 0)
            return IntervalAllocation(recorded, 0, daily, hourly)
        return IntervalAllocation(0, 0, daily, hourly)

    clipped_start, clipped_end = max(start, window.start_utc), min(end, window.end_utc)
    if clipped_start >= clipped_end:
        return IntervalAllocation(0, 0, daily, hourly)
    elapsed = _microseconds(end - start)

    def portion(left: datetime, right: datetime) -> tuple[int, int]:
        a = max(0, min(elapsed, _microseconds(left - start)))
        b = max(0, min(elapsed, _microseconds(right - start)))
        return recorded * b // elapsed - recorded * a // elapsed, b // SECOND_US - a // SECOND_US

    index = max(0, bisect_right(window.hour_bounds, clipped_start) - 1)
    while index < len(window.hours) and window.hour_bounds[index] < clipped_end:
        left, right = max(clipped_start, window.hour_bounds[index]), min(clipped_end, window.hour_bounds[index + 1])
        day = window.dates[index]
        if left < right and window.from_date <= day <= window.to_date:
            recorded_part, timed_part = portion(left, right)
            prior_recorded, prior_timed = daily.get(day, (0, 0))
            daily[day] = (prior_recorded + recorded_part, prior_timed + timed_part)
            hourly[window.hours[index]] += timed_part
        index += 1
    total_recorded = sum(value[0] for value in daily.values())
    total_timed = sum(hourly)
    return IntervalAllocation(total_recorded, total_timed, daily, hourly)
