/** API layer: the analysis engine, now local (Pyodide worker + IndexedDB). */

import type { AnalysisRequest, AnalysisResult } from "@/domain/analysis";
import { callEngine } from "@/engine/client";
import { getAnalysisBundle, getRunsReadLocal } from "@/engine/store";

export async function runAnalysis(
  input: AnalysisRequest,
): Promise<AnalysisResult> {
  const bundle = await getAnalysisBundle(input.experiment_id);
  // Nome do agrupamento (ex. "Tipo de solo"), se o pesquisador deu um na
  // geração do design: viaja explícito no `req` para a linha da ANOVA sair
  // como "Bloco (Tipo de solo)" em vez de só "Bloco" (AnalysisService.analyze
  // aceita `block_name` opcional; default None preserva o "Bloco" puro).
  const { block_name } = await getRunsReadLocal(input.experiment_id);
  return callEngine<AnalysisResult>("analyze", {
    bundle,
    req: { ...input, block_name: block_name ?? null },
  });
}
