import { useStudySync } from "./useStudySync";

/** Compatibility entry point; the account snapshot owns active and completed state together. */
export const useActiveSession = (username = "") => useStudySync(username);
