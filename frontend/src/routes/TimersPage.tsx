import { useEffect, useMemo, useState } from "react";

import { Timer } from "../api/types";
import TimerFormModal from "../components/TimerFormModal";
import { useSelectedTimer } from "../context/TimerSelectionContext";
import { useActiveSession } from "../hooks/useActiveSession";
import { TimerFormValues, useTimers } from "../hooks/useTimers";
import { formatDuration } from "../utils/time";

const TimersPage = () => {
  const { selectedTimerId, setSelectedTimerId } = useSelectedTimer();
  const timersState = useTimers(true);
  const { activeSession, elapsedSeconds, busy, startTimer, stopTimer } =
    useActiveSession();
  const [editingTimer, setEditingTimer] = useState<Timer | null>(null);
  const [actionError, setActionError] = useState("");
  const [offsets, setOffsets] = useState<Record<string, number>>({});

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
  const displaySeconds = (isActive ? elapsedSeconds : 0) + offsetSeconds;
  const progress = ((displaySeconds % 3600) / 3600) * 360;

  const handlePlayPause = async () => {
    if (!selectedTimerId) {
      return;
    }
    setActionError("");
    try {
      if (isActive) {
        await stopTimer();
      } else {
        await startTimer(selectedTimerId);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update timer");
    }
  };

  const handleAddFive = () => {
    if (!selectedTimerId) {
      return;
    }
    setOffsets((prev) => ({
      ...prev,
      [selectedTimerId]: (prev[selectedTimerId] ?? 0) + 300,
    }));
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

  const handleArchive = async () => {
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
      <div className="timer-view">
        <div className="timer-meta">
          <span className="label">Active timer</span>
          <strong>{selectedTimer ? selectedTimer.name : "Select a timer"}</strong>
          <span className="muted">{formatDuration(displaySeconds)}</span>
        </div>
        <div className="timer-dial" style={{
          background: `conic-gradient(#111827 ${progress}deg, #e5e7eb ${progress}deg)`
        }}>
          <div className="timer-face">
            <div
              className="timer-hand"
              style={{ transform: `translateX(-50%) rotate(${progress}deg)` }}
            />
            <div className="timer-center" />
            <div className="timer-time">{formatDuration(displaySeconds)}</div>
          </div>
        </div>
        <div className="timer-controls">
          <button
            className="primary"
            type="button"
            onClick={handlePlayPause}
            disabled={!selectedTimerId || busy}
          >
            {isActive ? "Pause" : "Play"}
          </button>
          <button
            className="ghost"
            type="button"
            onClick={handleAddFive}
            disabled={!selectedTimerId}
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
            <button className="link-button" type="button" onClick={handleArchive}>
              Archive timer
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
