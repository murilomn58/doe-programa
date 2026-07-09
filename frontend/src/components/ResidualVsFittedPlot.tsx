/** Presentational: residuals vs. fitted values scatter. */

import type { Data } from "plotly.js-dist-min";

import type { ScatterData } from "@/domain/plots";
import {
  Plot,
  PLOT_COLORS,
  darkAxis,
  darkLayout,
  plotConfig,
  refLine,
  sciMarker,
  withUnit,
} from "@/lib/plotly";

interface ResidualVsFittedPlotProps {
  data: ScatterData;
  /** Unidade da resposta, aplicada aos dois eixos (opcional). */
  unit?: string;
}

export function ResidualVsFittedPlot({
  data: d,
  unit,
}: ResidualVsFittedPlotProps) {
  const traces: Data[] = [
    {
      type: "scatter",
      mode: "markers",
      x: d.x,
      y: d.y,
      marker: sciMarker(),
      hovertemplate: "Ajustado: %{x:.4g}<br>Resíduo: %{y:.4g}<extra></extra>",
      showlegend: false,
    },
  ];

  return (
    <Plot
      data={traces}
      layout={darkLayout({
        xaxis: darkAxis(withUnit("Ajustado", unit)),
        yaxis: darkAxis(withUnit("Resíduo", unit)),
        // Subtle solid zero line spanning the whole plot width.
        shapes: [
          refLine("y", 0, { color: PLOT_COLORS.axis, dash: "solid", width: 1 }),
        ],
      })}
      config={plotConfig("residuos-vs-ajustado")}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
