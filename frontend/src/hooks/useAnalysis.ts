/** Domain hook: analysis query (server state via TanStack Query). */

import { useQuery } from "@tanstack/react-query";

import { runAnalysis } from "@/api/analysis";
import type { RSMModel } from "@/domain/analysis";

export const ANALYSIS_KEY = (
  experimentId: number,
  responseName: string,
  model: RSMModel,
  factorX: string | null,
  factorY: string | null,
) =>
  ["analysis", experimentId, responseName, model, factorX, factorY] as const;

/**
 * Runs the analysis for one (experiment, response, model) and the chosen factor
 * pair (which drives the surface/contour/interaction charts). Enabled only once
 * a response is chosen; re-fetches automatically when any of these change. The
 * POST is idempotent (pure read of the stored matrix), so a query — not a
 * mutation — is the right fit. ``placeholderData`` keeps the previous plots on
 * screen while a new pair loads (no flicker).
 */
export function useAnalysis(
  experimentId: number,
  responseName: string | null,
  model: RSMModel,
  factorX: string | null = null,
  factorY: string | null = null,
) {
  return useQuery({
    queryKey: ANALYSIS_KEY(experimentId, responseName ?? "", model, factorX, factorY),
    queryFn: () =>
      runAnalysis({
        experiment_id: experimentId,
        response_name: responseName as string,
        model,
        factor_x: factorX,
        factor_y: factorY,
      }),
    enabled:
      Number.isFinite(experimentId) &&
      experimentId > 0 &&
      Boolean(responseName),
    placeholderData: (prev) => prev,
  });
}
