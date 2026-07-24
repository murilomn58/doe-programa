/** API layer: the analysis engine, now local (Pyodide worker + IndexedDB). */

import type { AnalysisRequest, AnalysisResult } from "@/domain/analysis";
import { callEngine } from "@/engine/client";
import { getAnalysisBundle } from "@/engine/store";

export async function runAnalysis(
  input: AnalysisRequest,
): Promise<AnalysisResult> {
  const bundle = await getAnalysisBundle(input.experiment_id);
  return callEngine<AnalysisResult>("analyze", { bundle, req: input });
}
