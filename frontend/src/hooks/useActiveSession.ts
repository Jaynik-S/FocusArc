import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "../api/apiClient";
import { Session } from "../api/types";
import { getClientTimezone } from "../utils/date";

export const useActiveSession = () => {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (initial = false) => {
    if (initial) {
      setLoading(true);
    }
    try {
      const response = await apiFetch<{ active_session: Session | null }>(
        "/active-session"
      );
      setActiveSession(response.active_session);
    } finally {
      if (initial) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh(true);
    const interval = window.setInterval(() => refresh(false), 15000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!activeSession) {
      setElapsedSeconds(0);
      return;
    }

    const startAt = new Date(activeSession.start_at).getTime();
    const tick = () => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - startAt) / 1000)));
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [activeSession]);

  const startTimer = useCallback(async (timerId: string) => {
    setBusy(true);
    try {
      const response = await apiFetch<{
        stopped_session: Session | null;
        active_session: Session;
      }>(`/timers/${timerId}/start`, {
        method: "POST",
        body: {
          client_tz: getClientTimezone(),
          started_at_client: new Date().toISOString(),
        },
      });
      setActiveSession(response.active_session);
    } finally {
      setBusy(false);
    }
  }, []);

  const stopTimer = useCallback(async () => {
    setBusy(true);
    try {
      await apiFetch<{ stopped_session: Session | null }>("/stop", {
        method: "POST",
        body: { stopped_at_client: new Date().toISOString() },
      });
      setActiveSession(null);
    } finally {
      setBusy(false);
    }
  }, []);

  return useMemo(
    () => ({
      activeSession,
      elapsedSeconds,
      loading,
      busy,
      refresh,
      startTimer,
      stopTimer,
    }),
    [activeSession, elapsedSeconds, loading, busy, refresh, startTimer, stopTimer]
  );
};
