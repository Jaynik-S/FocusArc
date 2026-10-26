import { AveragesResponse } from "../api/types";
import { useApiResource } from "./useApiResource";
import { getStudyTimezone } from "../utils/studyDate";

export const useAverages = (days: number) =>
  useApiResource<AveragesResponse>(`/stats/averages?${new URLSearchParams({ days: String(days), client_tz: getStudyTimezone() })}`);
