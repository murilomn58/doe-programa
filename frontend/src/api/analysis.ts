/** API layer: the analysis engine, now local (Pyodide worker + IndexedDB). */

import type { AnalysisRequest, AnalysisResult } from "@/domain/analysis";
import { callEngine } from "@/engine/client";
import { getAnalysisBundle, getRunsReadLocal } from "@/engine/store";

export async function runAnalysis(
  input: AnalysisRequest,
): Promise<AnalysisResult> {
  const bundle = await getAnalysisBundle(input.experiment_id);
  // Nome do agrupamento (ex. "Tipo de solo") e nomes dos blocos (ex. os
  // materiais), se o pesquisador deu na geração do design: viajam explícitos
  // no `req` para a linha da ANOVA sair como "Bloco (Tipo de solo)" e os
  // termos de bloco saírem como "Material (Solo-Brita 40/60)" em vez de
  // "Bloco 2". Sem eles, o "Bloco" puro de antes se preserva.
  const { block_name, block_labels } = await getRunsReadLocal(
    input.experiment_id,
  );
  return callEngine<AnalysisResult>("analyze", {
    bundle,
    req: {
      ...input,
      block_name: block_name ?? null,
      block_labels: block_labels ?? null,
    },
  });
}
