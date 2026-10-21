import { useEffect } from "react";
import { STUDY_DATA_CHANGED_EVENT } from "../api/dataEvents";

export const useStudyDataRefresh = (reload: () => void) => {
  useEffect(() => {
    window.addEventListener(STUDY_DATA_CHANGED_EVENT, reload);
    return () => window.removeEventListener(STUDY_DATA_CHANGED_EVENT, reload);
  }, [reload]);
};
