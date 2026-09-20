import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch, AuthenticationError } from "../api/apiClient";
import { Session } from "../api/types";
import { getClientTimezone } from "../utils/date";

const ACTIVE_SESSION_STORAGE_KEY = "coursetimers.activeSession";
const LAST_ACTIVE_STORAGE_KEY = "coursetimers.lastActiveAt";
const SUSPEND_GRACE_MS = 5 * 60 * 1000;

type LastActiveSnapshot = {
  sessionId: string;
  lastActiveAt: number;
};

const readStoredActiveSession = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as {
      activeSession: Session | null;
      elapsedSeconds: number;
    };
    if (!parsed?.activeSession) {
      return null;
    }
    return {
      activeSession: parsed.activeSession,
      elapsedSeconds: Number(parsed.elapsedSeconds) || 0,
    };
  } catch {
    return null;
  }
};

const readStoredLastActive = (): LastActiveSnapshot | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as LastActiveSnapshot;
    if (!parsed?.sessionId || typeof parsed.lastActiveAt !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeStoredLastActive = (sessionId: string, lastActiveAt: number) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(
      LAST_ACTIVE_STORAGE_KEY,
      JSON.stringify({ sessionId, lastActiveAt })
    );
  } catch {
    // Ignore storage errors.
  }
};

const clearStoredLastActive = () => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(LAST_ACTIVE_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
};

export const useActiveSession = (enabled = true) => {
  const stored = enabled ? readStoredActiveSession() : null;
  const [activeSession, setActiveSession] = useState<Session | null>(
    stored?.activeSession ?? null
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(
    stored?.elapsedSeconds ?? 0
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastActiveRef = useRef<number | null>(null);
  const lastPersistedRef = useRef<number | null>(null);
  const autoStopRef = useRef(false);
  const refreshRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(
    async (initial = false, signal?: AbortSignal) => {
      if (!enabled) {
        if (initial) {
          setLoading(false);
        }
        return;
      }
      if (initial) {
        setLoading(true);
      }
      if (refreshRef.current) return refreshRef.current;
      const request = (async () => {
      try {
        const response = await apiFetch<{ active_session: Session | null }>(
          "/active-session", { signal }
        );
        if (!signal?.aborted) {
          setActiveSession(response.active_session);
          setError(null);
        }
      } catch (cause) {
        if (!signal?.aborted && !(cause instanceof AuthenticationError)) {
          setError("Cannot sync with the API. Saved counters are retained; reconnecting automatically.");
        }
        throw cause;
      } finally {
        if (initial) {
          setLoading(false);
        }
      }
      })();
      refreshRef.current = request;
      try { await request; } finally { refreshRef.current = null; }
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
    let disposed = false;
    let timer: number | undefined;
    let running = false;
    let failures = 0;
    let initial = true;
    const controller = new AbortController();
    const poll = async () => {
      if (disposed || running || document.hidden) return;
      running = true;
      let denied = false;
      try {
        await refresh(initial, controller.signal);
        failures = 0;
      } catch (cause) {
        failures += 1;
        denied = cause instanceof AuthenticationError;
      } finally {
        initial = false;
        running = false;
        if (!disposed && !document.hidden && !denied) {
          timer = window.setTimeout(poll, Math.min(15000 * 2 ** failures, 120000));
        }
      }
    };
    const onVisibility = () => {
      window.clearTimeout(timer);
      if (!document.hidden) void poll();
    };
    void poll();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }
    try {
      if (activeSession) {
        localStorage.setItem(
          ACTIVE_SESSION_STORAGE_KEY,
          JSON.stringify({ activeSession, elapsedSeconds })
        );
      } else {
        localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors.
    }
  }, [activeSession, elapsedSeconds, enabled]);

  useEffect(() => {
    if (!enabled || !activeSession) {
      lastActiveRef.current = null;
      lastPersistedRef.current = null;
      autoStopRef.current = false;
      clearStoredLastActive();
      return;
    }
    const storedLastActive = readStoredLastActive();
    if (storedLastActive?.sessionId === activeSession.id) {
      lastActiveRef.current = storedLastActive.lastActiveAt;
    } else {
      lastActiveRef.current = Date.now();
    }
    lastPersistedRef.current = null;
    autoStopRef.current = false;
    if (lastActiveRef.current) {
      writeStoredLastActive(activeSession.id, lastActiveRef.current);
    }
  }, [activeSession?.id, enabled]);

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
    async (adjustmentSeconds: number = 0, stoppedAtClient?: string) => {
      if (!enabled) {
        return;
      }
      setBusy(true);
      try {
        await apiFetch<{ stopped_session: Session | null }>("/stop", {
          method: "POST",
          body: {
            stopped_at_client: stoppedAtClient ?? new Date().toISOString(),
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

  useEffect(() => {
    if (!enabled || !activeSession) {
      setElapsedSeconds(0);
      return;
    }

    const startAt = new Date(activeSession.start_at).getTime();
    const persistLastActive = (timestamp: number) => {
      lastActiveRef.current = timestamp;
      if (!lastPersistedRef.current || timestamp - lastPersistedRef.current > 15000) {
        writeStoredLastActive(activeSession.id, timestamp);
        lastPersistedRef.current = timestamp;
      }
    };
    const tick = () => {
      const now = Date.now();
      const lastActiveAt = lastActiveRef.current ?? now;
      if (!autoStopRef.current && now - lastActiveAt > SUSPEND_GRACE_MS) {
        autoStopRef.current = true;
        void stopTimer(0, new Date(lastActiveAt).toISOString()).catch(() => {
          // The response may have been lost after commit. Never replay a mutation.
        });
        return;
      }
      persistLastActive(now);
      setElapsedSeconds(Math.max(0, Math.floor((now - startAt) / 1000)));
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [activeSession, enabled, stopTimer]);

  return useMemo(
    () => ({
      activeSession,
      elapsedSeconds,
      loading,
      busy,
      error,
      refresh,
      startTimer,
      stopTimer,
    }),
    [activeSession, elapsedSeconds, loading, busy, error, refresh, startTimer, stopTimer]
  );
};
