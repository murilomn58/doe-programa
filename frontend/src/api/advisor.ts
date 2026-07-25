/** API layer: assistente de sugestões (heurísticas do motor, offline). */

import type { AnalysisResult } from "@/domain/analysis";
import { callEngine } from "@/engine/client";
import { getRunsReadLocal } from "@/engine/store";

export interface AdvisorComment {
  topic: string;
  text: string;
}

export interface AdvisorSuggestion {
  id: string;
  title: string;
  rationale: string;
  /** "add_center_points" | "extend_ccd" | "add_replicates" | "switch_model:<m>" | null */
  action: string | null;
  severity: "info" | "warn" | "good";
}

export interface AdvisorReport {
  comments: AdvisorComment[];
  suggestions: AdvisorSuggestion[];
}

export async function fetchAdvice(
  experimentId: number,
  result: AnalysisResult,
): Promise<AdvisorReport> {
  const runsRead = await getRunsReadLocal(experimentId);
  const designMeta = {
    has_center: runsRead.runs.some((r) => r.point_type === 0),
    has_axial: runsRead.runs.some((r) => r.point_type === -1),
    max_replicate: runsRead.runs.reduce((m, r) => Math.max(m, r.replicate ?? 1), 1),
    all_quantitative: runsRead.factors.every((f) => f.factor_type === "quantitative"),
    n_runs_measured: runsRead.runs.filter((r) =>
      Object.values(r.response_values ?? {}).some((v) => v != null),
    ).length,
  };
  return callEngine<AdvisorReport>("advise", { result, design_meta: designMeta });
}
