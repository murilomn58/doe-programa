"use client";

/**
 * Dynamic Plotly wrapper — the ONLY place Plotly is imported.
 *
 * Plotly touches ``window`` at import time, so it must never run during SSR
 * (Next 15 would throw "window is not defined"). We load the prebuilt
 * ``plotly.js-dist-min`` bundle + the react-plotly factory lazily, client-side
 * only (``ssr: false``). A shared light "scientific" theme keeps every chart on
 * the same paper/clay palette as the rest of the app, with a closed frame
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
import { useEffect, useRef } from "react";

/**
 * Referência de módulo ao Plotly carregado pelo import dinâmico abaixo,
 * preenchida assim que a promise resolve. Só o guard de resize de `Plot` a
 * usa — nenhum outro import do pacote é criado.
 */
interface PlotlyResizeAPI {
  Plots: { resize(root: HTMLElement): void };
}
let plotlyResize: PlotlyResizeAPI | null = null;

const LazyPlot = dynamic(
  async () => {
    const [{ default: Plotly }, { default: createPlotlyComponent }] =
      await Promise.all([
        import("plotly.js-dist-min"),
        import("react-plotly.js/factory"),
      ]);
    plotlyResize = Plotly as unknown as PlotlyResizeAPI;
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

/**
 * Wrapper fino sobre o `Plot` do react-plotly.js: substitui o
 * `useResizeHandler` nativo da lib por um resize próprio, com o mesmo efeito
 * mas dentro de um try/catch.
 *
 * Bug conhecido do plotly.js: redimensionar a viewport com um gráfico 3D em
 * tela (`SurfacePlot`, com `contours.z.project.z = true`) às vezes lança
 * `TypeError: Cannot read properties of undefined (reading 'z')` de dentro do
 * próprio `Plotly.Plots.resize`, porque a cena WebGL ainda está recalculando
 * a projeção do contorno do resize anterior quando o próximo chega. O
 * listener padrão da lib (`react-plotly.js/dist/chunk-*.mjs`) chama
 * `Plotly.Plots.resize(elRef.current)` direto no `window.addEventListener`,
 * sem guarda nenhuma, e o erro sobe cru pro console. Aqui a mesma chamada
 * roda dentro de um try/catch: o layout se corrige sozinho no resize
 * seguinte, então nada quebra visualmente — só o console deixa de acumular
 * um erro inofensivo.
 */
export function Plot(props: PlotParams) {
  const graphDivRef = useRef<HTMLElement | null>(null);
  const { useResizeHandler } = props;

  useEffect(() => {
    if (!useResizeHandler) return undefined;

    function onResize() {
      const el = graphDivRef.current;
      if (!el || !plotlyResize) return;
      try {
        plotlyResize.Plots.resize(el);
      } catch {
        // Guard documentado acima: o próximo resize corrige a cena 3D.
      }
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [useResizeHandler]);

  return (
    <LazyPlot
      {...props}
      useResizeHandler={false}
      onInitialized={(figure, graphDiv) => {
        graphDivRef.current = graphDiv;
        props.onInitialized?.(figure, graphDiv);
      }}
      onUpdate={(figure, graphDiv) => {
        graphDivRef.current = graphDiv;
        props.onUpdate?.(figure, graphDiv);
      }}
    />
  );
}

/** Scientific light palette (aligned with the Tailwind paper/clay theme). */
export const PLOT_COLORS = {
  cyan: "#1793B5",
  blue: "#C2673F",
  emerald: "#5F9A42",
  amber: "#d97706",
  rose: "#dc2626",
  violet: "#4f46e5",
  grid: "rgba(28,26,23,.10)",
  axis: "rgba(28,26,23,.45)",
  text: "#2A2723",
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
 * Base layout: transparent background (charts inherit the white card), ink
 * grid, IBM Plex Sans, PT-BR number separators ("," decimal / "." thousands)
 * applied to ticks and hovers.
 */
export function darkLayout(overrides: Partial<Layout> = {}): Partial<Layout> {
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: {
      color: PLOT_COLORS.text,
      family: "IBM Plex Sans, system-ui, sans-serif",
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
 * Shared 3D scene: styled axes with translucent paper walls, no spikes,
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
    backgroundcolor: "rgba(247,245,241,0.6)",
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
