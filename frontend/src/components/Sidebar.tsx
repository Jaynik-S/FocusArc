import { CSSProperties, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

import { ResetTotalsResponse } from "../api/types";
import { useSelectedTimer } from "../context/TimerSelectionContext";
import { TimerFormValues, useTimers } from "../hooks/useTimers";
import { getContrastColor, getMutedTextColor, isValidHexColor } from "../utils/color";
import { formatDurationShort } from "../utils/time";
import EndDayButton from "./EndDayButton";
import TimerFormModal from "./TimerFormModal";

type SidebarProps = {
  username: string;
};

const Sidebar = ({ username }: SidebarProps) => {
  const isReady = Boolean(username);
  const timersState = useTimers(isReady);
  const { selectedTimerId, setSelectedTimerId } = useSelectedTimer();
  const [createOpen, setCreateOpen] = useState(false);
  const [timerToggles, setTimerToggles] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!timersState.loading && timersState.timers.length > 0) {
      const exists = timersState.timers.some((timer) => timer.id === selectedTimerId);
      if (!selectedTimerId || !exists) {
        setSelectedTimerId(timersState.timers[0].id);
      }
    }
  }, [timersState.loading, timersState.timers, selectedTimerId, setSelectedTimerId]);

  const timers = timersState.timers;
  const selectedTimer = useMemo(
    () => timers.find((timer) => timer.id === selectedTimerId) ?? null,
    [timers, selectedTimerId]
  );

  const sidebarStyle = useMemo(() => {
    if (!selectedTimer || !isValidHexColor(selectedTimer.color)) {
      return undefined;
    }
    const bg = selectedTimer.color;
    const fg = getContrastColor(bg);
    const muted = getMutedTextColor(bg);
    const isDark = fg === "#ffffff";
    const highlight = isDark
      ? "rgba(255, 255, 255, 0.16)"
      : "rgba(17, 24, 39, 0.08)";
    const border = isDark
      ? "rgba(255, 255, 255, 0.28)"
      : "rgba(17, 24, 39, 0.18)";
    return {
      "--sidebar-bg": bg,
      "--sidebar-fg": fg,
      "--sidebar-muted": muted,
      "--sidebar-highlight": highlight,
      "--sidebar-border": border,
    } as CSSProperties;
  }, [selectedTimer]);

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

  const handleResetTotals = async (_response: ResetTotalsResponse) => {
    await timersState.reload();
  };

  return (
    <aside className="sidebar" style={sidebarStyle}>
      <div className="sidebar-user">
        <span className="sidebar-label">Signed in</span>
        <strong>{username || "Not set"}</strong>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/timers" className="sidebar-link">
          Timers
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
            const totalSeconds = timer.cycle_total_seconds ?? 0;
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
                  <span className="timer-row-name">{timer.name}</span>
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
          disabled={!isReady}
          onEnded={handleResetTotals}
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
