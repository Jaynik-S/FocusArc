import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "../api/apiClient";
import { Timer } from "../api/types";

const sortTimers = (timers: Timer[]) =>
  [...timers].sort((a, b) => a.created_at.localeCompare(b.created_at));

const TIMERS_STORAGE_KEY = "coursetimers.timers";

const readStoredTimers = () => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(TIMERS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as Timer[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) => item && typeof item.id === "string");
  } catch {
    return [];
  }
};

export type TimerFormValues = {
  name: string;
  color: string;
};

export const useTimers = (enabled = true) => {
  const [timers, setTimers] = useState<Timer[]>(() =>
    enabled ? readStoredTimers() : []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTimers = useCallback(async () => {
    if (!enabled) {
      setTimers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ timers: Timer[] }>(
        "/timers?include_archived=false"
      );
      setTimers(sortTimers(response.timers));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load timers");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    loadTimers();
  }, [loadTimers]);

  useEffect(() => {
    if (!enabled || !loading) {
      return;
    }
    if (timers.length > 0) {
      return;
    }
    const stored = readStoredTimers();
    if (stored.length > 0) {
      setTimers(stored);
    }
  }, [enabled, loading, timers.length]);

  useEffect(() => {
    if (!enabled || loading) {
      return;
    }
    try {
      localStorage.setItem(TIMERS_STORAGE_KEY, JSON.stringify(timers));
    } catch {
      // Ignore storage errors.
    }
  }, [timers, enabled, loading]);

  const createTimer = useCallback(async (payload: TimerFormValues) => {
    const timer = await apiFetch<Timer>("/timers", {
      method: "POST",
      body: payload,
    });
    setTimers((prev) => sortTimers([...prev, timer]));
    return timer;
  }, []);

  const updateTimer = useCallback(
    async (id: string, payload: Partial<TimerFormValues>) => {
      const timer = await apiFetch<Timer>(`/timers/${id}`, {
        method: "PATCH",
        body: payload,
      });
      setTimers((prev) =>
        sortTimers(prev.map((item) => (item.id === id ? timer : item)))
      );
      return timer;
    },
    []
  );

  const archiveTimer = useCallback(async (id: string) => {
    await apiFetch<void>(`/timers/${id}`, { method: "DELETE" });
    setTimers((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return useMemo(
    () => ({
      timers,
      loading,
      error,
      reload: loadTimers,
      createTimer,
      updateTimer,
      archiveTimer,
    }),
    [timers, loading, error, loadTimers, createTimer, updateTimer, archiveTimer]
  );
};
