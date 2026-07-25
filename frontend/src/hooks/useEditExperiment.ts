/** Hooks de edição/evolução de experimento (Fase B). */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { augmentDesign, type AugmentOption } from "@/api/designs";
import {
  deleteExperimentLocal,
  updateExperimentMeta,
  updateFactorsPreservingResponses,
  type FactorEdit,
} from "@/engine/store";
import { EXPERIMENTS_KEY } from "@/hooks/useExperiments";
import { RUNS_KEY } from "@/hooks/useRuns";

export function useUpdateExperimentMeta(experimentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (meta: { name?: string; description?: string | null }) =>
      updateExperimentMeta(experimentId, meta),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: EXPERIMENTS_KEY });
    },
  });
}

export function useUpdateFactors(experimentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (edits: FactorEdit[]) =>
      updateFactorsPreservingResponses(experimentId, edits),
    onSuccess: (runsRead) => {
      qc.setQueryData(RUNS_KEY(experimentId), runsRead);
      void qc.invalidateQueries({ queryKey: RUNS_KEY(experimentId) });
      void qc.invalidateQueries({ queryKey: ["analysis"] });
    },
  });
}

export function useAugmentDesign(experimentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (option: AugmentOption) => augmentDesign(experimentId, option),
    onSuccess: (result) => {
      qc.setQueryData(RUNS_KEY(experimentId), result.runsRead);
      void qc.invalidateQueries({ queryKey: RUNS_KEY(experimentId) });
      void qc.invalidateQueries({ queryKey: ["analysis"] });
    },
  });
}

export function useDeleteExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (experimentId: number) => deleteExperimentLocal(experimentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: EXPERIMENTS_KEY });
    },
  });
}
