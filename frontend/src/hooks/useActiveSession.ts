import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "../api/apiClient";
import { Session } from "../api/types";
import { getClientTimezone } from "../utils/date";

export const useActiveSession = (enabled = true) => {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(
    async (initial = false) => {
      if (!enabled) {
        if (initial) {
          setLoading(false);
        }
        return;
      }
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
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) {
      setActiveSession(null);
      setElapsedSeconds(0);
      setLoading(false);
      return;
    }
    refresh(true);
    const interval = window.setInterval(() => refresh(false), 15000);
    return () => window.clearInterval(interval);
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !activeSession) {
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
  }, [activeSession, enabled]);

  const startTimer = useCallback(
    async (timerId: string, stoppedAdjustmentSeconds: number = 0) => {
      if (!enabled) {
        return;
      }
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
            stopped_adjustment_seconds: stoppedAdjustmentSeconds,
          },
        });
        setActiveSession(response.active_session);
      } finally {
        setBusy(false);
      }
    },
    [enabled]
  );

  const stopTimer = useCallback(
    async (adjustmentSeconds: number = 0) => {
    if (!enabled) {
      return;
    }
    setBusy(true);
    try {
      await apiFetch<{ stopped_session: Session | null }>("/stop", {
        method: "POST",
        body: {
          stopped_at_client: new Date().toISOString(),
          adjustment_seconds: adjustmentSeconds,
        },
      });
      setActiveSession(null);
    } finally {
      setBusy(false);
    }
    },
    [enabled]
  );

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
