/** Presentational: observed vs. predicted scatter with 45° reference line. */

import type { Data, Layout } from "plotly.js-dist-min";

import type { ObsVsPredData } from "@/domain/plots";
import {
  Plot,
  PLOT_COLORS,
  darkAxis,
  darkLayout,
  plotConfig,
  sciMarker,
  withUnit,
} from "@/lib/plotly";

interface ObsVsPredPlotProps {
  data: ObsVsPredData;
  /** Unidade da resposta, aplicada aos dois eixos (opcional). */
  unit?: string;
}

export function ObsVsPredPlot({ data: d, unit }: ObsVsPredPlotProps) {
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
      marker: sciMarker(),
      hovertemplate: "Predito: %{x:.4g}<br>Observado: %{y:.4g}<extra></extra>",
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
            text: `R² = ${d.r_squared.toFixed(4).replace(".", ",")}`,
            showarrow: false,
            font: { color: PLOT_COLORS.text, size: 12 },
          },
        ]
      : [];

  return (
    <Plot
      data={traces}
      layout={darkLayout({
        xaxis: darkAxis(withUnit("Predito", unit), { range }),
        yaxis: darkAxis(withUnit("Observado", unit), {
          range,
          // 1:1 aspect is mandatory: equal data scale on both axes.
          scaleanchor: "x",
          scaleratio: 1,
        }),
        annotations,
      })}
      config={plotConfig("observado-vs-predito")}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
