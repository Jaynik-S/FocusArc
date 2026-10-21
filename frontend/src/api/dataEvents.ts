export const STUDY_DATA_CHANGED_EVENT = "focusarc:study-data-changed";

/** Notify readers only after a successful server mutation. Never replay mutations. */
export const notifyStudyDataChanged = () => {
  window.dispatchEvent(new Event(STUDY_DATA_CHANGED_EVENT));
};
