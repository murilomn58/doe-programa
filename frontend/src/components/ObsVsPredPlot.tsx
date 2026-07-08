/** Presentational: observed vs. predicted scatter with 45° reference line. */

import type { Data, Layout } from "plotly.js-dist-min";

import type { ObsVsPredData } from "@/domain/plots";
import { Plot, PLOT_COLORS, PLOT_CONFIG, darkAxis, darkLayout } from "@/lib/plotly";

interface ObsVsPredPlotProps {
  data: ObsVsPredData;
}

export function ObsVsPredPlot({ data: d }: ObsVsPredPlotProps) {
  const range: [number, number] = [d.line_min, d.line_max];

  const traces: Data[] = [
    {
      type: "scatter",
      mode: "lines",
      x: [d.line_min, d.line_max],
      y: [d.line_min, d.line_max],
      line: { color: PLOT_COLORS.axis, width: 1.5, dash: "dash" },
      showlegend: false,
      hoverinfo: "skip",
    },
    {
      type: "scatter",
      mode: "markers",
      x: d.predicted,
      y: d.observed,
      marker: { color: PLOT_COLORS.cyan, size: 8, opacity: 0.85 },
      hovertemplate: "Pred: %{x:.4g}<br>Obs: %{y:.4g}<extra></extra>",
      showlegend: false,
    },
  ];

  const annotations: Partial<Layout>["annotations"] =
    d.r_squared !== null
      ? [
          {
            x: 0.98,
            y: 0.04,
            xref: "paper",
            yref: "paper",
            xanchor: "right",
            yanchor: "bottom",
            text: `R² = ${d.r_squared.toFixed(4)}`,
            showarrow: false,
            font: { color: PLOT_COLORS.text, size: 12 },
          },
        ]
      : [];

  return (
    <Plot
      data={traces}
      layout={darkLayout({
        xaxis: { ...darkAxis("Predito"), range },
        yaxis: { ...darkAxis("Observado"), range },
        annotations,
      })}
      config={PLOT_CONFIG}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
