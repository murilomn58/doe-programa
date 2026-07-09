/** Presentational: interaction plot (marginal means + translucent 95% CI bands). */

import type { Data } from "plotly.js-dist-min";

import type { InteractionData } from "@/domain/plots";
import {
  Plot,
  PLOT_COLORS,
  SERIES_COLORS,
  darkAxis,
  darkLayout,
  plotConfig,
  sciMarker,
  withAlpha,
  withUnit,
} from "@/lib/plotly";

interface InteractionPlotProps {
  interaction: InteractionData;
  responseName: string;
  /** Unidades opcionais (o container passa quando disponíveis). */
  xUnit?: string;
  responseUnit?: string;
}

export function InteractionPlot({
  interaction,
  responseName,
  xUnit,
  responseUnit,
}: InteractionPlotProps) {
  // Per series: CI band (lower bound + upper bound filled "tonexty") drawn
  // first so the mean line + markers stay on top.
  const data: Data[] = interaction.lines.flatMap((line, i) => {
    const color = SERIES_COLORS[i % SERIES_COLORS.length];
    const name = `${interaction.factor_group}: ${line.level_label}`;
    return [
      {
        type: "scatter",
        mode: "lines",
        x: interaction.x_labels,
        y: line.ci_low,
        line: { color, width: 0 },
        hoverinfo: "skip",
        showlegend: false,
      },
      {
        type: "scatter",
        mode: "lines",
        x: interaction.x_labels,
        y: line.ci_high,
        fill: "tonexty",
        fillcolor: withAlpha(color, 0.15),
        line: { color, width: 0 },
        hoverinfo: "skip",
        showlegend: false,
      },
      {
        type: "scatter",
        mode: "lines+markers",
        name,
        x: interaction.x_labels,
        y: line.y,
        line: { color, width: 2 },
        marker: sciMarker(color),
        hovertemplate: `%{x}<br>Média: %{y:.4g}<extra>${name}</extra>`,
      },
    ] satisfies Data[];
  });

  return (
    <Plot
      data={data}
      layout={darkLayout({
        xaxis: darkAxis(withUnit(interaction.factor_x, xUnit), {
          automargin: true,
        }),
        yaxis: darkAxis(withUnit(responseName, responseUnit)),
        showlegend: true,
        legend: { orientation: "h", y: 1.12, font: { color: PLOT_COLORS.text } },
      })}
      config={plotConfig("grafico-de-interacao")}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
