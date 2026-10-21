from datetime import date, datetime, timedelta, timezone

import pytest

from app.services.analytics_time import allocate_interval, build_window


def utc(value: str) -> datetime:
    return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)


def allocation(start, end, recorded, first, last, zone="UTC"):
    window = build_window(date.fromisoformat(first), date.fromisoformat(last), zone)
    return allocate_interval(utc(start), utc(end), recorded, window)


def test_adjusted_midnight_uses_recorded_weight_and_actual_hour_overlap():
    result = allocation("2026-01-01T23:30", "2026-01-02T00:30", 7200,
                        "2026-01-01", "2026-01-02")
    assert result.recorded_seconds == 7200
    assert result.timed_seconds == 3600
    assert result.daily == {date(2026, 1, 1): (3600, 1800), date(2026, 1, 2): (3600, 1800)}
    assert result.hourly[23] == result.hourly[0] == 1800
    assert sum(result.hourly) == 3600


def test_fractional_allocation_is_conserved_across_day_drilldowns():
    start, end = utc("2026-01-01T23:59:59.500000"), utc("2026-01-02T00:00:01")
    whole = allocate_interval(start, end, 5, build_window(date(2026, 1, 1), date(2026, 1, 2), "UTC"))
    first = allocate_interval(start, end, 5, build_window(date(2026, 1, 1), date(2026, 1, 1), "UTC"))
    second = allocate_interval(start, end, 5, build_window(date(2026, 1, 2), date(2026, 1, 2), "UTC"))
    assert whole.daily == {date(2026, 1, 1): (1, 0), date(2026, 1, 2): (4, 1)}
    assert first.recorded_seconds + second.recorded_seconds == whole.recorded_seconds == 5
    assert first.timed_seconds + second.timed_seconds == whole.timed_seconds == 1
    assert sum(whole.hourly) == 1


@pytest.mark.parametrize("recorded", [0, None])
def test_missing_or_zero_recorded_still_has_timed_overlap_and_touching_days(recorded):
    result = allocation("2026-01-01T23:30", "2026-01-02T00:30", recorded,
                        "2026-01-01", "2026-01-02")
    assert result.recorded_seconds == 0
    assert result.timed_seconds == 3600
    assert set(result.daily) == {date(2026, 1, 1), date(2026, 1, 2)}


def test_zero_length_adjustment_belongs_only_to_local_start_day():
    result = allocation("2026-01-02T04:30", "2026-01-02T04:30", 100,
                        "2026-01-01", "2026-01-01", "America/Toronto")
    assert result.daily == {date(2026, 1, 1): (100, 0)}
    assert result.recorded_seconds == 100
    assert result.timed_seconds == sum(result.hourly) == 0


@pytest.mark.parametrize("first,last", [("2026-01-01", "2026-01-01"), ("2026-01-03", "2026-01-03")])
def test_half_open_endpoints_exclude_nonoverlap(first, last):
    result = allocation("2026-01-02T00:00", "2026-01-03T00:00", 86400, first, last)
    assert result.daily == {}
    assert result.recorded_seconds == result.timed_seconds == 0


@pytest.mark.parametrize("day,zone,start,end,want_hours,want_total", [
    ("2026-03-08", "America/Toronto", "2026-03-08T06:30", "2026-03-08T07:30", {1: 1800, 2: 0, 3: 1800}, 3600),
    ("2026-11-01", "America/Toronto", "2026-11-01T04:30", "2026-11-01T07:30", {0: 1800, 1: 7200, 2: 1800}, 10800),
    ("2026-01-02", "Asia/Kathmandu", "2026-01-01T18:15", "2026-01-01T19:45", {0: 3600, 1: 1800}, 5400),
    ("2026-10-04", "Australia/Lord_Howe", "2026-10-03T15:00", "2026-10-03T16:00", {1: 1800, 2: 1800}, 3600),
    ("2026-04-05", "Australia/Lord_Howe", "2026-04-04T14:30", "2026-04-04T16:00", {1: 3600, 2: 1800}, 5400),
    ("2018-11-04", "America/Sao_Paulo", "2018-11-04T03:00", "2018-11-04T04:30", {0: 0, 1: 3600, 2: 1800}, 5400),
])
def test_hour_bins_follow_real_dst_and_fractional_offset_time(day, zone, start, end, want_hours, want_total):
    result = allocation(start, end, want_total, day, day, zone)
    assert result.timed_seconds == sum(result.hourly) == want_total
    assert {hour: result.hourly[hour] for hour in want_hours} == want_hours


def test_long_interval_clips_to_requested_day():
    result = allocation("2020-01-01T00:00", "2027-01-01T00:00", 220924800,
                        "2026-01-01", "2026-01-01")
    assert result.recorded_seconds == result.timed_seconds == 86400
    assert result.hourly == [3600] * 24


def test_skipped_calendar_day_has_no_elapsed_time():
    window = build_window(date(2011, 12, 29), date(2011, 12, 31), "Pacific/Apia")
    result = allocate_interval(window.start_utc, window.end_utc, 172800, window)
    assert result.daily == {date(2011, 12, 29): (86400, 86400), date(2011, 12, 31): (86400, 86400)}


def test_midnight_rollback_allocates_to_actual_repeated_local_date():
    result = allocation("1988-10-30T02:00", "1988-10-30T02:30", 1800,
                        "1988-10-29", "1988-10-30", "America/St_Johns")
    assert result.daily == {date(1988, 10, 29): (1800, 1800)}
    assert result.hourly[22] == 1800


def test_single_day_query_includes_repeated_date_after_its_first_midnight():
    result = allocation("1988-10-30T02:00", "1988-10-30T02:30", 1800,
                        "1988-10-29", "1988-10-29", "America/St_Johns")
    assert result.daily == {date(1988, 10, 29): (1800, 1800)}
    assert result.recorded_seconds == result.timed_seconds == 1800


@pytest.mark.parametrize("end", ["1988-10-30T02:30", "1988-10-30T02:00"])
def test_nonselected_repeated_date_is_excluded_from_envelope(end):
    result = allocation("1988-10-30T02:00", end, 1800,
                        "1988-10-30", "1988-10-30", "America/St_Johns")
    assert result.daily == {}
    assert result.recorded_seconds == result.timed_seconds == sum(result.hourly) == 0
