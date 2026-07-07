/** API layer: typed fetch calls to the FastAPI backend. No React here. */

import type { Experiment, NewExperiment } from "@/domain/experiment";
import { API_BASE_URL } from "@/lib/config";

export async function fetchExperiments(): Promise<Experiment[]> {
  const res = await fetch(`${API_BASE_URL}/experiments`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Falha ao listar experimentos (HTTP ${res.status})`);
  }
  return res.json() as Promise<Experiment[]>;
}

export async function createExperiment(
  input: NewExperiment,
): Promise<Experiment> {
  const res = await fetch(`${API_BASE_URL}/experiments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Falha ao criar experimento (HTTP ${res.status})`);
  }
  return res.json() as Promise<Experiment>;
}
