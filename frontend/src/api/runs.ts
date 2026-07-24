/** API layer: run/response entry against the local store (IndexedDB). */

import type { ResponsesUpsertRequest, RunsRead } from "@/domain/design";
import { getRunsReadLocal, saveResponsesLocal } from "@/engine/store";

export async function getRuns(experimentId: number): Promise<RunsRead> {
  return getRunsReadLocal(experimentId);
}

export async function saveResponses(
  experimentId: number,
  input: ResponsesUpsertRequest,
): Promise<RunsRead> {
  return saveResponsesLocal(experimentId, input.values);
}
