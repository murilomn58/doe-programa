/** Interactive profiler: coded sliders per factor → live prediction + slices. */

"use client";

import type { Data } from "plotly.js-dist-min";
import { useEffect, useMemo, useRef, useState } from "react";

import type { RSMModel } from "@/domain/analysis";
import type { FactorRead } from "@/domain/design";
import type { ProfilerSlice } from "@/domain/plots";
import { useProfiler } from "@/hooks/useProfiler";
import {
  Plot,
  PLOT_COLORS,
  darkAxis,
  darkLayout,
  refLine,
  withAlpha,
} from "@/lib/plotly";

interface ProfilerProps {
  experimentId: number;
  responseName: string;
  responseUnit?: string;
  model: RSMModel;
  /** Quantitative factors drive the sliders; qualitative ones are skipped. */
  factors: FactorRead[];
}

/** Debounce (ms) before a slider move triggers a backend recompute. */
const DEBOUNCE_MS = 150;

/** PT-BR number with up to 4 significant digits. */
function fmt(v: number | null | undefined, unit?: string): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const s = v.toPrecision(4).replace(/\.?0+$/, "").replace(".", ",");
  return unit ? `${s} ${unit}` : s;
}

/**
 * Coded [-1, 1] → natural value via linear interpolation between the factor's
 * −1 and +1 levels. Pure display formatting (no statistics) — the prediction
 * itself is always computed in the backend. Falls back to the coded value when
 * natural levels are missing (qualitative / unset).
 */
function codedToNatural(factor: FactorRead, coded: number): number | null {
  const low = factor.levels.find((l) => l.coded_value === -1);
  const high = factor.levels.find((l) => l.coded_value === 1);
  if (
    low?.natural_value === null ||
    low?.natural_value === undefined ||
    high?.natural_value === null ||
    high?.natural_value === undefined
  ) {
    return null;
  }
  const mid = (low.natural_value + high.natural_value) / 2;
  const half = (high.natural_value - low.natural_value) / 2;
  return mid + coded * half;
}

/**
 * Inverso de {@link codedToNatural}: valor natural digitado → codificado [-1,1].
 * Retorna null quando o fator não tem níveis naturais (qualitativo / não
 * definido), caso em que o input passa a interpretar o número como codificado.
 */
function naturalToCoded(factor: FactorRead, natural: number): number | null {
  const low = factor.levels.find((l) => l.coded_value === -1);
  const high = factor.levels.find((l) => l.coded_value === 1);
  if (
    low?.natural_value === null ||
    low?.natural_value === undefined ||
    high?.natural_value === null ||
    high?.natural_value === undefined
  ) {
    return null;
  }
  const half = (high.natural_value - low.natural_value) / 2;
  if (half === 0) return null;
  const mid = (low.natural_value + high.natural_value) / 2;
  return (natural - mid) / half;
}

/** Número limpo para o campo (sem zeros à direita), aceitando vírgula. */
function trimNum(v: number): string {
  return String(Number(v.toFixed(4)));
}

