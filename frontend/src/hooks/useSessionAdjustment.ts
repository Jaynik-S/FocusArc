import { useRef, useState } from "react";
import { adjustStudySession } from "../api/sessionAdjustments";
import type { Session } from "../api/types";

export const useSessionAdjustment = () => {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const adjust = async (session: Session, delta: number) => {
    if (pending.current) return null;
    pending.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const updated = await adjustStudySession(session, delta);
      setStatus("Session updated.");
      return updated;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save adjustment. Refresh and try again.");
      return null;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return { adjust, busy, error, status };
};
