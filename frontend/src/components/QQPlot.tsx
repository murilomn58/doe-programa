/** Presentational: normal Q-Q plot of residuals. */

import type { Data } from "plotly.js-dist-min";

import type { QQData } from "@/domain/plots";
import { Plot, PLOT_COLORS, PLOT_CONFIG, darkAxis, darkLayout } from "@/lib/plotly";

interface QQPlotProps {
  qq: QQData;
}

export function QQPlot({ qq }: QQPlotProps) {
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
      marker: { color: PLOT_COLORS.cyan, size: 8, opacity: 0.85 },
      hovertemplate: "Teórico: %{x:.3f}<br>Resíduo: %{y:.4g}<extra></extra>",
      showlegend: false,
    },
  ];

  return (
    <Plot
      data={traces}
      layout={darkLayout({
        xaxis: darkAxis("Quantis teóricos (normal)"),
        yaxis: darkAxis("Quantis dos resíduos"),
      })}
      config={PLOT_CONFIG}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
