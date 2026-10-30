import { useId, useState } from "react";

import { ResetTotalsResponse } from "../api/types";
import { useTimerRuntimeState } from "../context/TimerRuntimeContext";

type EndDayButtonProps = {
  disabled?: boolean;
  onEnded: (response: ResetTotalsResponse) => void;
};

const EndDayButton = ({ disabled = false, onEnded }: EndDayButtonProps) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();
  const { resetTotals, busy: timerBusy, synced = true } = useTimerRuntimeState();

  const handleConfirm = async () => {
    if (timerBusy || busy || !synced) return;
    setBusy(true);
    setError("");
    try {
      const response = await resetTotals();
      onEnded(response);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset totals");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="end-day-button"
        type="button"
        disabled={disabled || timerBusy || !synced}
        onClick={() => setOpen(true)}
      >
        Reset cycle counters
      </button>
      {open ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <div className="modal">
            <div className="modal-header">
              <h2 id={titleId}>Reset cycle counters?</h2>
              <button
                className="ghost"
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Close
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-text">
                This will stop any running timer and reset cycle counters to zero. Today's recorded study time remains intact.
              </p>
              {error ? <div className="error">{error}</div> : null}
              <div className="modal-actions">
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  className="primary"
                  type="button"
                  onClick={handleConfirm}
                  disabled={busy || timerBusy || !synced}
                >
                  {busy ? "Resetting..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default EndDayButton;
