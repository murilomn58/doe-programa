"use client";

/**
 * Dynamic Plotly wrapper — the ONLY place Plotly is imported.
 *
 * Plotly touches ``window`` at import time, so it must never run during SSR
 * (Next 15 would throw "window is not defined"). We load the prebuilt
 * ``plotly.js-dist-min`` bundle + the react-plotly factory lazily, client-side
 * only (``ssr: false``). A shared light "scientific" theme keeps every chart on
 * the same white/blue palette as the rest of the app, with a closed frame
 * (SciencePlots-style mirror axes), outside ticks and PT-BR separators.
 */

import dynamic from "next/dynamic";
import type {
  ColorBar,
  Config,
  Dash,
  Layout,
  Scene,
  SceneAxis,
  Shape,
} from "plotly.js-dist-min";
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
      <div className="flex h-full min-h-64 items-center justify-center text-sm text-faint">
        Carregando gráfico…
      </div>
    ),
  },
) as ComponentType<PlotParams>;

/** Scientific light palette (aligned with the Tailwind white/blue theme). */
export const PLOT_COLORS = {
  cyan: "#0ea5e9",
  blue: "#2563eb",
  emerald: "#059669",
  amber: "#d97706",
  rose: "#dc2626",
  violet: "#4f46e5",
  grid: "#e2e8f0",
  axis: "#94a3b8",
  text: "#1e293b",
  /** Light edge for markers (white) — shared by every scatter marker. */
  markerEdge: "#ffffff",
};

export const SERIES_COLORS = [
  PLOT_COLORS.blue,
  PLOT_COLORS.cyan,
  PLOT_COLORS.emerald,
  PLOT_COLORS.amber,
  PLOT_COLORS.violet,
  PLOT_COLORS.rose,
];

/**
 * Per-chart Plotly config: discreet modebar (shows on hover, no logo, no
 * lasso/select) and a native camera button that downloads a hi-res PNG
 * (1200×900 @ scale 4 ≈ 4800×3600 px) named after the chart.
 */
export function plotConfig(filename: string): Partial<Config> {
  return {
    displayModeBar: "hover",
    displaylogo: false,
    responsive: true,
    modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"],
    toImageButtonOptions: {
      format: "png",
      scale: 4,
      filename,
      width: 1200,
      height: 900,
    },
  };
}

/** @deprecated Prefer ``plotConfig(filename)`` — kept for retrocompatibility. */
export const PLOT_CONFIG: Partial<Config> = plotConfig("grafico-doe");

/**
 * Base layout: transparent background, slate grid, Inter font, PT-BR number
 * separators ("," decimal / "." thousands) applied to ticks and hovers.
 */
export function darkLayout(overrides: Partial<Layout> = {}): Partial<Layout> {
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: {
      color: PLOT_COLORS.text,
      family: "Inter, system-ui, sans-serif",
      size: 13,
    },
    margin: { l: 64, r: 24, t: 24, b: 56 },
    hoverlabel: {
      bgcolor: "#ffffff",
      bordercolor: PLOT_COLORS.grid,
      font: { size: 12, color: PLOT_COLORS.text },
    },
    separators: ",.",
    colorway: SERIES_COLORS,
    ...overrides,
  };
}

/**
 * Shared axis styling: closed frame (mirror) with outside ticks à la
 * SciencePlots, subtle grid, no zeroline, power-of-ten exponents.
 */
export function darkAxis(
  title?: string,
  opts: Partial<Layout["xaxis"]> = {},
): Partial<Layout["xaxis"]> {
  return {
    title: title ? { text: title, standoff: 12 } : undefined,
    gridcolor: PLOT_COLORS.grid,
    gridwidth: 1,
    zeroline: false,
    linecolor: PLOT_COLORS.axis,
    showline: true,
    mirror: true,
    ticks: "outside",
    ticklen: 5,
    tickwidth: 1,
    tickcolor: PLOT_COLORS.axis,
    tickfont: { color: PLOT_COLORS.text },
    exponentformat: "power",
    color: PLOT_COLORS.text,
    ...opts,
  };
}

/** "Label (unit)" when a unit is provided, plain label otherwise. */
export function withUnit(label: string, unit?: string): string {
  return unit ? `${label} (${unit})` : label;
}

/** Slim scientific colorbar with a side title (response name + unit). */
export function sciColorbar(title: string): Partial<ColorBar> {
  return {
    thickness: 14,
    outlinewidth: 0,
    len: 0.9,
    title: { text: title, side: "right" },
    tickfont: { size: 11, color: PLOT_COLORS.text },
  };
}

/** Standardized scatter marker (same size/edge on every chart). */
export function sciMarker(color: string = PLOT_COLORS.cyan) {
  return {
    color,
    size: 9,
    opacity: 0.85,
    line: { color: PLOT_COLORS.markerEdge, width: 1 },
  };
}

/**
 * Shared 3D scene: styled axes with translucent slate walls, no spikes,
 * fixed manual aspect and a publication-friendly default camera.
 */
export function scene3d(
  xTitle: string,
  yTitle: string,
  zTitle: string,
): Partial<Scene> {
  const axis = (title: string): Partial<SceneAxis> => ({
    title: { text: title },
    gridcolor: PLOT_COLORS.grid,
    gridwidth: 1,
    zeroline: false,
    linecolor: PLOT_COLORS.axis,
    showline: true,
    color: PLOT_COLORS.text,
    tickfont: { color: PLOT_COLORS.text, size: 11 },
    showbackground: true,
    backgroundcolor: "rgba(248,250,252,0.5)",
    showspikes: false,
  });
  return {
    xaxis: axis(xTitle),
    yaxis: axis(yTitle),
    zaxis: axis(zTitle),
    camera: { eye: { x: 1.45, y: -1.75, z: 0.85 } },
    aspectmode: "manual",
    aspectratio: { x: 1, y: 1, z: 0.75 },
  };
}

/**
 * Reference line (shape) spanning the whole plot on the paper axis:
 * ``refLine("x", v)`` draws a vertical line at x=v, ``refLine("y", v)`` a
 * horizontal one at y=v. Dashed by default for visual consistency.
 */
export function refLine(
  axis: "x" | "y",
  value: number,
  opts: { color?: string; dash?: Dash; width?: number } = {},
): Partial<Shape> {
  const { color = PLOT_COLORS.axis, dash = "dash", width = 1.5 } = opts;
  const line = { color, dash, width };
  return axis === "x"
    ? { type: "line", yref: "paper", y0: 0, y1: 1, x0: value, x1: value, line }
    : { type: "line", xref: "paper", x0: 0, x1: 1, y0: value, y1: value, line };
}

/** Hex ``#rrggbb`` → ``rgba(r,g,b,alpha)`` (CI bands, translucent fills). */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
