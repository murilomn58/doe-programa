/** Domain hook: profiler query (server state via TanStack Query). */

import { useQuery } from "@tanstack/react-query";

import { runProfiler } from "@/api/profiler";
import type { RSMModel } from "@/domain/analysis";

/**
 * Stable key for the profiler query. The ``point`` is serialized so that moving
 * any slider produces a distinct cache entry (and re-fetch) while identical
 * points hit the cache.
 */
export const PROFILER_KEY = (
  experimentId: number,
  responseName: string,
  model: RSMModel,
  point: Record<string, number>,
  maximize: boolean,
) =>
  [
    "profiler",
    experimentId,
    responseName,
    model,
    // Sort keys so the serialization is order-independent.
    JSON.stringify(
      Object.fromEntries(Object.entries(point).sort(([a], [b]) => a.localeCompare(b))),
    ),
    maximize,
  ] as const;

/**
 * Recomputes the profiler for one (experiment, response, model) at ``point``
 * (coded coords per factor). ``placeholderData`` keeps the previous result on
 * screen while a new point loads, so dragging a slider does not flash empty
 * (the debounce lives in the container that owns the slider state).
 */
export function useProfiler(
  experimentId: number,
  responseName: string | null,
  model: RSMModel,
  point: Record<string, number>,
  maximize = true,
) {
  return useQuery({
    queryKey: PROFILER_KEY(
      experimentId,
      responseName ?? "",
      model,
      point,
      maximize,
    ),
    queryFn: () =>
      runProfiler({
        experiment_id: experimentId,
        response_name: responseName as string,
        model,
        point,
        maximize,
      }),
    enabled:
      Number.isFinite(experimentId) &&
      experimentId > 0 &&
      Boolean(responseName),
    placeholderData: (prev) => prev,
  });
}
