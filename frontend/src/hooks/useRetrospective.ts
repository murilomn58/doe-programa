/** Domain hooks: retrospective diagnose (query) + materialize (mutation). */

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import { postDiagnose, postMaterialize } from "@/api/retrospective";
import type {
  RetroDiagnoseRequest,
  RetroMaterializeRequest,
} from "@/domain/retrospective";

/**
 * Diagnose the pasted table. ``body`` is null until the caller's gate passes
 * (≥ 1 factor, ≥ 1 response, ≥ 3 rows with factor values); the query is disabled
 * while null. The POST is a pure read (no persistence), so a query fits — and
 * ``keepPreviousData`` keeps the last diagnosis on screen while a debounced edit
 * re-fetches, so the result card never flickers to empty.
 */
export function useDiagnose(body: RetroDiagnoseRequest | null) {
  return useQuery({
    queryKey: ["retro-diagnose", JSON.stringify(body)],
    queryFn: () => postDiagnose(body as RetroDiagnoseRequest),
    enabled: body !== null,
    placeholderData: keepPreviousData,
  });
}

/** Persist an already-run table as a new experiment; returns the summary. */
export function useMaterialize() {
  return useMutation({
    mutationFn: (input: RetroMaterializeRequest) => postMaterialize(input),
  });
}
