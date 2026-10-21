import { CSSProperties, memo, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTimerRuntime } from "../../context/TimerRuntimeContext";
import { useAnalytics } from "../../hooks/useAnalytics";
import { useReportingTimers } from "../../hooks/useReportingTimers";
import { isValidHexColor } from "../../utils/color";
import { validateAnalyticsRange } from "../../utils/date";
import { formatDuration, formatDurationShort } from "../../utils/time";
import ActivityHeatmap from "./ActivityHeatmap";
import AnalyticsFilters, { AnalyticsFiltersValue } from "./AnalyticsFilters";
import HourlyDistribution from "./HourlyDistribution";
import WeeklyTrend from "./WeeklyTrend";

const Calendar = memo(ActivityHeatmap);
const Hours = memo(HourlyDistribution);
const Trend = memo(WeeklyTrend);

export default function StatsOverview({ filters, onChange, today, clientTz }: { filters: AnalyticsFiltersValue; onChange: (value: AnalyticsFiltersValue) => void; today: string; clientTz: string }) {
  const timers = useReportingTimers();
  const { activeSession } = useTimerRuntime();
  const invalidRange = validateAnalyticsRange(filters.from, filters.to, today);
  const analytics = useAnalytics(filters.from, filters.to, clientTz, filters.timerId, activeSession?.id ?? null, !invalidRange);
  const navigate = useNavigate();
  const selectDay = useCallback((date: string) => {
    const params = new URLSearchParams({ from: date, to: date, date_basis: "activity", client_tz: clientTz });
    if (filters.timerId) params.set("timer_id", filters.timerId);
    navigate(`/history?${params}`);
  }, [clientTz, filters.timerId, navigate]);
  const data = analytics.data;
  const selectedCourse = timers.timers.find((timer) => timer.id === filters.timerId);
  const accent = selectedCourse && isValidHexColor(selectedCourse.color) ? selectedCourse.color : "var(--primary)";
  const pattern = useMemo(() => {
    if (!data || !data.summary.recorded_seconds) return null;
    const weekdays = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
    data.daily.forEach((day) => {
      const index = (new Date(`${day.day_date}T00:00:00Z`).getUTCDay() + 6) % 7;
      weekdays[index].total += day.recorded_seconds;
      weekdays[index].count += 1;
    });
    const averages = weekdays.map((day) => day.count ? day.total / day.count : 0);
    const best = Math.max(...averages);
    const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].filter((_, index) => averages[index] === best);
    return `${names.join(", ")} ${names.length === 1 ? "has" : "have"} your highest daily average: ${formatDurationShort(best)}. Zero days are included.`;
  }, [data]);

  return <div className="analytics-overview" style={{ "--analytics-accent": accent } as CSSProperties}>
    <AnalyticsFilters value={filters} onChange={onChange} timers={timers.timers} loading={timers.loading} today={today} clientTz={clientTz} />
    {timers.error ? <div className="error" role="alert">Course names could not load. {timers.error} <button className="link-button" onClick={timers.reload}>Retry courses</button></div> : null}
    {invalidRange ? <p className="error" role="alert">{invalidRange}</p> : null}
    {activeSession ? <p className="analytics-help" role="status">A timer is running. Its activity will appear when the session is completed.</p> : null}
    {analytics.error ? <div className="error" role="alert">{analytics.error} <button className="link-button" onClick={analytics.reload}>Retry analytics</button></div> : null}
    {analytics.loading ? <div className="analytics-loading" role="status" aria-live="polite"><p>Loading study analytics…</p><div /><div /></div> : null}
    {data ? <>
      <dl className="analytics-summary" aria-label="Study summary">
        <div><dt>Recorded time</dt><dd title={formatDuration(data.summary.recorded_seconds)}>{formatDurationShort(data.summary.recorded_seconds)}</dd><span>{data.summary.session_count} completed {data.summary.session_count === 1 ? "session" : "sessions"}</span></div>
        <div><dt>Active days</dt><dd>{data.summary.active_days}<small> / {data.summary.day_count}</small></dd><span>{data.summary.consistency_percent.toFixed(1)}% consistency</span></div>
        <div><dt>Daily average</dt><dd title={formatDuration(data.summary.average_seconds_per_day)}>{formatDurationShort(data.summary.average_seconds_per_day)}</dd><span>Including zero days</span></div>
      </dl>
      {data.summary.session_count === 0 ? <p className="analytics-empty">No completed sessions in this range. Complete a course timer session or choose another range to see your study patterns.</p> : null}
      <Calendar days={data.daily} onSelectDay={selectDay} />
      <div className="analytics-chart-grid"><Trend weeks={data.weekly} comparison={data.comparison} /><Hours hours={data.hourly} /></div>
      <div className="analytics-footnote"><p>{pattern ?? "Consistency is the share of selected calendar days with recorded study time, including today."}</p><button type="button" className="link-button" onClick={analytics.reload}>Refresh</button></div>
    </> : null}
  </div>;
}
