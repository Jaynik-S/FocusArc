import { CSSProperties, useEffect, useMemo, useState } from "react";

import { Timer } from "../api/types";
import TimerFormModal from "../components/TimerFormModal";
import { useTimerRuntime } from "../context/TimerRuntimeContext";
import { useSelectedTimer } from "../context/TimerSelectionContext";
import { TimerFormValues, useTimers } from "../hooks/useTimers";
import { getContrastColor, isValidHexColor } from "../utils/color";
import { formatDuration } from "../utils/time";

const TimersPage = () => {
  const { selectedTimerId, setSelectedTimerId } = useSelectedTimer();
  const timersState = useTimers(true);
  const [editingTimer, setEditingTimer] = useState<Timer | null>(null);
  const [actionError, setActionError] = useState("");
  const {
    activeSession,
    elapsedSeconds,
    busy,
    startTimer,
    stopTimer,
    offsets,
    adjustOffset,
  } = useTimerRuntime();

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
  const rawSeconds = (isActive ? elapsedSeconds : 0) + offsetSeconds;
  const displaySeconds = Math.max(0, rawSeconds);
  const progressFraction = (displaySeconds % 3600) / 3600;
  const progressAngle = progressFraction * 360;
  const accentColor =
    selectedTimer && isValidHexColor(selectedTimer.color)
      ? selectedTimer.color
      : "#111827";
  const accentContrast = getContrastColor(accentColor);

  const handlePlayPause = async () => {
    if (!selectedTimerId) {
      return;
    }
    setActionError("");
    try {
      if (isActive) {
        await stopTimer();
        await timersState.reload();
      } else {
        await startTimer(selectedTimerId);
        await timersState.reload();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update timer");
    }
  };

  const handleAddFive = () => {
    if (!selectedTimerId || !isActive) {
      return;
    }
    adjustOffset(selectedTimerId, 300);
  };

  const handleMinusOne = () => {
    if (!selectedTimerId || !isActive) {
      return;
    }
    adjustOffset(selectedTimerId, -60);
  };

  const handleUpdate = async (values: TimerFormValues) => {
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
    if (!selectedTimer) {
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
        style={
          {
              "--accent": accentColor,
              "--accent-contrast": accentContrast,
            } as CSSProperties
          }
        >
        <div className="timer-meta">
          <strong className="timer-name">
            {selectedTimer ? selectedTimer.name : "Select a timer"}
          </strong>
        </div>
        <div
          className="timer-dial"
          style={
            {
              "--accent-progress": `${progressAngle}deg`,
            } as CSSProperties
          }
        >
          <div className="timer-face">
            <div
              className="timer-hand"
              style={{ transform: `translateX(-50%) rotate(${progressAngle}deg)` }}
            />
            <div className="timer-center" />
            <div className="timer-time">{formatDuration(displaySeconds)}</div>
          </div>
        </div>
        <div className="timer-controls">
          <button
            className="ghost accent timer-control-secondary"
            type="button"
            onClick={handleMinusOne}
            disabled={!selectedTimerId || !isActive}
          >
            -1 min
          </button>
          <button
            className="primary timer-control-main"
            type="button"
            onClick={handlePlayPause}
            disabled={!selectedTimerId || busy}
          >
            {isActive ? "Pause" : "Play"}
          </button>
          <button
            className="ghost accent timer-control-secondary"
            type="button"
            onClick={handleAddFive}
            disabled={!selectedTimerId || !isActive}
          >
            +5 min
          </button>
        </div>
        {selectedTimer ? (
          <div className="timer-actions-inline">
            <button
              className="link-button"
              type="button"
              onClick={() => setEditingTimer(selectedTimer)}
            >
              Edit timer
            </button>
            <button className="link-button" type="button" onClick={handleDelete}>
              Delete timer
            </button>
          </div>
        ) : null}
        {actionError ? <div className="error">{actionError}</div> : null}
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
