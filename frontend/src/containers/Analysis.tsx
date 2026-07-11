"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { ExportPlotKind } from "@/api/exportPlots";
import { exportPlot } from "@/api/exportPlots";
import { AnovaTable } from "@/components/AnovaTable";
import { CoefTable } from "@/components/CoefTable";
import { ContourPlot } from "@/components/ContourPlot";
import { CubePlot } from "@/components/CubePlot";
import { DesirabilityOverlay } from "@/components/DesirabilityOverlay";
import { EffectsTable } from "@/components/EffectsTable";
import { EstimabilityWarning } from "@/components/EstimabilityWarning";
import { FactorPairSelector } from "@/components/FactorPairSelector";
import { HalfNormalPlot } from "@/components/HalfNormalPlot";
import { InfluencePlot } from "@/components/InfluencePlot";
import { InteractionPlot } from "@/components/InteractionPlot";
import { MainEffectsPlot } from "@/components/MainEffectsPlot";
import { ModelBuilder } from "@/components/ModelBuilder";
import { ObsVsPredPlot } from "@/components/ObsVsPredPlot";
import { ParetoPlot } from "@/components/ParetoPlot";
import { PlotCard, type PlotExportFormat } from "@/components/PlotCard";
import { Profiler } from "@/components/Profiler";
import { QQPlot } from "@/components/QQPlot";
import { ResidualVsFittedPlot } from "@/components/ResidualVsFittedPlot";
import { ResidualVsOrderPlot } from "@/components/ResidualVsOrderPlot";
import { StatsPanel } from "@/components/StatsPanel";
import { SurfacePlot } from "@/components/SurfacePlot";
import { Callout } from "@/components/ui/Callout";
import type { RSMModel } from "@/domain/analysis";
import { RSM_MODELS } from "@/domain/analysis";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useRuns } from "@/hooks/useRuns";

interface AnalysisProps {
  experimentId: number;
}

const VALID_MODELS = new Set<RSMModel>(RSM_MODELS.map((m) => m.value));

function initialModel(raw: string | null): RSMModel {
  return raw && VALID_MODELS.has(raw as RSMModel)
    ? (raw as RSMModel)
    : "linear";
}

