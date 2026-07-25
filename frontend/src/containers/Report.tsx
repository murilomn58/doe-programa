"use client";

import { useEffect, useMemo, useState } from "react";

import {
  fetchReportPlot,
  REPORT_PLOTS,
  type ReportPlotKind,
} from "@/api/reportImages";
import { ReportSection } from "@/components/ReportSection";
import type { AnalysisResult, RSMModel } from "@/domain/analysis";
import type { FactorRead, RunRead } from "@/domain/design";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useRuns } from "@/hooks/useRuns";
import { fmt, fmtP } from "@/lib/formatters";

interface ReportProps {
  experimentId: number;
  response: string;
  model: RSMModel;
}

/** Human titles + short PT-BR interpretation blurbs, keyed by plot kind. */
const PLOT_TITLE: Record<ReportPlotKind, string> = {
  surface: "Superfície de resposta",
  contour: "Gráfico de contorno",
  pareto: "Pareto dos efeitos padronizados",
  main_effects: "Efeitos principais",
  interaction: "Gráfico de interação",
  obs_vs_pred: "Observado vs. predito",
  residual_vs_fitted: "Resíduos vs. valores ajustados",
  qq: "Gráfico Q-Q normal dos resíduos",
};

const PLOT_HINT: Record<ReportPlotKind, string> = {
  surface:
    "Superfície ajustada do modelo sobre o par de fatores; os pontos são os ensaios observados.",
  contour:
    "Projeção da superfície em curvas de nível — regiões de mesma resposta prevista.",
  pareto:
    "Efeitos ordenados por magnitude; barras além da linha tracejada são significativos ao nível α.",
  main_effects:
    "Média da resposta em cada nível do fator; inclinação acentuada indica efeito principal forte.",
  interaction:
    "Linhas não paralelas indicam interação entre os fatores.",
  obs_vs_pred:
    "Alinhamento à reta de 45° indica bom ajuste do modelo aos dados.",
  residual_vs_fitted:
    "Dispersão aleatória em torno de zero sustenta as premissas do modelo.",
  qq: "Pontos próximos à reta sustentam a hipótese de resíduos normais.",
};

interface LoadedFigure {
  kind: ReportPlotKind;
  url: string;
}

/**
 * Printable report container. Fetches the stored matrix + analysis, embeds the
 * publication figures (server-rendered PNGs) and, once EVERYTHING is on screen,
 * mounts a ``#report-ready`` sentinel that Playwright waits for before printing.
 *
 * The page renders in a LIGHT theme (white paper). It never sets the sentinel
 * before the data, tables and every figure image have finished painting.
 */
