import type { Session } from "./types";

export const STUDY_DATA_CHANGED_EVENT = "focusarc:study-data-changed";

/** Snapshot notifications refresh readers without rebroadcasting and starting a sync loop. */
export const notifyStudySnapshotApplied = (revision: number, day_date: string) => {
  window.dispatchEvent(new CustomEvent(STUDY_DATA_CHANGED_EVENT, {
    detail: { source: "snapshot", revision, day_date },
  }));
};

const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(STUDY_DATA_CHANGED_EVENT) : null;
if (channel) channel.onmessage = () => window.dispatchEvent(new Event(STUDY_DATA_CHANGED_EVENT));

/** Notify readers only after a successful server mutation. Never replay mutations. */
export const notifyStudyDataChanged = (session?: Session) => {
  window.dispatchEvent(new CustomEvent(STUDY_DATA_CHANGED_EVENT, { detail: session }));
  channel?.postMessage(null);
};

/** Refresh local readers and other tabs; the local coordinator reconciles explicitly. */
export const notifyStudyMutationCommitted = () => {
  window.dispatchEvent(new CustomEvent(STUDY_DATA_CHANGED_EVENT, { detail: { source: "mutation" } }));
  channel?.postMessage(null);
};
