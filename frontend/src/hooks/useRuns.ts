/** Domain hook: runs query + response-save mutation (server state via Query). */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getRuns, saveResponses } from "@/api/runs";
import type { ResponsesUpsertRequest } from "@/domain/design";

export const RUNS_KEY = (experimentId: number) =>
  ["runs", experimentId] as const;

export function useRuns(experimentId: number) {
  return useQuery({
    queryKey: RUNS_KEY(experimentId),
    queryFn: () => getRuns(experimentId),
    enabled: Number.isFinite(experimentId) && experimentId > 0,
  });
}

export function useSaveResponses(experimentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResponsesUpsertRequest) =>
      saveResponses(experimentId, input),
    onSuccess: (data) => {
      // Seed the cache with the fresh server state and refetch to stay in sync.
      queryClient.setQueryData(RUNS_KEY(experimentId), data);
      queryClient.invalidateQueries({ queryKey: RUNS_KEY(experimentId) });
    },
  });
}
