/** Presentational: residuals vs. run order (checks independence / drift). */

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

interface ResidualVsOrderPlotProps {
  data: ScatterData;
  /** Unidade da resposta, aplicada ao eixo dos resíduos (opcional). */
  unit?: string;
}

export function ResidualVsOrderPlot({
  data: d,
  unit,
}: ResidualVsOrderPlotProps) {
  const traces: Data[] = [
    {
      type: "scatter",
      // Lines connect consecutive runs so a temporal drift is visible.
      mode: "lines+markers",
      x: d.x,
      y: d.y,
      line: { color: PLOT_COLORS.axis, width: 1 },
      marker: sciMarker(),
      hovertemplate: "Ordem: %{x}<br>Resíduo: %{y:.4g}<extra></extra>",
      showlegend: false,
    },
  ];

  return (
    <Plot
      data={traces}
      layout={darkLayout({
        xaxis: darkAxis("Ordem de execução", { dtick: 1 }),
        yaxis: darkAxis(withUnit("Resíduo", unit)),
        shapes: [
          refLine("y", 0, { color: PLOT_COLORS.axis, dash: "solid", width: 1 }),
        ],
      })}
      config={plotConfig("residuos-vs-ordem")}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
