/** API layer: interactive profiler on the local engine (same math as before). */

import type { ProfilerRequest, ProfilerResult } from "@/domain/plots";
import { callEngine } from "@/engine/client";
import { getAnalysisBundle } from "@/engine/store";

export async function runProfiler(
  input: ProfilerRequest,
): Promise<ProfilerResult> {
  const bundle = await getAnalysisBundle(input.experiment_id);
  return callEngine<ProfilerResult>("profiler", { bundle, req: input });
}
