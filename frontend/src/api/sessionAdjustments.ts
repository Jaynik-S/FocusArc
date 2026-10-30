import { apiFetch } from "./apiClient";
import { notifyStudyMutationCommitted } from "./dataEvents";
import { getStudyRevision, requestStudySync } from "./studySyncState";
import type { Session } from "./types";

export const adjustStudySession = async (session: Session, deltaSeconds: number) => {
  try {
    const updated = await apiFetch<Session>(`/sessions/${session.id}/adjust`, {
      method: "POST",
      body: { delta_seconds: deltaSeconds, expected_start_at: session.start_at, expected_end_at: session.end_at, expected_revision: getStudyRevision() },
    });
    notifyStudyMutationCommitted();
    await requestStudySync().catch(() => {});
    return updated;
  } catch (cause) {
    // A response can be lost after commit. Re-read the server; never replay an edit.
    notifyStudyMutationCommitted();
    await requestStudySync().catch(() => {});
    throw cause;
  }
};
