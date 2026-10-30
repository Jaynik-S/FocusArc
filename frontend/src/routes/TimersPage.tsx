import { CSSProperties, useEffect, useMemo, useState } from "react";

import { Timer } from "../api/types";
import TimerFormModal from "../components/TimerFormModal";
import ClockHousing from "../components/ClockHousing";
import OrnamentRule from "../components/OrnamentRule";
import SoftFrame from "../components/SoftFrame";
import { useTimerRuntime } from "../context/TimerRuntimeContext";
import { useSelectedTimer } from "../context/TimerSelectionContext";
import { TimerFormValues, useTimers } from "../hooks/useTimers";
import { getContrastColor, isValidHexColor } from "../utils/color";
import { formatDuration } from "../utils/time";

const TimersPage = () => {
  const { selectedTimerId, setSelectedTimerId } = useSelectedTimer();
  const timersState = useTimers();
  const [editingTimer, setEditingTimer] = useState<Timer | null>(null);
  const [actionError, setActionError] = useState("");
  const [adjustmentStatus, setAdjustmentStatus] = useState("");
  const [applyingSaved, setApplyingSaved] = useState(false);
  const {
    activeSession,
    elapsedSeconds,
    busy,
    startTimer,
    stopTimer,
    offsets,
    adjustOffset,
    elapsedByTimer,
    synced = true,
    legacyPendingAdjustments = {},
    legacyPendingOffsets = {},
    applyLegacyAdjustment,
  } = useTimerRuntime();
  const controlsBusy = busy || applyingSaved;
  const hasSavedDrafts = Object.keys(legacyPendingAdjustments).length > 0 || Object.keys(legacyPendingOffsets).length > 0;
  const savedActiveAdjustment = activeSession ? legacyPendingAdjustments[activeSession.id] ?? 0 : 0;

  const selectedTimer = useMemo(() => {
    if (!selectedTimerId) {
      return null;
    }
    return timersState.timers.find((timer) => timer.id === selectedTimerId) ?? null;
  }, [selectedTimerId, timersState.timers]);

  useEffect(() => {
    if (!selectedTimerId && activeSession) {
      setSelectedTimerId(activeSession.timer_id);
    }
  }, [activeSession, selectedTimerId, setSelectedTimerId]);

  const isActive = activeSession?.timer_id === selectedTimerId;
  const offsetSeconds = selectedTimerId ? offsets[selectedTimerId] ?? 0 : 0;
  const baseSeconds = selectedTimerId ? elapsedByTimer[selectedTimerId] ?? 0 : 0;
  const rawSeconds = baseSeconds + (isActive ? elapsedSeconds : 0) + offsetSeconds;
  const displaySeconds = Math.max(0, rawSeconds);
  const progressFraction = (displaySeconds % 3600) / 3600;
  const progressAngle = progressFraction * 360;
  const accentColor =
    selectedTimer && isValidHexColor(selectedTimer.color)
      ? selectedTimer.color
      : "#111827";
  const accentContrast = getContrastColor(accentColor);

  const handlePlayPause = async () => {
    if (!selectedTimer || controlsBusy || !synced) {
      return;
    }
    setActionError("");
    try {
      if (isActive) {
        await stopTimer();
      } else {
        await startTimer(selectedTimer.id);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update timer");
    }
  };

  const handleAdjust = async (delta: number) => {
    if (!selectedTimer || controlsBusy || !synced) return;
    setActionError("");
    setAdjustmentStatus("");
    try {
      await adjustOffset(selectedTimer.id, delta);
      setAdjustmentStatus("Session updated.");
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not save adjustment. Refresh and try again.");
    }
  };

  const handleApplySaved = async () => {
    if (!activeSession || !savedActiveAdjustment || controlsBusy || !synced) return;
    setActionError("");
    setAdjustmentStatus("");
    setApplyingSaved(true);
    try {
      await applyLegacyAdjustment(activeSession, savedActiveAdjustment);
      setAdjustmentStatus("Saved adjustment applied.");
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not apply saved adjustment.");
    } finally {
      setApplyingSaved(false);
    }
  };

  const handleUpdate = async (values: TimerFormValues) => {
    if (!synced || controlsBusy) {
      setActionError("Reconnect and sync before editing a timer.");
      return;
    }
    if (!editingTimer) {
      return;
    }
    setActionError("");
    try {
      await timersState.updateTimer(editingTimer.id, values);
      setEditingTimer(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update timer");
    }
  };

  const handleDelete = async () => {
    if (!selectedTimer || !synced || controlsBusy) {
      return;
    }
    setActionError("");
    try {
      await timersState.archiveTimer(selectedTimer.id);
      if (selectedTimerId === selectedTimer.id) {
        setSelectedTimerId(null);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to archive timer");
    }
  };

  return (
    <div className="page minimal-page">
      <div
        className="timer-view"
        aria-labelledby="timer-heading"
        style={
          {
              "--accent": accentColor,
              "--accent-contrast": accentContrast,
            } as CSSProperties
          }
        >
        <div className="timer-view-header">
          <h1 className="timer-name" id="timer-heading">
            {selectedTimer ? selectedTimer.name : "Select a timer"}
          </h1>
          <span className="timer-state">{isActive ? "Running" : "Ready"}</span>
          <OrnamentRule />
          {!synced ? <span className="muted" role="status">Synchronizing study data… Timer controls are unavailable until connected.</span> : null}
        </div>
        <div
          className="timer-dial"
          style={
            {
              "--accent-progress": `${progressAngle}deg`,
            } as CSSProperties
          }
        >
          <ClockHousing />
          <svg className="timer-dial-art" viewBox="0 0 320 320" aria-hidden="true">
            <circle className="timer-dial-rim" cx="160" cy="160" r="157" pathLength="100" strokeDasharray="96 4" transform="rotate(-83 160 160)" />
            <circle className="timer-dial-track" cx="160" cy="160" r="146" />
            <circle className="timer-dial-progress-edge" cx="160" cy="160" r="146" pathLength="100"
              strokeDasharray={`${progressFraction * 100} 100`} transform="rotate(-90 160 160)" />
            <circle className="timer-dial-progress" cx="160" cy="160" r="146" pathLength="100"
              strokeDasharray={`${progressFraction * 100} 100`} transform="rotate(-90 160 160)" />
            {Array.from({ length: 12 }, (_, index) => <path key={index} className={`timer-dial-tick${index % 3 === 0 ? " timer-dial-tick-major" : ""}`}
              d={index % 3 === 0 ? "M160 26v8" : "M160 28v3"} transform={`rotate(${index * 30} 160 160)`} />)}
            <path className="timer-dial-point" d="m160 6 2.2 5.8L168 14l-5.8 2.2L160 22l-2.2-5.8L152 14l5.8-2.2Z" transform={`rotate(${progressAngle} 160 160)`} />
          </svg>
          <div className="timer-face">
            <div
              className="timer-hand"
              style={{ transform: `translateX(-50%) rotate(${progressAngle}deg)` }}
            />
            <div className="timer-center" />
            <div className="timer-reading">
              <output className="timer-time" role="timer" aria-label="Elapsed time">{formatDuration(displaySeconds).split(":").map((part, index) => <span key={index}>{index > 0 ? <span className="timer-colon">:</span> : null}{part}</span>)}</output>
              <span className="timer-period">Today</span>
            </div>
          </div>
        </div>
        <div className="timer-controls">
          <button
            className="ghost accent timer-control-secondary"
            type="button"
            onClick={() => void handleAdjust(-300)}
            disabled={!selectedTimer || controlsBusy || !synced}
          >
            <span className="adjustment-value">−5<span className="adjustment-unit"> min</span></span>
          </button>
          <button
            className="primary timer-control-main"
            type="button"
            onClick={handlePlayPause}
            disabled={!selectedTimer || controlsBusy || !synced}
          >
            <SoftFrame />
            <svg className="play-icon" viewBox="0 0 20 20" aria-hidden="true">{isActive
              ? <path d="M6 4h2v12H6zm6 0h2v12h-2z" />
              : <path d="M6 3.8a.8.8 0 0 1 1.2-.7l9 6.2a.8.8 0 0 1 0 1.4l-9 6.2a.8.8 0 0 1-1.2-.7z" />}</svg>
            {isActive ? "Pause" : "Play"}
          </button>
          <button
            className="ghost accent timer-control-secondary"
            type="button"
            onClick={() => void handleAdjust(600)}
            disabled={!selectedTimer || controlsBusy || !synced}
          >
            <span className="adjustment-value">+10<span className="adjustment-unit"> min</span></span>
          </button>
        </div>
        {selectedTimer ? (
          <div className="timer-actions-inline">
            <button
              className="link-button"
              type="button"
              onClick={() => setEditingTimer(selectedTimer)}
              disabled={controlsBusy || !synced}
            >
              Edit timer
            </button>
            <button className="link-button" type="button" onClick={handleDelete} disabled={controlsBusy || !synced}>
              Delete timer
            </button>
          </div>
        ) : null}
        {actionError ? <div className="error" role="alert">{actionError}</div> : null}
        {adjustmentStatus ? <div className="muted" role="status">{adjustmentStatus}</div> : null}
        {hasSavedDrafts ? <div className="muted">
          <p>Saved browser adjustments are retained for review and excluded from shared totals.</p>
          {savedActiveAdjustment ? <button className="link-button" type="button" onClick={() => void handleApplySaved()} disabled={controlsBusy || !synced}>Apply saved adjustment</button> : null}
        </div> : null}
      </div>
      <TimerFormModal
        title="Edit timer"
        confirmLabel="Save"
        isOpen={Boolean(editingTimer)}
        initialValues={
          editingTimer
            ? {
                name: editingTimer.name,
                color: editingTimer.color,
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
