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
