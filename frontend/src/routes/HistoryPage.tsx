import { CSSProperties, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import * as TimerRuntime from "../context/TimerRuntimeContext";

import { useSessions } from "../hooks/useSessions";
import { useReportingTimers } from "../hooks/useReportingTimers";
import { useSessionAdjustment } from "../hooks/useSessionAdjustment";
import SessionAdjustmentControls from "../components/SessionAdjustmentControls";
import { getContrastColor, getMutedTextColor } from "../utils/color";
import {
  formatCivilDate,
  formatTime,
  getLocalDateString,
  isCivilDate,
  shiftCivilDate,
  validateAnalyticsRange,
} from "../utils/date";
import { formatDuration } from "../utils/time";

const HistoryPage = () => {
  const runtime = "useOptionalTimerRuntime" in TimerRuntime ? TimerRuntime.useOptionalTimerRuntime() : undefined;
  const accountZone = runtime?.timeZone ?? "America/Toronto";
  const nowMs = runtime?.nowMs ?? Date.now();
  const today = runtime?.today ?? getLocalDateString(new Date(nowMs), accountZone);
  const commandsDisabled = runtime?.synced === false || Boolean(runtime?.busy);
  const adjustment = useSessionAdjustment();
  const [params, setParams] = useSearchParams();
  const activityMode = params.get("date_basis") === "activity";
  const requestedZone = activityMode ? params.get("client_tz") ?? accountZone : accountZone;
  const zoneValid = useMemo(() => {
    try { new Intl.DateTimeFormat("en", { timeZone: requestedZone }); return true; } catch { return false; }
  }, [requestedZone]);
  const clientTz = zoneValid ? requestedZone : accountZone;
  const fromDate = params.get("from") ?? shiftCivilDate(today, -1);
  const toDate = params.get("to") ?? today;
  const selectedTimerId = params.get("timer_id");
  const updateFilter = (key: string, value: string | null) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (value === null) next.delete(key); else next.set(key, value);
    return next;
  });
  const rangeError = !zoneValid ? "The linked time zone is invalid. Switch to saved-date history to continue." : activityMode
    ? validateAnalyticsRange(fromDate, toDate, getLocalDateString(new Date(nowMs), clientTz))
    : !isCivilDate(fromDate) || !isCivilDate(toDate) || fromDate > toDate ? "Choose a valid date range." : null;
  const timersState = useReportingTimers();
  const sessionsState = useSessions(fromDate, toDate, selectedTimerId, { dateBasis: activityMode ? "activity" : "saved", clientTz, enabled: !rangeError });

  const timerMap = useMemo(() => {
    return new Map(timersState.timers.map((timer) => [timer.id, timer]));
  }, [timersState.timers]);

  const rows = useMemo(() => {
    return [...sessionsState.sessions]
      .sort((a, b) => Date.parse(b.start_at) - Date.parse(a.start_at))
      .map((session) => {
        const timer = timerMap.get(session.timer_id);
        const start = new Date(session.start_at);
        const end = session.end_at ? new Date(session.end_at) : new Date(nowMs);
        const durationSeconds = activityMode ? session.range_recorded_seconds ?? 0 :
          session.duration_seconds ??
          Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
        return {
          session,
          id: session.id,
          name: `${timer?.name ?? "Timer"}${timer?.is_archived ? " (archived)" : ""}`,
          color: timer?.color ?? "#1d4ed8",
          textColor: getContrastColor(timer?.color ?? "#1d4ed8"),
          mutedColor: getMutedTextColor(timer?.color ?? "#1d4ed8"),
          dateLabel: formatCivilDate(activityMode ? getLocalDateString(start, clientTz) : session.day_date),
          timeLabel: `${formatTime(start, clientTz)} - ${formatTime(
            end,
            clientTz
          )}${activityMode && getLocalDateString(start, clientTz) !== getLocalDateString(end, clientTz) ? ` (${formatCivilDate(getLocalDateString(end, clientTz))})` : ""}`,
          durationLabel: formatDuration(durationSeconds),
          fullSessionLabel: activityMode ? `${formatDuration(session.duration_seconds ?? 0)} full session` : null,
        };
      });
  }, [sessionsState.sessions, timerMap, clientTz, activityMode, nowMs]);

  const totalsByTimer = useMemo(() => {
    const totals = new Map<string, number>();
    sessionsState.sessions.forEach((session) => {
      const start = new Date(session.start_at);
      const end = session.end_at ? new Date(session.end_at) : new Date(nowMs);
      const durationSeconds = activityMode ? session.range_recorded_seconds ?? 0 :
        session.duration_seconds ??
        Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
      totals.set(
        session.timer_id,
        (totals.get(session.timer_id) ?? 0) + durationSeconds
      );
    });
    return totals;
  }, [sessionsState.sessions, activityMode, nowMs]);

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
    return timersState.timers.filter((timer) => !timer.is_archived || totalsByTimer.has(timer.id)).map((timer) => ({
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
      {activityMode ? <div className="analytics-history-note"><p className="analytics-help">Activity dates in {clientTz}. Completed sessions only; durations show the time allocated within this range.</p><button className="link-button" onClick={() => setParams((current) => { const next = new URLSearchParams(current); next.delete("date_basis"); next.delete("client_tz"); return next; })}>View saved-date history</button></div> : null}
      {rangeError ? <p className="error" role="alert">{rangeError}</p> : null}
      {adjustment.error ? <p className="error" role="alert">{adjustment.error}</p> : null}
      {adjustment.status ? <p className="muted" role="status">{adjustment.status}</p> : null}
      {timersState.error ? <p className="error" role="alert">{timersState.error} <button className="link-button" onClick={timersState.reload}>Retry courses</button></p> : null}
      <div className="panel">
        <div className="filter-block">
          <label className="field">
            <span>From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => updateFilter("from", event.target.value)}
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => updateFilter("to", event.target.value)}
            />
          </label>
        </div>
        <div className="chip-row history-chip-row">
          <button
            className={`chip ${selectedTimerId ? "" : "chip-active"}`}
            type="button"
            onClick={() => updateFilter("timer_id", null)}
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
              onClick={() => updateFilter("timer_id", timer.id)}
            >
              {timer.name}{timer.is_archived ? " (archived)" : ""}
            </button>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <h2>Totals</h2>
        </div>
        <div className="panel-body">
          {sessionsState.loading ? <p>Loading totals...</p> : summaryRows.length ? (
            <div className="history-summary-grid">
              {summaryRows.map((row) => (
                <div
                  className="history-summary-chip"
                  key={row.id}
                  style={
                    {
                      "--timer-color": row.color,
                      "--timer-contrast": row.textColor,
                    } as CSSProperties
                  }
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
          <h2>Sessions</h2>
        </div>
        <div className="panel-body">
          {sessionsState.loading ? <div>Loading sessions...</div> : null}
          {sessionsState.error ? (
            <div className="error" role="alert">{sessionsState.error} <button className="link-button" onClick={sessionsState.reload}>Retry sessions</button></div>
          ) : null}
          {!rangeError && !sessionsState.error && !sessionsState.loading && rows.length === 0 ? (
            <div>No sessions in this range.</div>
          ) : null}
          <div className="session-list">
            {rows.map((row) => (
              <div
                className="session-row"
                key={row.id}
                style={
                  {
                    "--timer-color": row.color,
                    "--session-muted": row.mutedColor,
                  } as CSSProperties
                }
              >
                <div className="session-name">
                  <span className="dot" style={{ background: row.color }} />
                  {row.name}
                </div>
                <div className="session-date-duration">
                  {row.dateLabel} · {row.timeLabel}
                </div>
                <div className="session-time">{row.durationLabel}{row.fullSessionLabel ? <div className="analytics-help">{row.fullSessionLabel}</div> : null}
                  {row.session.end_at ? <SessionAdjustmentControls busy={adjustment.busy || commandsDisabled} onAdjust={(delta) => void adjustment.adjust(row.session, delta)} /> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
