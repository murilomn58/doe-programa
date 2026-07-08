/** Presentational: main-effects plot (mean response per factor level). */

import type { Data } from "plotly.js-dist-min";

import type { MainEffectData } from "@/domain/plots";
import {
  Plot,
  PLOT_COLORS,
  PLOT_CONFIG,
  SERIES_COLORS,
  darkAxis,
  darkLayout,
} from "@/lib/plotly";

interface MainEffectsPlotProps {
  mainEffects: MainEffectData[];
  grandMean: number;
  responseName: string;
}

export function MainEffectsPlot({
  mainEffects,
  grandMean,
  responseName,
}: MainEffectsPlotProps) {
  // One panel per factor sharing a y-axis: encode each factor's two levels on a
  // shared categorical x-axis "<factor>: <level>" so every effect is visible.
  const data: Data[] = mainEffects.map((m, i) => ({
    type: "scatter",
    mode: "lines+markers",
    name: m.factor,
    x: m.level_labels.map((lbl) => `${m.factor}: ${lbl}`),
    y: m.means,
    line: { color: SERIES_COLORS[i % SERIES_COLORS.length], width: 2 },
    marker: { size: 8 },
  }));

  return (
    <Plot
      data={data}
      layout={darkLayout({
        xaxis: { ...darkAxis(), automargin: true, tickangle: -20 },
        yaxis: darkAxis(responseName),
        showlegend: true,
        legend: { orientation: "h", y: 1.12, font: { color: PLOT_COLORS.text } },
        shapes: [
          {
            type: "line",
            xref: "paper",
            x0: 0,
            x1: 1,
            y0: grandMean,
            y1: grandMean,
            line: { color: PLOT_COLORS.axis, width: 1, dash: "dot" },
          },
        ],
      })}
      config={PLOT_CONFIG}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
