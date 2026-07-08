"use client";

import { useEffect, useMemo, useState } from "react";

import { AnovaTable } from "@/components/AnovaTable";
import { CoefTable } from "@/components/CoefTable";
import { ContourPlot } from "@/components/ContourPlot";
import { EffectsTable } from "@/components/EffectsTable";
import { EstimabilityWarning } from "@/components/EstimabilityWarning";
import { FactorPairSelector } from "@/components/FactorPairSelector";
import { InteractionPlot } from "@/components/InteractionPlot";
import { MainEffectsPlot } from "@/components/MainEffectsPlot";
import { ModelBuilder } from "@/components/ModelBuilder";
import { ObsVsPredPlot } from "@/components/ObsVsPredPlot";
import { ParetoPlot } from "@/components/ParetoPlot";
import { PlotCard } from "@/components/PlotCard";
import { QQPlot } from "@/components/QQPlot";
import { ResidualVsFittedPlot } from "@/components/ResidualVsFittedPlot";
import { StatsPanel } from "@/components/StatsPanel";
import { SurfacePlot } from "@/components/SurfacePlot";
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
  const [pair, setPair] = useState<[string, string] | null>(null);

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

  const analysis = useAnalysis(
    experimentId,
    response,
    model,
    pair?.[0] ?? null,
    pair?.[1] ?? null,
  );
  const data = analysis.data;
  const plots = data?.plots ?? null;

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

          {plots ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {plots.surface ? (
                <PlotCard
                  title="Superfície de Resposta"
                  bodyClassName="h-96"
                  hint={
                    plots.factor_pairs.length > 1 ? (
                      <FactorPairSelector
                        pairs={plots.factor_pairs}
                        selected={pair ?? plots.selected_pair}
                        onSelect={setPair}
                      />
                    ) : undefined
                  }
                >
                  <SurfacePlot
                    surface={plots.surface}
                    responseName={response ?? ""}
                  />
                </PlotCard>
              ) : null}

              {plots.contour ? (
                <PlotCard title="Gráfico de Contorno" bodyClassName="h-96">
                  <ContourPlot contour={plots.contour} />
                </PlotCard>
              ) : null}

              {plots.pareto ? (
                <PlotCard title="Pareto dos Efeitos">
                  <ParetoPlot pareto={plots.pareto} />
                </PlotCard>
              ) : null}

              {plots.main_effects.length > 0 ? (
                <PlotCard title="Efeitos Principais">
                  <MainEffectsPlot
                    mainEffects={plots.main_effects}
                    grandMean={plots.grand_mean}
                    responseName={response ?? ""}
                  />
                </PlotCard>
              ) : null}

              {plots.interaction ? (
                <PlotCard title="Gráfico de Interação">
                  <InteractionPlot
                    interaction={plots.interaction}
                    responseName={response ?? ""}
                  />
                </PlotCard>
              ) : null}

              {plots.obs_vs_pred ? (
                <PlotCard title="Observado vs. Predito">
                  <ObsVsPredPlot data={plots.obs_vs_pred} />
                </PlotCard>
              ) : null}

              {plots.residual_vs_fitted ? (
                <PlotCard title="Resíduos vs. Ajustado">
                  <ResidualVsFittedPlot data={plots.residual_vs_fitted} />
                </PlotCard>
              ) : null}

              {plots.qq ? (
                <PlotCard title="Gráfico Q-Q Normal">
                  <QQPlot qq={plots.qq} />
                </PlotCard>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
