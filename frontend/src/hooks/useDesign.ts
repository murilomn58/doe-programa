/** Domain hook: design generation mutation (server state via TanStack Query). */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { generateDesign } from "@/api/designs";
import type { DesignGenerateRequest } from "@/domain/design";
import { EXPERIMENTS_KEY } from "@/hooks/useExperiments";

export function useGenerateDesign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DesignGenerateRequest) => generateDesign(input),
    onSuccess: () => {
      // a new experiment may have been created alongside the design
      queryClient.invalidateQueries({ queryKey: EXPERIMENTS_KEY });
    },
  });
}
