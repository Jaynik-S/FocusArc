import { useState } from "react";

import { apiFetch } from "../api/apiClient";
import { EndDayResponse } from "../api/types";

type EndDayButtonProps = {
  dayDate: string;
  clientTz: string;
  disabled?: boolean;
  onEnded: (response: EndDayResponse) => void;
};

const EndDayButton = ({
  dayDate,
  clientTz,
  disabled = false,
  onEnded,
}: EndDayButtonProps) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch<EndDayResponse>("/end-day", {
        method: "POST",
        body: {
          client_tz: clientTz,
          day_date: dayDate,
        },
      });
      onEnded(response);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end day");
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
        End Day
      </button>
      {open ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>End today?</h3>
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
                This will stop any running timer and finalize totals for {dayDate}.
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
                  {busy ? "Ending..." : "Confirm"}
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