/** Orchestrates model selection + analysis rendering for one experiment. */
export function Analysis({ experimentId }: AnalysisProps) {
  const runsQuery = useRuns(experimentId);
  // Retrospective flow deep-links here with ?model= & ?response= — seed state.
  const searchParams = useSearchParams();
  const [response, setResponse] = useState<string | null>(
    () => searchParams.get("response"),
  );
  const [model, setModel] = useState<RSMModel>(() =>
    initialModel(searchParams.get("model")),
  );
  const [pair, setPair] = useState<[string, string] | null>(null);

  const responses = useMemo(
    () => runsQuery.data?.responses ?? [],
    [runsQuery.data],
  );

  const factors = useMemo(
    () => runsQuery.data?.factors ?? [],
    [runsQuery.data],
  );

  // Unit lookups: name → unit (undefined when the column has no unit).
  const factorUnit = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of factors) if (f.unit) map.set(f.name, f.unit);
    return map;
  }, [factors]);

  const responseUnit = useMemo(() => {
    const found = responses.find((r) => r.name === response);
    return found?.unit ?? undefined;
  }, [responses, response]);

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

  // The factor pair currently driving surface/contour/interaction (state wins,
  // else the backend's default selection) — exported figures must match on-screen.
  const activePair = pair ?? plots?.selected_pair ?? null;

  // Which plot is currently exporting (for the busy state) + last export error.
  const [exporting, setExporting] = useState<ExportPlotKind | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const runExport = useCallback(
    async (plot: ExportPlotKind, format: PlotExportFormat) => {
      if (!response) return;
      setExporting(plot);
      setExportError(null);
      try {
        await exportPlot({
          experiment_id: experimentId,
          response_name: response,
          model,
          plot,
          format,
          dpi: 600,
          factor_x: activePair?.[0] ?? null,
          factor_y: activePair?.[1] ?? null,
        });
      } catch (err) {
        setExportError(
          err instanceof Error ? err.message : "Falha ao exportar a figura.",
        );
      } finally {
        setExporting(null);
      }
    },
    [experimentId, response, model, activePair],
  );

  // Build the export menu for one plot kind (bound to the current context).
  const exportOptionsFor = useCallback(
    (plot: ExportPlotKind) => ({
      onExport: (format: PlotExportFormat) => void runExport(plot, format),
      busy: exporting === plot,
    }),
    [runExport, exporting],
  );

  if (runsQuery.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface-1 p-6 text-sm text-muted">
        Carregando experimento…
      </div>
    );
  }

  if (runsQuery.isError || !runsQuery.data) {
    return (
      <div className="rounded-xl border border-danger-border bg-surface-1 p-6 text-sm text-danger">
        Não foi possível carregar o experimento.
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <div className="rounded-xl border border-warning-border bg-surface-1 p-6 text-sm text-warning">
        Este experimento não tem variáveis de resposta para analisar.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Callout label="Como ler">
        Comece pela variável de resposta e pelo modelo. Na ANOVA e nos efeitos,
        os valores em <b className="text-significant">verde</b> têm p &lt; 0,05
        (estatisticamente significativos). O R² mostra o quanto o modelo
        explica; os gráficos ajudam a validar o ajuste e a achar o ponto ótimo.
      </Callout>
      <ModelBuilder
        responses={responses.map((r) => r.name)}
        selectedResponse={response}
        onSelectResponse={setResponse}
        model={model}
        onSelectModel={setModel}
        terms={data?.terms ?? []}
      />

      {analysis.isLoading ? (
        <div className="rounded-xl border border-border bg-surface-1 p-6 text-sm text-muted">
          Calculando análise…
        </div>
      ) : null}

      {analysis.isError ? (
        <div className="rounded-xl border border-danger-border bg-surface-1 p-6 text-sm text-danger">
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

          {exportError ? (
            <div className="rounded-xl border border-danger-border bg-surface-1 p-3 text-sm text-danger">
              {exportError}
            </div>
          ) : null}

          {plots ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {plots.surface ? (
                <PlotCard
                  title="Superfície de Resposta"
                  bodyClassName="h-96"
                  exportOptions={exportOptionsFor("surface")}
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
                    xUnit={factorUnit.get(plots.surface.factor_x)}
                    yUnit={factorUnit.get(plots.surface.factor_y)}
                    zUnit={responseUnit}
                  />
                </PlotCard>
              ) : null}

              {plots.contour ? (
                <PlotCard
                  title="Gráfico de Contorno"
                  bodyClassName="h-96"
                  exportOptions={exportOptionsFor("contour")}
                >
                  <ContourPlot
                    contour={plots.contour}
                    responseName={response ?? ""}
                    xUnit={factorUnit.get(plots.contour.factor_x)}
                    yUnit={factorUnit.get(plots.contour.factor_y)}
                    zUnit={responseUnit}
                  />
                </PlotCard>
              ) : null}

              {plots.pareto ? (
                <PlotCard
                  title="Pareto dos Efeitos"
                  exportOptions={exportOptionsFor("pareto")}
                >
                  <ParetoPlot pareto={plots.pareto} />
                </PlotCard>
              ) : null}

              {plots.main_effects.length > 0 ? (
                <PlotCard
                  title="Efeitos Principais"
                  exportOptions={exportOptionsFor("main_effects")}
                >
                  <MainEffectsPlot
                    mainEffects={plots.main_effects}
                    grandMean={plots.grand_mean}
                    responseName={response ?? ""}
                    responseUnit={responseUnit}
                  />
                </PlotCard>
              ) : null}

              {plots.interaction ? (
                <PlotCard
                  title="Gráfico de Interação"
                  exportOptions={exportOptionsFor("interaction")}
                >
                  <InteractionPlot
                    interaction={plots.interaction}
                    responseName={response ?? ""}
                    xUnit={factorUnit.get(plots.interaction.factor_x)}
                    responseUnit={responseUnit}
                  />
                </PlotCard>
              ) : null}

              {plots.cube ? (
                <PlotCard title="Cubo 2³" bodyClassName="h-96">
                  <CubePlot
                    cube={plots.cube}
                    responseName={response ?? ""}
                    responseUnit={responseUnit}
                  />
                </PlotCard>
              ) : null}

              {plots.obs_vs_pred ? (
                <PlotCard
                  title="Observado vs. Predito"
                  exportOptions={exportOptionsFor("obs_vs_pred")}
                >
                  <ObsVsPredPlot data={plots.obs_vs_pred} unit={responseUnit} />
                </PlotCard>
              ) : null}

              {plots.residual_vs_fitted ? (
                <PlotCard
                  title="Resíduos vs. Ajustado"
                  exportOptions={exportOptionsFor("residual_vs_fitted")}
                >
                  <ResidualVsFittedPlot
                    data={plots.residual_vs_fitted}
                    unit={responseUnit}
                  />
                </PlotCard>
              ) : null}

              {plots.residual_vs_order ? (
                <PlotCard title="Resíduos vs. Ordem">
                  <ResidualVsOrderPlot
                    data={plots.residual_vs_order}
                    unit={responseUnit}
                  />
                </PlotCard>
              ) : null}

              {plots.qq ? (
                <PlotCard
                  title="Gráfico Q-Q Normal"
                  exportOptions={exportOptionsFor("qq")}
                >
                  <QQPlot qq={plots.qq} unit={responseUnit} />
                </PlotCard>
              ) : null}

              {plots.half_normal ? (
                <PlotCard title="Half-Normal dos Efeitos">
                  <HalfNormalPlot halfNormal={plots.half_normal} />
                </PlotCard>
              ) : null}

              {plots.influence ? (
                <PlotCard title="Diagnóstico de Influência">
                  <InfluencePlot influence={plots.influence} />
                </PlotCard>
              ) : null}

              {plots.desirability ? (
                <PlotCard title="Desejabilidade" bodyClassName="h-96">
                  <DesirabilityOverlay
                    desirability={plots.desirability}
                    xUnit={factorUnit.get(plots.desirability.factor_x)}
                    yUnit={factorUnit.get(plots.desirability.factor_y)}
                  />
                </PlotCard>
              ) : null}
            </div>
          ) : null}

          {response ? (
            <section className="rounded-xl border border-border bg-surface-1 p-4 shadow-lg">
              <header className="mb-3">
                <h3 className="text-sm font-medium text-foreground">
                  Profiler interativo
                </h3>
                <p className="text-xs text-faint">
                  Arraste os sliders ou digite o valor exato para explorar a
                  predição do modelo; tudo é recalculado no backend.
                </p>
              </header>
              <Profiler
                experimentId={experimentId}
                responseName={response}
                responseUnit={responseUnit}
                model={model}
                factors={factors}
              />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