export function Report({ experimentId, response, model }: ReportProps) {
  const runsQuery = useRuns(experimentId);
  const analysis = useAnalysis(experimentId, response, model);

  const data = analysis.data ?? null;
  const plots = data?.plots ?? null;

  // Which of the eight figures does this fit actually produce? Ask the plot
  // bundle so we never fetch a figure the backend would answer 422 for.
  const expectedPlots = useMemo<ReportPlotKind[]>(() => {
    if (!plots) return [];
    return REPORT_PLOTS.filter((kind) => plotIsPresent(kind, plots));
  }, [plots]);

  // Fetched figure URLs (object URLs); revoked on unmount / refetch.
  const [figures, setFigures] = useState<LoadedFigure[]>([]);
  const [figuresFetched, setFiguresFetched] = useState(false);
  // Count of <img> elements that finished painting (onload/onerror).
  const [paintedCount, setPaintedCount] = useState(0);

  const selectedPair = plots?.selected_pair ?? null;
  const factorX = selectedPair?.[0] ?? null;
  const factorY = selectedPair?.[1] ?? null;

  // Fetch every expected figure once the analysis + pair are known.
  useEffect(() => {
    // Nothing to fetch: analysis not ready yet, non-estimable, or a fit that
    // produces no figures. Mark "fetched" only once the analysis has resolved
    // (so we don't declare readiness before the data is in).
    if (!data || !data.estimable || expectedPlots.length === 0) {
      setFigures([]);
      setFiguresFetched(Boolean(data));
      setPaintedCount(0);
      return;
    }

    let cancelled = false;
    setFiguresFetched(false);
    setPaintedCount(0);

    void Promise.all(
      expectedPlots.map(async (kind) => {
        try {
          const url = await fetchReportPlot({
            experimentId,
            responseName: response,
            model,
            plot: kind,
            factorX,
            factorY,
          });
          return url ? { kind, url } : null;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) {
        for (const r of results) if (r) URL.revokeObjectURL(r.url);
        return;
      }
      setFigures(results.filter((r): r is LoadedFigure => r !== null));
      setFiguresFetched(true);
    });

    return () => {
      cancelled = true;
    };
  }, [
    data,
    expectedPlots,
    experimentId,
    response,
    model,
    factorX,
    factorY,
  ]);

  // Revoke object URLs when the figure set changes or on unmount.
  useEffect(() => {
    return () => {
      for (const f of figures) URL.revokeObjectURL(f.url);
    };
  }, [figures]);

  const runsReady = runsQuery.isSuccess && Boolean(runsQuery.data);
  const analysisReady = analysis.isSuccess && Boolean(data);
  const allPainted = figuresFetched && paintedCount >= figures.length;
  const ready = runsReady && analysisReady && allPainted;

  const factors = runsQuery.data?.factors ?? [];
  const runs = runsQuery.data?.runs ?? [];
  const responseUnit = useMemo(() => {
    const found = runsQuery.data?.responses.find((r) => r.name === response);
    return found?.unit ?? null;
  }, [runsQuery.data, response]);

  const now = useMemo(() => formatDate(new Date()), []);

  if (runsQuery.isError) {
    return (
      <ReportError message="Não foi possível carregar o experimento." />
    );
  }
  if (analysis.isError) {
    return (
      <ReportError
        message={
          analysis.error instanceof Error
            ? analysis.error.message
            : "Falha ao rodar a análise."
        }
      />
    );
  }

  return (
    <div className="report-root mx-auto max-w-[21cm] bg-white px-10 py-10 text-slate-900">
      {/* Header */}
      <header className="mb-8 border-b-2 border-slate-800 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">
              Relatório de Planejamento de Experimentos (DoE)
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Experimento #{experimentId}
            </h1>
          </div>
          {/* Atalho no topo (o flutuante continua existindo no fim da página). */}
          <button
            type="button"
            onClick={() => window.print()}
            className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-primary-strong print:hidden"
          >
            Salvar como PDF
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
          <span>
            Resposta:{" "}
            <strong className="text-slate-800">
              {response}
              {responseUnit ? ` (${responseUnit})` : ""}
            </strong>
          </span>
          <span>
            Modelo: <strong className="text-slate-800">{modelLabel(model)}</strong>
          </span>
          <span>
            Gerado em: <strong className="text-slate-800">{now}</strong>
          </span>
        </div>
      </header>

      {data && !data.estimable ? (
        <ReportSection title="Modelo não estimável">
          <ul className="list-disc pl-5 text-sm text-red-700">
            {(data.warnings.length > 0
              ? data.warnings
              : ["O modelo escolhido não é estimável com os dados atuais."]
            ).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </ReportSection>
      ) : null}

      {/* Factors and levels */}
      {runsReady ? (
        <ReportSection
          title="Fatores e níveis"
          interpretation="Variáveis de entrada controladas e seus níveis experimentais."
        >
          <FactorsTable factors={factors} />
        </ReportSection>
      ) : null}

      {/* Design matrix */}
      {runsReady ? (
        <ReportSection
          title="Matriz de projeto"
          interpretation={`Planejamento com ${runs.length} ensaios.`}
        >
          <DesignMatrixTable
            factors={factors}
            runs={runs}
            responseName={response}
            responseUnit={responseUnit}
          />
        </ReportSection>
      ) : null}

      {/* ANOVA */}
      {data && data.estimable && !data.saturated ? (
        <ReportSection
          title="Análise de variância (ANOVA)"
          interpretation={anovaInterpretation(data)}
        >
          <AnovaBlock data={data} />
        </ReportSection>
      ) : null}

      {/* Coefficients */}
      {data && data.estimable && data.coefficients.length > 0 ? (
        <ReportSection
          title="Coeficientes de regressão"
          interpretation="Coeficientes do modelo ajustado nas escalas codificada (±1) e natural."
        >
          <CoefBlock data={data} />
        </ReportSection>
      ) : null}

      {/* Fit statistics */}
      {data && data.estimable && data.stats ? (
        <ReportSection
          title="Estatísticas de ajuste"
          interpretation={statsInterpretation(data)}
        >
          <StatsBlock data={data} />
        </ReportSection>
      ) : null}

      {/* Figures */}
      {figures.length > 0 ? (
        <ReportSection title="Gráficos">
          <div className="grid grid-cols-2 gap-6">
            {figures.map((fig) => (
              <figure key={fig.kind} className="break-inside-avoid">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fig.url}
                  alt={PLOT_TITLE[fig.kind]}
                  className="w-full rounded border border-slate-200"
                  onLoad={() => setPaintedCount((c) => c + 1)}
                  onError={() => setPaintedCount((c) => c + 1)}
                />
                <figcaption className="mt-1 text-xs text-slate-600">
                  <strong className="text-slate-800">
                    {PLOT_TITLE[fig.kind]}.
                  </strong>{" "}
                  {PLOT_HINT[fig.kind]}
                </figcaption>
              </figure>
            ))}
          </div>
        </ReportSection>
      ) : null}

      <footer className="mt-10 border-t border-slate-300 pt-3 text-[10px] text-slate-400">
        Design of Experiments: relatório gerado automaticamente.
      </footer>

      {/* Salvar PDF local: sem servidor headless, o print do navegador gera o PDF. */}
      {ready ? (
        <button
          type="button"
          onClick={() => window.print()}
          className="fixed bottom-6 right-6 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-strong print:hidden"
        >
          Salvar como PDF
        </button>
      ) : null}

      {/* Sentinel: Playwright waits for #report-ready before printing. */}
      {ready ? <div id="report-ready" data-ready="true" /> : null}
    </div>
  );
}

// --- sub-blocks --------------------------------------------------------------

function ReportError({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-[21cm] bg-white px-10 py-10 text-slate-900">
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

const th =
  "border-b border-slate-300 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
const thR = `${th} text-right`;
const td = "border-b border-slate-100 px-3 py-1.5 text-left text-sm text-slate-800";
const tdR = `${td} text-right font-mono`;

function FactorsTable({ factors }: { factors: FactorRead[] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className={th}>Fator</th>
          <th className={th}>Tipo</th>
          <th className={th}>Unidade</th>
          <th className={thR}>Nível −1</th>
          <th className={thR}>Nível +1</th>
        </tr>
      </thead>
      <tbody>
        {factors.map((f) => {
          const low = f.levels.find((l) => l.coded_value < 0) ?? null;
          const high = f.levels.find((l) => l.coded_value > 0) ?? null;
          return (
            <tr key={f.name}>
              <td className={`${td} font-medium`}>{f.name}</td>
              <td className={td}>
                {f.factor_type === "quantitative" ? "Quantitativo" : "Qualitativo"}
              </td>
              <td className={td}>{f.unit ?? "—"}</td>
              <td className={tdR}>{levelText(low)}</td>
              <td className={tdR}>{levelText(high)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function levelText(
  level: { natural_value: number | null; label: string | null } | null,
): string {
  if (!level) return "—";
  if (level.label) return level.label;
  if (level.natural_value !== null) return fmt(level.natural_value, 3);
  return "—";
}

function DesignMatrixTable({
  factors,
  runs,
  responseName,
  responseUnit,
}: {
  factors: FactorRead[];
  runs: RunRead[];
  responseName: string;
  responseUnit: string | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={thR}>Ensaio</th>
            <th className={thR}>Std</th>
            {factors.map((f) => (
              <th key={f.name} className={thR}>
                {f.name}
              </th>
            ))}
            <th className={thR}>
              {responseName}
              {responseUnit ? ` (${responseUnit})` : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.run_order}>
              <td className={tdR}>{run.run_order}</td>
              <td className={tdR}>{run.std_order}</td>
              {factors.map((f) => {
                const cell = run.factors[f.name];
                return (
                  <td key={f.name} className={tdR}>
                    {cellText(cell)}
                  </td>
                );
              })}
              <td className={tdR}>
                {fmtValue(run.response_values[responseName])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function cellText(
  cell: { natural: number | null; label: string | null } | undefined,
): string {
  if (!cell) return "—";
  if (cell.label) return cell.label;
  if (cell.natural !== null) return fmt(cell.natural, 3);
  return "—";
}

function fmtValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return fmt(value, 4);
}

function AnovaBlock({ data }: { data: AnalysisResult }) {
  const rows = [
    ...data.anova,
    ...(data.curvature ? [data.curvature] : []),
    ...(data.lack_of_fit ? [data.lack_of_fit] : []),
    ...(data.pure_error ? [data.pure_error] : []),
    ...(data.total ? [data.total] : []),
  ];
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className={th}>Fonte</th>
          <th className={thR}>SQ</th>
          <th className={thR}>GL</th>
          <th className={thR}>QM</th>
          <th className={thR}>F</th>
          <th className={thR}>p-valor</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const sig = r.p !== null && r.p < 0.05;
          return (
            <tr key={r.source}>
              <td className={`${td} font-medium`}>{r.source}</td>
              <td className={tdR}>{fmt(r.ss, 4)}</td>
              <td className={tdR}>{r.df}</td>
              <td className={tdR}>{fmt(r.ms, 4)}</td>
              <td className={tdR}>{fmt(r.f, 4)}</td>
              <td className={`${tdR} ${sig ? "font-semibold text-emerald-700" : ""}`}>
                {fmtP(r.p)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CoefBlock({ data }: { data: AnalysisResult }) {
  const saturated = data.saturated;
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className={th}>Termo</th>
          <th className={thR}>Coef. (cod.)</th>
          <th className={thR}>Coef. (natural)</th>
          {saturated ? null : (
            <>
              <th className={thR}>Erro padrão</th>
              <th className={thR}>t</th>
              <th className={thR}>p-valor</th>
              <th className={thR}>VIF</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {data.coefficients.map((c) => (
          <tr key={c.term}>
            <td className={`${td} font-medium`}>{c.term}</td>
            <td className={tdR}>{fmt(c.coef_coded, 5)}</td>
            <td className={tdR}>{fmt(c.coef_natural, 5)}</td>
            {saturated ? null : (
              <>
                <td className={tdR}>{fmt(c.std_err, 5)}</td>
                <td className={tdR}>{fmt(c.t, 4)}</td>
                <td className={tdR}>{fmtP(c.p)}</td>
                <td className={tdR}>{fmt(c.vif, 2)}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatsBlock({ data }: { data: AnalysisResult }) {
  const s = data.stats;
  if (!s) return null;
  const items: { label: string; value: string }[] = [
    { label: "R²", value: fmt(s.r_squared, 4) },
    { label: "R² ajustado", value: fmt(s.adj_r_squared, 4) },
    { label: "R² previsto", value: fmt(s.predicted_r_squared, 4) },
    { label: "RMSE", value: fmt(s.rmse, 4) },
    { label: "PRESS", value: fmt(s.press, 4) },
    { label: "SQ residual", value: fmt(s.sse, 4) },
    { label: "GL (erro)", value: String(s.df_resid) },
    { label: "Nº de ensaios", value: String(s.n_obs) },
  ];
  return (
    <dl className="grid grid-cols-4 gap-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
        >
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">
            {it.label}
          </dt>
          <dd className="mt-0.5 font-mono text-base text-slate-900">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// --- interpretation + formatting helpers -------------------------------------

function anovaInterpretation(data: AnalysisResult): string {
  // The ANOVA lists one row per model term (A, B, AB, …) — there is no single
  // "Modelo" row. Read significance from the terms: how many are p < 0,05.
  const withP = data.anova.filter((r) => r.p !== null);
  const sig = withP.filter((r) => (r.p as number) < 0.05);
  if (withP.length === 0) {
    return "Decomposição da variabilidade da resposta pelas fontes do modelo.";
  }
  if (sig.length === 0) {
    return "Nenhum termo atingiu significância ao nível de 5%.";
  }
  const names = sig.map((r) => r.source).join(", ");
  return `${sig.length} de ${withP.length} termos são significativos ao nível de 5% (${names}).`;
}

function statsInterpretation(data: AnalysisResult): string {
  const r2 = data.stats?.r_squared;
  if (r2 === undefined || r2 === null || Number.isNaN(r2)) {
    return "Indicadores de qualidade do ajuste do modelo.";
  }
  const quality = r2 >= 0.9 ? "bom" : r2 >= 0.75 ? "razoável" : "modesto";
  const decimal = fmt(r2, 4).replace(".", ",");
  return `R² = ${decimal} indica ajuste ${quality} do modelo aos dados.`;
}

function modelLabel(model: RSMModel): string {
  switch (model) {
    case "linear":
      return "Linear";
    case "linear_interactions":
      return "Linear + Interações";
    case "linear_quadratic":
      return "Linear + Quadrático";
    case "full":
      return "Completo";
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Which plot kinds the current fit actually produced (present in the bundle).
function plotIsPresent(
  kind: ReportPlotKind,
  plots: NonNullable<AnalysisResult["plots"]>,
): boolean {
  switch (kind) {
    case "surface":
      return plots.surface !== null;
    case "contour":
      return plots.contour !== null;
    case "pareto":
      return plots.pareto !== null;
    case "main_effects":
      return plots.main_effects.length > 0;
    case "interaction":
      return plots.interaction !== null;
    case "obs_vs_pred":
      return plots.obs_vs_pred !== null;
    case "residual_vs_fitted":
      return plots.residual_vs_fitted !== null;
    case "qq":
      return plots.qq !== null;
  }
}
