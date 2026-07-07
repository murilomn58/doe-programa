"use client";

import { useEffect, useMemo, useState } from "react";

import { AnovaTable } from "@/components/AnovaTable";
import { CoefTable } from "@/components/CoefTable";
import { EffectsTable } from "@/components/EffectsTable";
import { EstimabilityWarning } from "@/components/EstimabilityWarning";
import { ModelBuilder } from "@/components/ModelBuilder";
import { StatsPanel } from "@/components/StatsPanel";
import type { RSMModel } from "@/domain/analysis";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useRuns } from "@/hooks/useRuns";

interface AnalysisProps {
  experimentId: number;
}

/** Orchestrates model selection + analysis rendering for one experiment. */
export function Analysis({ experimentId }: AnalysisProps) {
  const runsQuery = useRuns(experimentId);
  const [response, setResponse] = useState<string | null>(null);
  const [model, setModel] = useState<RSMModel>("linear");

  const responses = useMemo(
    () => runsQuery.data?.responses ?? [],
    [runsQuery.data],
  );

  // Default to the first response once the matrix loads.
  useEffect(() => {
    if (response === null && responses.length > 0) {
      setResponse(responses[0].name);
    }
  }, [response, responses]);

  const analysis = useAnalysis(experimentId, response, model);
  const data = analysis.data;

  if (runsQuery.isLoading) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 text-sm text-slate-400">
        Carregando experimento…
      </div>
    );
  }

  if (runsQuery.isError || !runsQuery.data) {
    return (
      <div className="rounded-xl border border-red-800 bg-slate-800 p-6 text-sm text-red-400">
        Não foi possível carregar o experimento.
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <div className="rounded-xl border border-amber-800 bg-slate-800 p-6 text-sm text-amber-400">
        Este experimento não tem variáveis de resposta para analisar.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModelBuilder
        responses={responses.map((r) => r.name)}
        selectedResponse={response}
        onSelectResponse={setResponse}
        model={model}
        onSelectModel={setModel}
        terms={data?.terms ?? []}
      />

      {analysis.isLoading ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 text-sm text-slate-400">
          Calculando análise…
        </div>
      ) : null}

      {analysis.isError ? (
        <div className="rounded-xl border border-red-800 bg-slate-800 p-6 text-sm text-red-400">
          {analysis.error instanceof Error
            ? analysis.error.message
            : "Falha ao rodar a análise."}
        </div>
      ) : null}

      {data && !data.estimable ? (
        <EstimabilityWarning warnings={data.warnings} tone="error" />
      ) : null}

      {data && data.estimable ? (
        <>
          {data.saturated ? (
            <EstimabilityWarning warnings={data.warnings} tone="warn" />
          ) : (
            <AnovaTable
              rows={data.anova}
              pureError={data.pure_error}
              lackOfFit={data.lack_of_fit}
              total={data.total}
              rSquared={data.r_squared}
              adjRSquared={data.adj_r_squared}
              msPureError={data.ms_pure_error}
            />
          )}
          <EffectsTable effects={data.effects} saturated={data.saturated} />
          <CoefTable coefficients={data.coefficients} saturated={data.saturated} />
          <StatsPanel stats={data.stats} lenth={data.lenth} />
        </>
      ) : null}
    </div>
  );
}
