import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

import { EndDayResponse } from "../api/types";
import { useSelectedTimer } from "../context/TimerSelectionContext";
import { useDayStats } from "../hooks/useDayStats";
import { TimerFormValues, useTimers } from "../hooks/useTimers";
import { getClientTimezone, getLocalDateString } from "../utils/date";
import { formatDurationShort } from "../utils/time";
import EndDayButton from "./EndDayButton";
import TimerFormModal from "./TimerFormModal";

type SidebarProps = {
  username: string;
};

const Sidebar = ({ username }: SidebarProps) => {
  const isReady = Boolean(username);
  const clientTz = useMemo(() => getClientTimezone(), []);
  const [dayDate, setDayDate] = useState(() =>
    getLocalDateString(new Date(), clientTz)
  );
  const timersState = useTimers(isReady);
  const dayStats = useDayStats(dayDate, isReady);
  const { selectedTimerId, setSelectedTimerId } = useSelectedTimer();
  const [createOpen, setCreateOpen] = useState(false);
  const [timerToggles, setTimerToggles] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDayDate(getLocalDateString(new Date(), clientTz));
    }, 60000);
    return () => window.clearInterval(interval);
  }, [clientTz]);

  useEffect(() => {
    if (!timersState.loading && timersState.timers.length > 0) {
      const exists = timersState.timers.some((timer) => timer.id === selectedTimerId);
      if (!selectedTimerId || !exists) {
        setSelectedTimerId(timersState.timers[0].id);
      }
    }
  }, [timersState.loading, timersState.timers, selectedTimerId, setSelectedTimerId]);

  const totalsMap = useMemo(() => {
    const map = new Map<string, number>();
    dayStats.totals.forEach((total) => map.set(total.timer_id, total.total_seconds));
    return map;
  }, [dayStats.totals]);

  const timers = timersState.timers;

  const handleCreate = async (values: TimerFormValues) => {
    setActionError("");
    try {
      await timersState.createTimer(values);
      setCreateOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create timer");
    }
  };

  const handleToggle = (timerId: string) => {
    setTimerToggles((prev) => ({
      ...prev,
      [timerId]: !(prev[timerId] ?? true),
    }));
  };

  const handleEndDay = (_response: EndDayResponse) => {
    dayStats.reload();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-user">
        <span className="sidebar-label">Signed in</span>
        <strong>{username || "Not set"}</strong>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/timers" className="sidebar-link">
          Timers
        </NavLink>
        <NavLink to="/schedule" className="sidebar-link">
          Schedule
        </NavLink>
        <NavLink to="/history" className="sidebar-link">
          History
        </NavLink>
      </nav>
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Timers</span>
          <button
            className="link-button"
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!isReady}
          >
            New
          </button>
        </div>
        <div className="timer-list">
          {timersState.loading ? <div className="muted">Loading...</div> : null}
          {!timersState.loading && timers.length === 0 ? (
            <div className="muted">No timers yet.</div>
          ) : null}
          {timers.map((timer, index) => {
            const totalSeconds = totalsMap.get(timer.id) ?? 0;
            const isSelected = timer.id === selectedTimerId;
            const isEnabled = timerToggles[timer.id] ?? true;
            return (
              <button
                key={timer.id}
                className={`timer-row${isSelected ? " timer-row-active" : ""}`}
                type="button"
                style={{ animationDelay: `${index * 40}ms` }}
                onClick={() => setSelectedTimerId(timer.id)}
              >
                <div className="timer-row-main">
                  <span>{timer.name}</span>
                  <span className="timer-row-total">
                    {formatDurationShort(totalSeconds)}
                  </span>
                </div>
                <label className="timer-toggle">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => handleToggle(timer.id)}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <span />
                </label>
              </button>
            );
          })}
        </div>
        {actionError ? <div className="error">{actionError}</div> : null}
      </div>
      <div className="sidebar-section sidebar-endday">
        <EndDayButton
          dayDate={dayDate}
          clientTz={clientTz}
          disabled={!isReady}
          onEnded={handleEndDay}
        />
      </div>
      <TimerFormModal
        title="Create timer"
        confirmLabel="Create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </aside>
  );
};

export default Sidebar;
