/** API layer: local engine (IndexedDB). Same signatures the hooks always used. */

import type { Experiment, NewExperiment } from "@/domain/experiment";
import { createExperimentLocal, listExperiments } from "@/engine/store";

export async function fetchExperiments(): Promise<Experiment[]> {
  return listExperiments();
}

export async function createExperiment(
  input: NewExperiment,
): Promise<Experiment> {
  return createExperimentLocal(input);
}
