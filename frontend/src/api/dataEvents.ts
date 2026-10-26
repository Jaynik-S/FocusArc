import type { Session } from "./types";

export const STUDY_DATA_CHANGED_EVENT = "focusarc:study-data-changed";

const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(STUDY_DATA_CHANGED_EVENT) : null;
if (channel) channel.onmessage = () => window.dispatchEvent(new Event(STUDY_DATA_CHANGED_EVENT));

/** Notify readers only after a successful server mutation. Never replay mutations. */
export const notifyStudyDataChanged = (session?: Session) => {
  window.dispatchEvent(new CustomEvent(STUDY_DATA_CHANGED_EVENT, { detail: session }));
  channel?.postMessage(null);
};
