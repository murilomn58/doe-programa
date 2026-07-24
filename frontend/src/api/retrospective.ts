/** API layer: retrospective diagnosis/materialization on the local engine. */

import type {
  RetroDiagnoseRequest,
  RetroDiagnoseResponse,
  RetroMaterializeRequest,
  RetroMaterializeResult,
} from "@/domain/retrospective";
import type { GeneratedDesign } from "@/domain/design";
import { callEngine } from "@/engine/client";
import { persistGeneratedDesign } from "@/engine/store";

export async function postDiagnose(
  input: RetroDiagnoseRequest,
): Promise<RetroDiagnoseResponse> {
  return callEngine<RetroDiagnoseResponse>("retro_diagnose", { req: input });
}

interface MaterializePayload {
  design: GeneratedDesign;
  design_type: string;
  n_runs: number;
  excluded_constant_factors: string[];
  warnings: string[];
  name: string;
  description: string | null;
}

export async function postMaterialize(
  input: RetroMaterializeRequest,
): Promise<RetroMaterializeResult> {
  const payload = await callEngine<MaterializePayload>("retro_materialize", {
    req: input,
  });
  const persisted = await persistGeneratedDesign(payload.design, {
    experimentId: null,
    name: payload.name,
  });
  return {
    experiment_id: persisted.experiment_id,
    design_type: payload.design_type,
    n_runs: payload.n_runs,
    excluded_constant_factors: payload.excluded_constant_factors,
    warnings: payload.warnings,
  };
}
