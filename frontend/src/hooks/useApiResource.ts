import { useCallback, useEffect, useReducer, useState } from "react";
import { apiFetch } from "../api/apiClient";
import { useAuth } from "../contexts/AuthContext";
import { useStudyDataRefresh } from "./useStudyDataRefresh";

/** A small read-only resource: responses are scoped to account, query and revision. */
export const useApiResource = <T,>(path: string | null) => {
  const { user } = useAuth();
  const username = user?.username ?? "";
  const [revision, reload] = useReducer((value: number) => value + 1, 0);
  const refresh = useCallback(() => reload(), []);
  const key = `${username}:${path}:${revision}`;
  const [result, setResult] = useState<{ key: string; data: T | null; error: string | null } | null>(null);
  useStudyDataRefresh(refresh);

  useEffect(() => {
    if (!username || !path) return;
    const controller = new AbortController();
    void apiFetch<T>(path, { signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) setResult({ key, data, error: null }); },
      (cause) => {
        if (!controller.signal.aborted) setResult({ key, data: null, error: cause instanceof Error ? cause.message : "Unable to load data. Try again." });
      }
    );
    return () => controller.abort();
  }, [username, path, key]);

  const current = result?.key === key ? result : null;
  return { data: current?.data ?? null, loading: Boolean(username && path && !current), error: current?.error ?? null, reload: refresh };
};
