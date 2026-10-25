import { apiFetch } from "./apiClient";
import { notifyStudyDataChanged } from "./dataEvents";
import type { Session } from "./types";

export const adjustStudySession = async (session: Session, deltaSeconds: number) => {
  try {
    const updated = await apiFetch<Session>(`/sessions/${session.id}/adjust`, {
      method: "POST",
      body: { delta_seconds: deltaSeconds, expected_start_at: session.start_at, expected_end_at: session.end_at },
    });
    notifyStudyDataChanged(updated);
    return updated;
  } catch (cause) {
    // A response can be lost after commit. Re-read the server; never replay an edit.
    notifyStudyDataChanged();
    throw cause;
  }
};
