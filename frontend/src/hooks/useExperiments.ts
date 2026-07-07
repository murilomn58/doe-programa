/** Domain hooks: server state lives here (TanStack Query), never in useState. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createExperiment, fetchExperiments } from "@/api/experiments";
import type { NewExperiment } from "@/domain/experiment";

export const EXPERIMENTS_KEY = ["experiments"] as const;

export function useExperiments() {
  return useQuery({
    queryKey: EXPERIMENTS_KEY,
    queryFn: fetchExperiments,
  });
}

export function useCreateExperiment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewExperiment) => createExperiment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPERIMENTS_KEY });
    },
  });
}