export function Profiler({
  experimentId,
  responseName,
  responseUnit,
  model,
  factors,
}: ProfilerProps) {
  // Only quantitative factors get a −1..1 slider (qualitative levels aren't
  // continuous). Names are the profiler's ``point`` keys.
  const sliderFactors = useMemo(
    () => factors.filter((f) => f.factor_type === "quantitative"),
    [factors],
  );

  // Live slider state (updates every frame) + debounced copy (drives the query).
  const [point, setPoint] = useState<Record<string, number>>({});
  const [debouncedPoint, setDebouncedPoint] = useState<Record<string, number>>(
    {},
  );

  // Seed both maps at the coded center once the factor list is known.
  useEffect(() => {
    const center = Object.fromEntries(sliderFactors.map((f) => [f.name, 0]));
    setPoint(center);
    setDebouncedPoint(center);
  }, [sliderFactors]);

  // Debounce the point before it feeds the backend query (no per-frame POSTs).
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebouncedPoint(point), DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [point]);

  const query = useProfiler(
    experimentId,
    responseName,
    model,
    debouncedPoint,
    true,
  );
  const result = query.data ?? null;

  const setFactor = (name: string, coded: number) =>
    setPoint((prev) => ({ ...prev, [name]: coded }));

  const goToOptimum = () => {
    if (!result) return;
    // Only apply keys we have sliders for; clamp to [-1, 1] defensively.
    const next: Record<string, number> = { ...point };
    for (const f of sliderFactors) {
      const v = result.optimum.point[f.name];
      if (typeof v === "number") next[f.name] = Math.max(-1, Math.min(1, v));
    }
    setPoint(next);
  };

  if (sliderFactors.length === 0) {
    return (
      <p className="text-sm text-faint">
        O profiler exige ao menos um fator quantitativo.
      </p>
    );
  }

  const sliceByFactor = new Map(
    (result?.slices ?? []).map((s) => [s.factor, s]),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PredictionReadout
          prediction={result?.prediction ?? null}
          ciLow={result?.ci_low ?? null}
          ciHigh={result?.ci_high ?? null}
          unit={responseUnit}
          stale={query.isFetching}
        />
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="text-xs text-faint">Ótimo (máx)</div>
            <div className="text-sm font-medium text-significant-soft">
              {fmt(result?.optimum.value ?? null, responseUnit)}
            </div>
          </div>
          <button
            type="button"
            onClick={goToOptimum}
            disabled={!result}
            className="rounded-md border border-significant-strong bg-significant-strong/10 px-3 py-1.5 text-xs font-medium text-significant-soft transition-colors hover:bg-significant-strong/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ir ao ótimo
          </button>
        </div>
      </div>

      {query.isError ? (
        <p className="text-sm text-danger">
          {query.error instanceof Error
            ? query.error.message
            : "Falha ao calcular o profiler."}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sliderFactors.map((f) => (
          <FactorSlice
            key={f.name}
            factor={f}
            coded={point[f.name] ?? 0}
            natural={codedToNatural(f, point[f.name] ?? 0)}
            slice={sliceByFactor.get(f.name) ?? null}
            responseName={responseName}
            responseUnit={responseUnit}
            onChange={(v) => setFactor(f.name, v)}
          />
        ))}
      </div>
    </div>
  );
}

/** Big current-prediction readout with the 95% CI underneath. */
function PredictionReadout({
  prediction,
  ciLow,
  ciHigh,
  unit,
  stale,
}: {
  prediction: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  unit?: string;
  stale: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-faint">Predição no ponto</div>
      <div
        className={`text-2xl font-semibold tabular-nums ${
          stale ? "text-faint" : "text-accent"
        }`}
      >
        {fmt(prediction, unit)}
      </div>
      <div className="text-xs text-faint">
        IC 95%: {fmt(ciLow)} – {fmt(ciHigh)}
      </div>
    </div>
  );
}

