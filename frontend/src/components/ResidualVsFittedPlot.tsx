/** Presentational: residuals vs. fitted values scatter. */

import type { Data } from "plotly.js-dist-min";

import type { ScatterData } from "@/domain/plots";
import { Plot, PLOT_COLORS, PLOT_CONFIG, darkAxis, darkLayout } from "@/lib/plotly";

interface ResidualVsFittedPlotProps {
  data: ScatterData;
}

export function ResidualVsFittedPlot({ data: d }: ResidualVsFittedPlotProps) {
  const xMin = Math.min(...d.x);
  const xMax = Math.max(...d.x);

  const traces: Data[] = [
    {
      type: "scatter",
      mode: "lines",
      x: [xMin, xMax],
      y: [0, 0],
      line: { color: PLOT_COLORS.axis, width: 1.5, dash: "dash" },
      showlegend: false,
      hoverinfo: "skip",
    },
    {
      type: "scatter",
      mode: "markers",
      x: d.x,
      y: d.y,
      marker: { color: PLOT_COLORS.cyan, size: 8, opacity: 0.85 },
      hovertemplate: "Ajustado: %{x:.4g}<br>Resíduo: %{y:.4g}<extra></extra>",
      showlegend: false,
    },
  ];

  return (
    <Plot
      data={traces}
      layout={darkLayout({
        xaxis: darkAxis("Ajustado"),
        yaxis: darkAxis("Resíduo"),
      })}
      config={PLOT_CONFIG}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
