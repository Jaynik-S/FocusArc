import { AveragesResponse } from "../api/types";
import { useApiResource } from "./useApiResource";
import { getClientTimezone } from "../utils/date";

export const useAverages = (days: number) =>
  useApiResource<AveragesResponse>(`/stats/averages?${new URLSearchParams({ days: String(days), client_tz: getClientTimezone() })}`);
