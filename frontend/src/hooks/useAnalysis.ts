/** Domain hook: analysis query (server state via TanStack Query). */

import { useQuery } from "@tanstack/react-query";

import { runAnalysis } from "@/api/analysis";
import type { RSMModel } from "@/domain/analysis";

export const ANALYSIS_KEY = (
  experimentId: number,
  responseName: string,
  model: RSMModel,
) => ["analysis", experimentId, responseName, model] as const;

/**
 * Runs the analysis for one (experiment, response, model). Enabled only once a
 * response is chosen; re-fetches automatically when the model or response
 * changes. The POST is idempotent (pure read of the stored matrix), so a query
 * — not a mutation — is the right fit.
 */
export function useAnalysis(
  experimentId: number,
  responseName: string | null,
  model: RSMModel,
) {
  return useQuery({
    queryKey: ANALYSIS_KEY(experimentId, responseName ?? "", model),
    queryFn: () =>
      runAnalysis({
        experiment_id: experimentId,
        response_name: responseName as string,
        model,
      }),
    enabled:
      Number.isFinite(experimentId) &&
      experimentId > 0 &&
      Boolean(responseName),
  });
}
