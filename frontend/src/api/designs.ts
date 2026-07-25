/** API layer: design generation via the local scientific engine (Pyodide). */

import type {
  DesignGenerateRequest,
  GeneratedDesign,
  TaguchiCatalog,
} from "@/domain/design";
import { callEngine } from "@/engine/client";
import { persistGeneratedDesign } from "@/engine/store";

export async function generateDesign(
  input: DesignGenerateRequest,
): Promise<GeneratedDesign> {
  const raw = await callEngine<GeneratedDesign>("generate_design", { req: input });
  return persistGeneratedDesign(raw, {
    experimentId: input.experiment_id ?? null,
    name: input.name ?? null,
  });
}

/** Taguchi orthogonal arrays for the DesignPicker (computed locally). */
export async function fetchTaguchiCatalog(): Promise<TaguchiCatalog> {
  return callEngine<TaguchiCatalog>("taguchi_catalog");
}

// --- evolução do design (Fase B) ----------------------------------------------

export type AugmentOption =
  | { kind: "center_points"; n: number }
  | { kind: "extend_ccd"; variant?: "rotatable" | "face_centered"; n_center?: number }
  | { kind: "replicates"; n: number };

export interface AugmentResult {
  runsRead: import("@/domain/design").RunsRead;
  note: string;
}

/** Evolui o design existente (pontos centrais, extensão pra CCD, réplicas):
 *  o motor gera os ensaios novos e o store anexa preservando os medidos. */
export async function augmentDesign(
  experimentId: number,
  option: AugmentOption,
): Promise<AugmentResult> {
  const { getDesignForAugment, appendRunsLocal } = await import("@/engine/store");
  const design = await getDesignForAugment(experimentId);
  const out = await callEngine<{ new_runs: import("@/domain/design").RunRead[]; note: string }>(
    "augment_design",
    { design, option },
  );
  const runsRead = await appendRunsLocal(experimentId, out.new_runs);
  return { runsRead, note: out.note };
}
