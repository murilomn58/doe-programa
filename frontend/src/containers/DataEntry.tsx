"use client";

import { RunsGrid } from "@/components/RunsGrid";
import type { ResponseValueUpsert } from "@/domain/design";
import { useRuns, useSaveResponses } from "@/hooks/useRuns";

interface DataEntryProps {
  experimentId: number;
}

/** Orchestrates run loading + response saving for one experiment. */
export function DataEntry({ experimentId }: DataEntryProps) {
  const runsQuery = useRuns(experimentId);
  const saveResponses = useSaveResponses(experimentId);

  if (runsQuery.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface-1 p-6 text-sm text-muted">
        Carregando ensaios…
      </div>
    );
  }

  if (runsQuery.isError || !runsQuery.data) {
    return (
      <div className="rounded-xl border border-danger-border bg-surface-1 p-6 text-sm text-danger">
        {runsQuery.error instanceof Error
          ? runsQuery.error.message
          : "Não foi possível carregar os ensaios deste experimento."}
      </div>
    );
  }

  const data = runsQuery.data;

  function handleSave(values: ResponseValueUpsert[]) {
    saveResponses.mutate({ values });
  }

  return (
    <RunsGrid
      factors={data.factors}
      responses={data.responses}
      runs={data.runs}
      onSave={handleSave}
      isSaving={saveResponses.isPending}
      saveError={
        saveResponses.isError && saveResponses.error instanceof Error
          ? saveResponses.error.message
          : null
      }
      savedAt={saveResponses.isSuccess ? saveResponses.submittedAt : null}
      blockLabels={data.block_labels}
      blockName={data.block_name}
    />
  );
}
