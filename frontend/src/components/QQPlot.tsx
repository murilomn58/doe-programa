/** Presentational: normal Q-Q plot of residuals (square aspect). */

import type { Data } from "plotly.js-dist-min";

import type { QQData } from "@/domain/plots";
import {
  Plot,
  PLOT_COLORS,
  darkAxis,
  darkLayout,
  plotConfig,
  sciMarker,
  withUnit,
} from "@/lib/plotly";

interface QQPlotProps {
  qq: QQData;
  /** Unidade da resposta, aplicada ao eixo dos resíduos (opcional). */
  unit?: string;
}

export function QQPlot({ qq, unit }: QQPlotProps) {
  const tMin = qq.theoretical[0];
  const tMax = qq.theoretical[qq.theoretical.length - 1];
  const lineY0 = qq.line_slope * tMin + qq.line_intercept;
  const lineY1 = qq.line_slope * tMax + qq.line_intercept;

  const traces: Data[] = [
    {
      type: "scatter",
      mode: "lines",
      x: [tMin, tMax],
      y: [lineY0, lineY1],
      line: { color: PLOT_COLORS.axis, width: 1.5, dash: "dash" },
      showlegend: false,
      hoverinfo: "skip",
    },
    {
      type: "scatter",
      mode: "markers",
      x: qq.theoretical,
      y: qq.sample,
      marker: sciMarker(),
      hovertemplate: "Teórico: %{x:.3f}<br>Resíduo: %{y:.4g}<extra></extra>",
      showlegend: false,
    },
  ];

  return (
    // Square drawing region (aspect-square) — the axes carry different units
    // (N(0,1) quantiles × residuals), so the square is enforced via CSS
    // instead of scaleanchor, which would distort the data ranges.
    <div className="mx-auto aspect-square h-full max-w-full">
      <Plot
        data={traces}
        layout={darkLayout({
          xaxis: darkAxis("Quantis teóricos (normal)"),
          yaxis: darkAxis(withUnit("Quantis dos resíduos", unit)),
        })}
        config={plotConfig("qq-normal")}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
    </div>
  );
}
