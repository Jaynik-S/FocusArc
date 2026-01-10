import { CSSProperties, useMemo, useState } from "react";

import { useSessions } from "../hooks/useSessions";
import { useTimers } from "../hooks/useTimers";
import { getContrastColor, getMutedTextColor } from "../utils/color";
import {
  formatDateShort,
  formatTime,
  getClientTimezone,
  getLocalDateString,
} from "../utils/date";
import { formatDuration } from "../utils/time";

const getDateOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const HistoryPage = () => {
  const clientTz = useMemo(() => getClientTimezone(), []);
  const [fromDate, setFromDate] = useState(() =>
    getLocalDateString(getDateOffset(-1), clientTz)
  );
  const [toDate, setToDate] = useState(() =>
    getLocalDateString(getDateOffset(0), clientTz)
  );
  const [selectedTimerId, setSelectedTimerId] = useState<string | null>(null);

  const timersState = useTimers();
  const sessionsState = useSessions(fromDate, toDate, selectedTimerId);

  const timerMap = useMemo(() => {
    return new Map(timersState.timers.map((timer) => [timer.id, timer]));
  }, [timersState.timers]);

  const rows = useMemo(() => {
    return [...sessionsState.sessions]
      .sort((a, b) => b.start_at.localeCompare(a.start_at))
      .map((session) => {
        const timer = timerMap.get(session.timer_id);
        const start = new Date(session.start_at);
        const end = session.end_at ? new Date(session.end_at) : new Date();
        const durationSeconds =
          session.duration_seconds ??
          Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
        return {
          id: session.id,
          name: timer?.name ?? "Timer",
          color: timer?.color ?? "#1d4ed8",
          textColor: getContrastColor(timer?.color ?? "#1d4ed8"),
          mutedColor: getMutedTextColor(timer?.color ?? "#1d4ed8"),
          dateLabel: formatDateShort(
            new Date(`${session.day_date}T00:00:00`),
            clientTz
          ),
          timeLabel: `${formatTime(start, clientTz)} - ${formatTime(
            end,
            clientTz
          )}`,
          durationLabel: formatDuration(durationSeconds),
        };
      });
  }, [sessionsState.sessions, timerMap, clientTz]);

  const totalsByTimer = useMemo(() => {
    const totals = new Map<string, number>();
    sessionsState.sessions.forEach((session) => {
      const start = new Date(session.start_at);
      const end = session.end_at ? new Date(session.end_at) : new Date();
      const durationSeconds =
        session.duration_seconds ??
        Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
      totals.set(
        session.timer_id,
        (totals.get(session.timer_id) ?? 0) + durationSeconds
      );
    });
    return totals;
  }, [sessionsState.sessions]);

  const summaryRows = useMemo(() => {
    if (selectedTimerId) {
      const timer = timerMap.get(selectedTimerId);
      if (!timer) {
        return [];
      }
      return [
        {
          id: timer.id,
          name: timer.name,
          totalSeconds: totalsByTimer.get(timer.id) ?? 0,
          color: timer.color ?? "#1d4ed8",
          textColor: getContrastColor(timer.color ?? "#1d4ed8"),
        },
      ];
    }
    return timersState.timers.map((timer) => ({
      id: timer.id,
      name: timer.name,
      totalSeconds: totalsByTimer.get(timer.id) ?? 0,
      color: timer.color ?? "#1d4ed8",
      textColor: getContrastColor(timer.color ?? "#1d4ed8"),
    }));
  }, [selectedTimerId, timerMap, timersState.timers, totalsByTimer]);

  return (
    <div className="page minimal-page">
      <div className="page-header">
        <div>
          <h1>History</h1>
          <p className="muted">Review sessions by date and timer.</p>
        </div>
      </div>
      <div className="panel">
        <div className="filter-block">
          <label className="field">
            <span>From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>
        </div>
        <div className="chip-row history-chip-row">
          <button
            className={`chip ${selectedTimerId ? "" : "chip-active"}`}
            type="button"
            onClick={() => setSelectedTimerId(null)}
          >
            All timers
          </button>
          {timersState.timers.map((timer) => (
            <button
              key={timer.id}
              className={`chip ${
                selectedTimerId === timer.id ? "chip-active" : ""
              }`}
              type="button"
              onClick={() => setSelectedTimerId(timer.id)}
            >
              {timer.name}
            </button>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">
            <h3 style={{ fontSize: '22px', marginBottom: '4px' }}>Totals</h3>
        </div>
        <div className="panel-body">
          {summaryRows.length ? (
            <div className="history-summary-grid">
              {summaryRows.map((row) => (
                <div
                  className="history-summary-chip"
                  key={row.id}
                  style={{ background: row.color, color: row.textColor }}
                >
                  <span className="history-summary-label">{row.name}</span>
                  <span className="history-summary-value">
                    {formatDuration(row.totalSeconds)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">No timers in this range.</div>
          )}
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <h3 style={{ fontSize: '22px', marginBottom: '4px' }}>Sessions</h3>
        </div>
        <div className="panel-body">
          {sessionsState.loading ? <div>Loading sessions...</div> : null}
          {sessionsState.error ? (
            <div className="error">{sessionsState.error}</div>
          ) : null}
          {!sessionsState.loading && rows.length === 0 ? (
            <div>No sessions in this range.</div>
          ) : null}
          <div className="session-list">
            {rows.map((row) => (
              <div
                className="session-row"
                key={row.id}
                style={
                  {
                    background: row.color,
                    color: row.textColor,
                    borderColor: row.color,
                    "--session-muted": row.mutedColor,
                  } as CSSProperties
                }
              >
                <div className="session-name">
                  <span className="dot" style={{ background: row.textColor }} />
                  {row.name}
                </div>
                <div className="session-date-duration">
                  {row.dateLabel} · {row.timeLabel}
                </div>
                <div className="session-time">{row.durationLabel}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
