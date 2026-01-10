import { useMemo, useState } from "react";

import { AverageEntry, TimerTotal } from "../api/types";
import { useAverages } from "../hooks/useAverages";
import { useDayStats } from "../hooks/useDayStats";
import { useStatsWeek } from "../hooks/useStatsWeek";
import { useTimers } from "../hooks/useTimers";
import {
  formatWeekday,
  getClientTimezone,
  getLocalDateString,
  getWeekStartDateString,
} from "../utils/date";
import { formatDuration, formatDurationShort } from "../utils/time";

const sumTotals = (totals: TimerTotal[]) =>
  totals.reduce((acc, total) => acc + total.total_seconds, 0);

const getMax = (values: number[]) =>
  values.length ? Math.max(...values) : 0;

const StatsPage = () => {
  const clientTz = useMemo(() => getClientTimezone(), []);
  const [dayDate, setDayDate] = useState(() =>
    getLocalDateString(new Date(), clientTz)
  );
  const [weekStart, setWeekStart] = useState(() =>
    getWeekStartDateString(new Date(), clientTz)
  );
  const [avgDays, setAvgDays] = useState(14);

  const timersState = useTimers();
  const dayStats = useDayStats(dayDate);
  const weekStats = useStatsWeek(weekStart);
  const averages = useAverages(avgDays);

  const timerMap = useMemo(() => {
    return new Map(timersState.timers.map((timer) => [timer.id, timer]));
  }, [timersState.timers]);

  const dayTotals = useMemo(() => {
    const totalsMap = new Map(
      dayStats.totals.map((total) => [total.timer_id, total.total_seconds])
    );
    if (timersState.timers.length === 0) {
      return dayStats.totals.map((total) => ({
        timerId: total.timer_id,
        name: "Timer",
        color: "#1d4ed8",
        totalSeconds: total.total_seconds,
      }));
    }
    return timersState.timers.map((timer) => ({
      timerId: timer.id,
      name: timer.name,
      color: timer.color,
      totalSeconds: totalsMap.get(timer.id) ?? 0,
    }));
  }, [dayStats.totals, timersState.timers]);

  const dayMax = useMemo(
    () => getMax(dayTotals.map((item) => item.totalSeconds)),
    [dayTotals]
  );

  const weekRows = useMemo(() => {
    return (weekStats.data?.daily ?? []).map((day) => {
      const totalSeconds = sumTotals(day.totals);
      return {
        dayDate: day.day_date,
        totalSeconds,
        totals: day.totals,
      };
    });
  }, [weekStats.data]);

  const weekMax = useMemo(
    () => getMax(weekRows.map((row) => row.totalSeconds)),
    [weekRows]
  );

  const averageRows = useMemo(() => {
    const entries = averages.data?.averages ?? [];
    if (timersState.timers.length === 0) {
      return entries.map((entry) => ({
        timerId: entry.timer_id,
        name: "Timer",
        color: "#1d4ed8",
        avgSeconds: entry.avg_seconds_per_day,
      }));
    }
    const avgMap = new Map(
      entries.map((entry: AverageEntry) => [entry.timer_id, entry.avg_seconds_per_day])
    );
    return timersState.timers.map((timer) => ({
      timerId: timer.id,
      name: timer.name,
      color: timer.color,
      avgSeconds: avgMap.get(timer.id) ?? 0,
    }));
  }, [averages.data, timersState.timers]);

  const avgMax = useMemo(
    () => getMax(averageRows.map((row) => row.avgSeconds)),
    [averageRows]
  );

  return (
    <div className="page minimal-page">
      <div className="page-header">
        <div>
          <h1>Stats</h1>
          <p className="muted">Daily totals, weekly trends, and averages.</p>
        </div>
      </div>
      <div className="panel stats-card">
        <div className="panel-header panel-header-row">
          <div>
            <h3>Day totals</h3>
            <p>{dayDate}</p>
          </div>
          <label className="field">
            <span>Day</span>
            <input
              type="date"
              value={dayDate}
              onChange={(event) => setDayDate(event.target.value)}
            />
          </label>
        </div>
        <div className="panel-body">
          {dayStats.loading ? <div>Loading totals...</div> : null}
          {dayStats.error ? <div className="error">{dayStats.error}</div> : null}
          {dayTotals.length === 0 ? (
            <div>No totals yet.</div>
          ) : (
            <div className="stats-list">
              {dayTotals.map((item) => {
                const percent = dayMax ? (item.totalSeconds / dayMax) * 100 : 0;
                return (
                  <div className="stats-row" key={item.timerId}>
                    <div className="stats-row-header">
                      <span className="dot" style={{ background: item.color }} />
                      <span>{item.name}</span>
                      <span className="stats-value">
                        {formatDuration(item.totalSeconds)}
                      </span>
                    </div>
                    <div className="bar-track">
                      <span
                        className="bar-fill"
                        style={{ width: `${percent}%`, background: item.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="panel stats-card">
        <div className="panel-header panel-header-row">
          <div>
            <h3>Week totals</h3>
            <p>Week of {weekStart}</p>
          </div>
          <label className="field">
            <span>Week start</span>
            <input
              type="date"
              value={weekStart}
              onChange={(event) => setWeekStart(event.target.value)}
            />
          </label>
        </div>
        <div className="panel-body">
          {weekStats.loading ? <div>Loading week totals...</div> : null}
          {weekStats.error ? <div className="error">{weekStats.error}</div> : null}
          {weekRows.length === 0 ? (
            <div>No week totals yet.</div>
          ) : (
            <div className="week-stats-list">
              {weekRows.map((row) => {
                const percent = weekMax ? (row.totalSeconds / weekMax) * 100 : 0;
                const dateObj = new Date(`${row.dayDate}T00:00:00`);
                return (
                  <div className="week-stats-day" key={row.dayDate}>
                    <div className="week-stats-header">
                      <div>
                        <div className="week-stats-title">
                          {formatWeekday(dateObj, clientTz)} {row.dayDate}
                        </div>
                        <div className="week-stats-total">
                          {formatDurationShort(row.totalSeconds)} total
                        </div>
                      </div>
                      <div className="week-stats-value">
                        {formatDuration(row.totalSeconds)}
                      </div>
                    </div>
                    <div className="bar-track">
                      <span className="bar-fill" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="week-stats-timers">
                      {row.totals.length === 0 ? (
                        <div className="timeline-empty">No sessions</div>
                      ) : (
                        row.totals.map((total) => {
                          const timer = timerMap.get(total.timer_id);
                          return (
                            <div className="week-stats-row" key={total.timer_id}>
                              <span
                                className="dot"
                                style={{ background: timer?.color ?? "#1d4ed8" }}
                              />
                              <span>{timer?.name ?? "Timer"}</span>
                              <span className="stats-value">
                                {formatDurationShort(total.total_seconds)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="panel stats-card">
        <div className="panel-header panel-header-row">
          <div>
            <h3>Averages</h3>
            <p>Average per day across the last {avgDays} days.</p>
          </div>
          <label className="field">
            <span>Days</span>
            <input
              type="number"
              min={1}
              max={365}
              value={avgDays}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                if (Number.isNaN(nextValue)) {
                  setAvgDays(1);
                  return;
                }
                setAvgDays(Math.min(365, Math.max(1, nextValue)));
              }}
            />
          </label>
        </div>
        <div className="panel-body">
          {averages.loading ? <div>Loading averages...</div> : null}
          {averages.error ? <div className="error">{averages.error}</div> : null}
          {averageRows.length === 0 ? (
            <div>No averages yet.</div>
          ) : (
            <div className="stats-list">
              {averageRows.map((row) => {
                const percent = avgMax ? (row.avgSeconds / avgMax) * 100 : 0;
                return (
                  <div className="stats-row" key={row.timerId}>
                    <div className="stats-row-header">
                      <span className="dot" style={{ background: row.color }} />
                      <span>{row.name}</span>
                      <span className="stats-value">
                        {formatDuration(row.avgSeconds)}
                      </span>
                    </div>
                    <div className="bar-track">
                      <span
                        className="bar-fill"
                        style={{ width: `${percent}%`, background: row.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsPage;
