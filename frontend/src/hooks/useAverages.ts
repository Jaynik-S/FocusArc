import { AveragesResponse } from "../api/types";
import { useApiResource } from "./useApiResource";

export const useAverages = (days: number) =>
  useApiResource<AveragesResponse>(`/stats/averages?days=${days}`);
