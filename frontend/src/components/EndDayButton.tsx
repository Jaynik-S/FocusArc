import { useState } from "react";

import { apiFetch } from "../api/apiClient";
import { ResetTotalsResponse } from "../api/types";
import { useTimerRuntime } from "../context/TimerRuntimeContext";

type EndDayButtonProps = {
  disabled?: boolean;
  onEnded: (response: ResetTotalsResponse) => void;
};

const EndDayButton = ({ disabled = false, onEnded }: EndDayButtonProps) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { activeAdjustmentSeconds } = useTimerRuntime();

  const handleConfirm = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch<ResetTotalsResponse>("/totals/reset", {
        method: "POST",
        body: { adjustment_seconds: activeAdjustmentSeconds },
      });
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
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Reset Totals
      </button>
      {open ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>Reset totals?</h3>
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
                This will stop any running timer and reset all total counters to zero.
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
                  disabled={busy}
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