/** One factor: label + slider + mini slice chart (predicted vs the factor). */
function FactorSlice({
  factor,
  coded,
  natural,
  slice,
  responseName,
  responseUnit,
  onChange,
}: {
  factor: FactorRead;
  coded: number;
  natural: number | null;
  slice: ProfilerSlice | null;
  responseName: string;
  responseUnit: string | undefined;
  onChange: (coded: number) => void;
}) {
  const hasNatural = natural !== null;
  // Texto local do campo editável: o usuário digita o valor natural (ou o
  // codificado quando não há níveis naturais). Sincroniza quando o valor muda
  // por fora (slider, "Ir ao ótimo") mas NÃO enquanto o usuário digita.
  const [text, setText] = useState("");
  useEffect(() => {
    const target = hasNatural ? (natural as number) : coded;
    const cur = Number(text.replace(",", "."));
    if (!Number.isFinite(cur) || Math.abs(cur - target) > 1e-9) {
      setText(hasNatural ? trimNum(natural as number) : coded.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coded, natural, hasNatural]);

  const commitText = (raw: string) => {
    setText(raw);
    const v = Number(raw.replace(",", "."));
    if (!Number.isFinite(v)) return;
    const nextCoded = hasNatural ? naturalToCoded(factor, v) : v;
    if (nextCoded === null) return;
    onChange(Math.max(-1, Math.min(1, nextCoded)));
  };

  return (
    <div className="rounded-lg border border-border bg-surface-1/60 p-3">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          {factor.name}
          {factor.unit ? (
            <span className="ml-1 text-xs text-faint">({factor.unit})</span>
          ) : null}
        </span>
        <span className="flex items-baseline gap-1">
          <input
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => commitText(e.target.value)}
            className="w-20 rounded border border-border-strong bg-surface-0 px-1.5 py-0.5 text-right text-xs tabular-nums text-accent outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
            aria-label={`Valor de ${factor.name}${
              hasNatural ? "" : " (codificado)"
            }`}
          />
          {!hasNatural ? (
            <span className="text-[10px] text-faint">(cod.)</span>
          ) : null}
        </span>
      </div>

      <input
        type="range"
        min={-1}
        max={1}
        step={0.02}
        value={coded}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent-mid"
        aria-label={`Nível codificado de ${factor.name}`}
      />
      <div className="mt-0.5 flex justify-between text-[10px] text-faint">
        <span>−1</span>
        <span>0</span>
        <span>+1</span>
      </div>

      <div className="mt-2 h-32 w-full">
        {slice ? (
          <SliceChart
            slice={slice}
            coded={coded}
            responseName={responseName}
            responseUnit={responseUnit}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-faint">
            Sem fatia disponível.
          </div>
        )}
      </div>
    </div>
  );
}

/** Mini 1-D slice: predicted line + CI band + marker at the current position. */
function SliceChart({
  slice,
  coded,
  responseName,
  responseUnit,
}: {
  slice: ProfilerSlice;
  coded: number;
  responseName: string;
  responseUnit: string | undefined;
}) {
  // Interpolate the predicted value at the current slider position for the dot.
  const markerY = interpAt(slice.coded, slice.predicted, coded);

  const band = withAlpha(PLOT_COLORS.cyan, 0.15);
  const traces: Data[] = [
    {
      type: "scatter",
      mode: "lines",
      x: slice.coded,
      y: slice.ci_low,
      line: { color: PLOT_COLORS.cyan, width: 0 },
      hoverinfo: "skip",
      showlegend: false,
    },
    {
      type: "scatter",
      mode: "lines",
      x: slice.coded,
      y: slice.ci_high,
      fill: "tonexty",
      fillcolor: band,
      line: { color: PLOT_COLORS.cyan, width: 0 },
      hoverinfo: "skip",
      showlegend: false,
    },
    {
      type: "scatter",
      mode: "lines",
      x: slice.coded,
      y: slice.predicted,
      line: { color: PLOT_COLORS.cyan, width: 2 },
      hovertemplate: "Cod.: %{x:.2f}<br>Ŷ: %{y:.4g}<extra></extra>",
      showlegend: false,
    },
    ...(markerY !== null
      ? ([
          {
            type: "scatter",
            mode: "markers",
            x: [coded],
            y: [markerY],
            marker: {
              color: PLOT_COLORS.amber,
              size: 9,
              line: { color: PLOT_COLORS.markerEdge, width: 1 },
            },
            hovertemplate: `${responseName}: %{y:.4g}<extra></extra>`,
            showlegend: false,
          },
        ] satisfies Data[])
      : []),
  ];

  const yTitle = responseUnit ? `${responseName} (${responseUnit})` : responseName;

  return (
    <Plot
      data={traces}
      layout={darkLayout({
        margin: { l: 44, r: 8, t: 8, b: 28 },
        xaxis: darkAxis(undefined, { range: [-1, 1], tickvals: [-1, 0, 1] }),
        yaxis: darkAxis(yTitle, { automargin: true }),
        shapes: [
          refLine("x", coded, {
            color: PLOT_COLORS.amber,
            dash: "dot",
            width: 1,
          }),
        ],
      })}
      config={{ displayModeBar: false, responsive: true, staticPlot: false }}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}

/** Linear interpolation of ``ys`` (with nulls) at ``xTarget`` over ``xs``. */
function interpAt(
  xs: number[],
  ys: (number | null)[],
  xTarget: number,
): number | null {
  if (xs.length === 0) return null;
  for (let i = 0; i < xs.length - 1; i += 1) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    if (xTarget >= Math.min(x0, x1) && xTarget <= Math.max(x0, x1)) {
      const y0 = ys[i];
      const y1 = ys[i + 1];
      if (y0 === null || y1 === null) return y0 ?? y1;
      const t = x1 === x0 ? 0 : (xTarget - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return ys[ys.length - 1] ?? null;
}
