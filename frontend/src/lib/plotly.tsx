"use client";

/**
 * Dynamic Plotly wrapper — the ONLY place Plotly is imported.
 *
 * Plotly touches ``window`` at import time, so it must never run during SSR
 * (Next 15 would throw "window is not defined"). We load the prebuilt
 * ``plotly.js-dist-min`` bundle + the react-plotly factory lazily, client-side
 * only (``ssr: false``). A shared dark "scientific" theme keeps every chart on
 * the same slate/cyan palette as the rest of the app.
 */

import dynamic from "next/dynamic";
import type { Config, Layout } from "plotly.js-dist-min";
import type { PlotParams } from "react-plotly.js";
import type { ComponentType } from "react";

export const Plot = dynamic(
  async () => {
    const [{ default: Plotly }, { default: createPlotlyComponent }] =
      await Promise.all([
        import("plotly.js-dist-min"),
        import("react-plotly.js/factory"),
      ]);
    return createPlotlyComponent(Plotly);
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-64 items-center justify-center text-sm text-slate-500">
        Carregando gráfico…
      </div>
    ),
  },
) as ComponentType<PlotParams>;

/** Scientific dark palette (aligned with the Tailwind slate/cyan theme). */
export const PLOT_COLORS = {
  cyan: "#22d3ee",
  blue: "#3b82f6",
  emerald: "#34d399",
  amber: "#fbbf24",
  rose: "#fb7185",
  violet: "#a78bfa",
  grid: "#334155",
  axis: "#64748b",
  text: "#cbd5e1",
};

export const SERIES_COLORS = [
  PLOT_COLORS.cyan,
  PLOT_COLORS.amber,
  PLOT_COLORS.emerald,
  PLOT_COLORS.violet,
  PLOT_COLORS.rose,
];

/** Base layout: transparent background, slate grid, Inter font. */
export function darkLayout(overrides: Partial<Layout> = {}): Partial<Layout> {
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: PLOT_COLORS.text, family: "Inter, system-ui, sans-serif", size: 12 },
    margin: { l: 56, r: 20, t: 16, b: 48 },
    hoverlabel: { bgcolor: "#0f172a", bordercolor: PLOT_COLORS.grid },
    colorway: SERIES_COLORS,
    ...overrides,
  };
}

/** Shared axis styling (slate gridlines, zeroline off). */
export function darkAxis(title?: string): Partial<Layout["xaxis"]> {
  return {
    title: title ? { text: title } : undefined,
    gridcolor: PLOT_COLORS.grid,
    zerolinecolor: PLOT_COLORS.grid,
    linecolor: PLOT_COLORS.axis,
    tickfont: { color: PLOT_COLORS.text },
    color: PLOT_COLORS.text,
  };
}

export const PLOT_CONFIG: Partial<Config> = {
  displayModeBar: false,
  responsive: true,
};
