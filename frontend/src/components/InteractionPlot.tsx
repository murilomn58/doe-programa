/** Presentational: interaction plot (marginal means + 95% CI error bars). */

import type { Data } from "plotly.js-dist-min";

import type { InteractionData } from "@/domain/plots";
import {
  Plot,
  PLOT_COLORS,
  PLOT_CONFIG,
  SERIES_COLORS,
  darkAxis,
  darkLayout,
} from "@/lib/plotly";

interface InteractionPlotProps {
  interaction: InteractionData;
  responseName: string;
}

function up(hi: number | null, m: number | null): number {
  return hi !== null && m !== null ? hi - m : 0;
}
function down(m: number | null, lo: number | null): number {
  return m !== null && lo !== null ? m - lo : 0;
}

export function InteractionPlot({
  interaction,
  responseName,
}: InteractionPlotProps) {
  const data: Data[] = interaction.lines.map((line, i) => ({
    type: "scatter",
    mode: "lines+markers",
    name: `${interaction.factor_group}: ${line.level_label}`,
    x: interaction.x_labels,
    y: line.y,
    line: { color: SERIES_COLORS[i % SERIES_COLORS.length], width: 2 },
    marker: { size: 8 },
    error_y: {
      type: "data",
      symmetric: false,
      array: line.y.map((m, j) => up(line.ci_high[j], m)),
      arrayminus: line.y.map((m, j) => down(m, line.ci_low[j])),
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      thickness: 1.5,
      width: 6,
    },
  }));

  return (
    <Plot
      data={data}
      layout={darkLayout({
        xaxis: { ...darkAxis(interaction.factor_x), automargin: true },
        yaxis: darkAxis(responseName),
        showlegend: true,
        legend: { orientation: "h", y: 1.12, font: { color: PLOT_COLORS.text } },
      })}
      config={PLOT_CONFIG}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
