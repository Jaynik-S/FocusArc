import { useEffect, useMemo, useState } from "react";

import { getUsername } from "../api/apiClient";
import { EndDayResponse, Timer } from "../api/types";
import EndDayButton from "../components/EndDayButton";
import PrimaryNav from "../components/PrimaryNav";
import TimerCard from "../components/TimerCard";
import TimerFormModal from "../components/TimerFormModal";
import TopBar from "../components/TopBar";
import { useActiveSession } from "../hooks/useActiveSession";
import { useDayStats } from "../hooks/useDayStats";
import { TimerFormValues, useTimers } from "../hooks/useTimers";
import { getClientTimezone, getLocalDateString } from "../utils/date";
import { formatDuration } from "../utils/time";

const TimersPage = () => {
  const username = useMemo(() => getUsername(), []);
  const clientTz = useMemo(() => getClientTimezone(), []);
  const [dayDate, setDayDate] = useState(() =>
    getLocalDateString(new Date(), clientTz)
  );
  const { timers, loading, error, createTimer, updateTimer, archiveTimer } =
    useTimers();
  const {
    activeSession,
    elapsedSeconds,
    loading: sessionLoading,
    busy,
    refresh: refreshSession,
    startTimer,
    stopTimer,
  } = useActiveSession();
  const {
    totals,
    loading: totalsLoading,
    error: totalsError,
    reload: reloadTotals,
  } = useDayStats(dayDate);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTimer, setEditingTimer] = useState<Timer | null>(null);
  const [actionError, setActionError] = useState("");
  const [endDaySummary, setEndDaySummary] = useState<EndDayResponse | null>(
    null
  );

  const activeTimer = useMemo(() => {
    if (!activeSession) {
      return null;
    }
    return timers.find((timer) => timer.id === activeSession.timer_id) ?? null;
  }, [activeSession, timers]);

  const elapsedLabel = formatDuration(elapsedSeconds);
  const activeLabel = activeTimer
    ? activeTimer.name
    : activeSession
      ? "Timer running"
      : "None running";

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDayDate(getLocalDateString(new Date(), clientTz));
    }, 60000);
    return () => window.clearInterval(interval);
  }, [clientTz]);

  useEffect(() => {
    setEndDaySummary(null);
  }, [dayDate]);

  const totalsMap = useMemo(() => {
    const map = new Map<string, number>();
    totals.forEach((total) => map.set(total.timer_id, total.total_seconds));
    return map;
  }, [totals]);

  const totalRows = useMemo(() => {
    return timers.map((timer) => ({
      timer,
      totalSeconds: totalsMap.get(timer.id) ?? 0,
    }));
  }, [timers, totalsMap]);

  const handleCreate = async (values: TimerFormValues) => {
    setActionError("");
    try {
      await createTimer(values);
      setCreateOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create timer");
    }
  };

  const handleUpdate = async (values: TimerFormValues) => {
    if (!editingTimer) {
      return;
    }
    setActionError("");
    try {
      await updateTimer(editingTimer.id, values);
      setEditingTimer(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update timer");
    }
  };

  const handleArchive = async (timer: Timer) => {
    setActionError("");
    try {
      await archiveTimer(timer.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to archive timer");
    }
  };

  const handleStart = async (timerId: string) => {
    setActionError("");
    try {
      await startTimer(timerId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to start timer");
    }
  };

  const handleStop = async () => {
    setActionError("");
    try {
      await stopTimer();
      reloadTotals();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to stop timer");
    }
  };

  const handleEndDay = (response: EndDayResponse) => {
    setEndDaySummary(response);
    reloadTotals();
    refreshSession();
  };

  return (
    <div className="page">
      <TopBar username={username} />
      <PrimaryNav />
      <section className="active-banner">
        <div>
          <div className="eyebrow">Active timer</div>
          <strong>{activeLabel}</strong>
          <div className="timer-status">
            {activeSession ? elapsedLabel : "Start a timer to begin tracking."}
          </div>
        </div>
        <button
          className="primary"
          type="button"
          disabled={!activeSession || busy}
          onClick={handleStop}
        >
          Stop
        </button>
      </section>
      <div className="card">
        <div className="card-header card-header-row">
          <div>
            <h2>Today totals</h2>
            <p>{dayDate}</p>
          </div>
          <EndDayButton
            dayDate={dayDate}
            clientTz={clientTz}
            disabled={busy}
            onEnded={handleEndDay}
          />
        </div>
        <div className="card-body">
          {totalsLoading ? <div>Loading totals...</div> : null}
          {totalsError ? <div className="error">{totalsError}</div> : null}
          {timers.length === 0 ? (
            <div>No timers yet.</div>
          ) : (
            <div className="totals-list">
              {totalRows.map(({ timer, totalSeconds }) => (
                <div className="total-row" key={timer.id}>
                  <div className="total-name">
                    <span
                      className="dot"
                      style={{ background: timer.color }}
                    />
                    {timer.name}
                  </div>
                  <div className="total-value">
                    {formatDuration(totalSeconds)}
                  </div>
                </div>
              ))}
            </div>
          )}
          {endDaySummary ? (
            <div className="notice">Day finalized. Totals saved.</div>
          ) : null}
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <h2>Today</h2>
          <p>Create timers and switch between courses instantly.</p>
        </div>
        <div className="card-body">
          <button
            className="secondary"
            type="button"
            onClick={() => setCreateOpen(true)}
          >
            Create a timer
          </button>
          {actionError ? <div className="error">{actionError}</div> : null}
        </div>
      </div>
      <div className="timer-list">
        {loading || sessionLoading ? (
          <div className="card">Loading timers...</div>
        ) : null}
        {!loading && timers.length === 0 ? (
          <div className="card">No timers yet. Add one to get started.</div>
        ) : null}
        {error ? <div className="card error">{error}</div> : null}
        {timers.map((timer) => (
          <TimerCard
            key={timer.id}
            timer={timer}
            isActive={activeSession?.timer_id === timer.id}
            elapsedLabel={
              activeSession?.timer_id === timer.id ? elapsedLabel : "00:00:00"
            }
            disabled={busy}
            onStart={() => handleStart(timer.id)}
            onStop={handleStop}
            onEdit={() => setEditingTimer(timer)}
            onArchive={() => handleArchive(timer)}
          />
        ))}
      </div>
      <TimerFormModal
        title="Create timer"
        confirmLabel="Create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
      <TimerFormModal
        title="Edit timer"
        confirmLabel="Save"
        isOpen={Boolean(editingTimer)}
        initialValues={
          editingTimer
            ? {
                name: editingTimer.name,
                color: editingTimer.color,
                icon: editingTimer.icon,
              }
            : undefined
        }
        onClose={() => setEditingTimer(null)}
        onSubmit={handleUpdate}
      />
    </div>
  );
};

export default TimersPage;
