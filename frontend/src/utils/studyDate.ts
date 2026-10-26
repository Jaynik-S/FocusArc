import { getStudySnapshot } from "../api/studySyncState";
import { getClientTimezone } from "./date";

/** Shared account zone once synchronized; isolated readers keep their explicit zone. */
export const getStudyTimezone = () => getStudySnapshot()?.study_timezone ?? getClientTimezone();
