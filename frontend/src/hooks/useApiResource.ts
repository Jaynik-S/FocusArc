import { useCallback, useEffect, useReducer, useState } from "react";
import { apiFetch, ApiError } from "../api/apiClient";
import { getStudyRevision, isStudySyncRegistered, requestStudySync } from "../api/studySyncState";
import { useAuth } from "../contexts/AuthContext";
import { useStudyDataRefresh } from "./useStudyDataRefresh";

/** A small read-only resource: responses are scoped to account, query and revision. */
export const useApiResource = <T,>(path: string | null) => {
  const { user } = useAuth();
  const username = user?.username ?? "";
  const [revision, reload] = useReducer((value: number) => value + 1, 0);
  const refresh = useCallback(() => reload(), []);
  const identity = `${username}:${path}`;
  const key = `${identity}:${revision}`;
  const [result, setResult] = useState<{ key: string; identity: string; data: T | null; error: string | null } | null>(null);
  useStudyDataRefresh(refresh);

  useEffect(() => {
    if (!username || !path) return;
    const controller = new AbortController();
    const read = async (): Promise<T> => {
      if (isStudySyncRegistered(username) && getStudyRevision(username) === null) {
        await requestStudySync();
        if (controller.signal.aborted) throw new DOMException("Read cancelled", "AbortError");
        if (getStudyRevision(username) === null) throw new Error("Reconnect to load shared study data.");
      }
      for (let attempt = 0; ; attempt++) {
        const acceptedRevision = getStudyRevision(username);
        const params = new URLSearchParams(path.split("?")[1] ?? "");
        if (acceptedRevision !== null) params.set("expected_revision", String(acceptedRevision));
        const guardedPath = `${path.split("?")[0]}${params.size ? `?${params}` : ""}`;
        try {
          const data = await apiFetch<T>(guardedPath, { signal: controller.signal });
          if (acceptedRevision !== null && getStudyRevision(username) !== acceptedRevision) {
            throw new ApiError("Study data changed while this view was loading.", 409);
          }
          return data;
        } catch (cause) {
          if (controller.signal.aborted || !(cause instanceof ApiError) || cause.status !== 409 || cause.code === "account_changed" || attempt >= 1) throw cause;
          await requestStudySync();
          if (controller.signal.aborted) throw new DOMException("Read cancelled", "AbortError");
        }
      }
    };
    void Promise.resolve().then(read).then(
      (data) => { if (!controller.signal.aborted) setResult({ key, identity, data, error: null }); },
      (cause) => {
        if (!controller.signal.aborted) setResult((previous) => ({ key, identity, data: previous?.identity === identity ? previous.data : null, error: cause instanceof Error ? cause.message : "Unable to load data. Try again." }));
      }
    );
    return () => controller.abort();
  }, [username, path, key, identity]);

  const current = result?.key === key ? result : null;
  const retainedData = result?.identity === identity ? result.data : null;
  return { data: current?.data ?? retainedData, loading: Boolean(username && path && !current && retainedData === null), refreshing: Boolean(username && path && !current), error: current?.error ?? null, reload: refresh };
};
