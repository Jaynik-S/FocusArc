import { useMemo, useState } from "react";

import { getUsername } from "../api/apiClient";
import PrimaryNav from "../components/PrimaryNav";
import TopBar from "../components/TopBar";
import { useSessions } from "../hooks/useSessions";
import { useTimers } from "../hooks/useTimers";
import {
  formatDateShort,
  formatTime,
  getClientTimezone,
  getLocalDateString,
} from "../utils/date";
import { formatDurationShort } from "../utils/time";

const getDateOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const HistoryPage = () => {
  const username = useMemo(() => getUsername(), []);
  const clientTz = useMemo(() => getClientTimezone(), []);
  const [fromDate, setFromDate] = useState(() =>
    getLocalDateString(getDateOffset(-6), clientTz)
  );
  const [toDate, setToDate] = useState(() =>
    getLocalDateString(new Date(), clientTz)
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
          dateLabel: formatDateShort(
            new Date(`${session.day_date}T00:00:00`),
            clientTz
          ),
          timeLabel: `${formatTime(start, clientTz)} - ${formatTime(
            end,
            clientTz
          )}`,
          durationLabel: formatDurationShort(durationSeconds),
        };
      });
  }, [sessionsState.sessions, timerMap, clientTz]);

  return (
    <div className="page">
      <TopBar username={username} />
      <PrimaryNav />
      <div className="card">
        <div className="card-header">
          <h2>History</h2>
          <p>Review past sessions by date and course.</p>
        </div>
        <div className="card-body filter-block">
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
          <div className="chip-row">
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
      </div>
      <div className="card">
        <div className="card-header">
          <h3>Sessions</h3>
          <p>{fromDate} to {toDate}</p>
        </div>
        <div className="card-body">
          {sessionsState.loading ? <div>Loading sessions...</div> : null}
          {sessionsState.error ? (
            <div className="error">{sessionsState.error}</div>
          ) : null}
          {!sessionsState.loading && rows.length === 0 ? (
            <div>No sessions in this range.</div>
          ) : null}
          <div className="session-list">
            {rows.map((row) => (
              <div className="session-row" key={row.id}>
                <div>
                  <div className="session-title">
                    <span className="dot" style={{ background: row.color }} />
                    {row.name}
                  </div>
                  <div className="session-meta">
                    {row.dateLabel} · {row.timeLabel}
                  </div>
                </div>
                <div className="session-duration">{row.durationLabel}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
