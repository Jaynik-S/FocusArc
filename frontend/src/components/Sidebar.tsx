import { CSSProperties, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

import { ResetTotalsResponse } from "../api/types";
import { useSelectedTimer } from "../context/TimerSelectionContext";
import { TimerFormValues, useTimers } from "../hooks/useTimers";
import { useTimerRuntime } from "../context/TimerRuntimeContext";
import { isValidHexColor } from "../utils/color";
import { formatDuration } from "../utils/time";
import EndDayButton from "./EndDayButton";
import TimerFormModal from "./TimerFormModal";

type SidebarProps = {
  username: string;
};

const THEME_STORAGE_KEY = "coursetimers.theme";

const getInitialTheme = () => {
  if (typeof window === "undefined") {
    return "light" as const;
  }
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      return stored;
    }
  } catch {
    // Ignore storage errors; fall back to system preference.
  }
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
};

const Sidebar = ({ username }: SidebarProps) => {
  const isReady = Boolean(username);
  const timersState = useTimers(isReady);
  const { selectedTimerId, setSelectedTimerId } = useSelectedTimer();
  const { activeSession, elapsedSeconds, offsets } = useTimerRuntime();
  const [theme, setTheme] = useState<"light" | "dark">(() => getInitialTheme());
  const [createOpen, setCreateOpen] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!timersState.loading && timersState.timers.length > 0) {
      const exists = timersState.timers.some((timer) => timer.id === selectedTimerId);
      if (!selectedTimerId || !exists) {
        setSelectedTimerId(timersState.timers[0].id);
      }
    }
  }, [timersState.loading, timersState.timers, selectedTimerId, setSelectedTimerId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors.
    }
  }, [theme]);

  const timers = timersState.timers;
  const selectedTimer = useMemo(
    () => timers.find((timer) => timer.id === selectedTimerId) ?? null,
    [timers, selectedTimerId]
  );
  const isDark = theme === "dark";

  const sidebarStyle = useMemo(() => {
    if (!selectedTimer || !isValidHexColor(selectedTimer.color)) {
      return undefined;
    }
    // Minimalistic: only pass accent color for indicators
    return {
      "--sidebar-accent": selectedTimer.color,
    } as any;
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

  const handleResetTotals = async (_response: ResetTotalsResponse) => {
    await timersState.reload();
  };

  return (
    <aside className="sidebar" style={sidebarStyle}>
      <div className="sidebar-user">
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
            const isSelected = timer.id === selectedTimerId;
            const isRunning = activeSession?.timer_id === timer.id;
            const offsetSeconds = offsets[timer.id] ?? 0;
            const displaySeconds = Math.max(
              0,
              (isRunning ? elapsedSeconds : 0) + offsetSeconds
            );
            const timerColor = isValidHexColor(timer.color) ? timer.color : "transparent";
            return (
              <button
                key={timer.id}
                className={`timer-row${isSelected ? " timer-row-active" : ""}`}
                type="button"
                style={{ animationDelay: `${index * 40}ms` }}
                onClick={() => setSelectedTimerId(timer.id)}
              >
                <div className="timer-row-main">
                  <div className="timer-row-name">
                    <span
                      className="timer-row-dot"
                      style={{ backgroundColor: timerColor }}
                    />
                    <span>{timer.name}</span>
                  </div>
                  <span className="timer-row-total">
                    {formatDuration(displaySeconds)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {actionError ? <div className="error">{actionError}</div> : null}
      </div>
      <div className="sidebar-section sidebar-endday">
        <div className="sidebar-endday-row">
          <button
            className="theme-toggle"
            type="button"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 3a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1zm0 14a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1zm9-5a1 1 0 0 1-1 1h-2a1 1 0 1 1 0-2h2a1 1 0 0 1 1 1zM6 12a1 1 0 0 1-1 1H3a1 1 0 1 1 0-2h2a1 1 0 0 1 1 1zm11.66-6.66a1 1 0 0 1 0 1.41l-1.42 1.42a1 1 0 1 1-1.41-1.42l1.41-1.41a1 1 0 0 1 1.42 0zM7.17 16.83a1 1 0 0 1 0 1.41l-1.41 1.42a1 1 0 1 1-1.42-1.42l1.42-1.41a1 1 0 0 1 1.41 0zm9.49 1.41a1 1 0 0 1-1.41 0l-1.42-1.41a1 1 0 1 1 1.42-1.42l1.41 1.42a1 1 0 0 1 0 1.41zM7.17 7.17a1 1 0 0 1-1.41 0L4.34 5.75a1 1 0 1 1 1.42-1.41l1.41 1.41a1 1 0 0 1 0 1.42zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M20.5 14.5a7.5 7.5 0 1 1-10-10 1 1 0 0 1 .9 1.7A5.5 5.5 0 1 0 18.8 13.6a1 1 0 0 1 1.7.9z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>
          <EndDayButton
            disabled={!isReady}
            onEnded={handleResetTotals}
          />
        </div>
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
