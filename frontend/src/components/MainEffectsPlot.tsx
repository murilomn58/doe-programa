/** Presentational: main-effects plot (mean response per factor level). */

import type { Data } from "plotly.js-dist-min";

import type { MainEffectData } from "@/domain/plots";
import {
  Plot,
  PLOT_COLORS,
  SERIES_COLORS,
  darkAxis,
  darkLayout,
  plotConfig,
  refLine,
  sciMarker,
  withUnit,
} from "@/lib/plotly";

interface MainEffectsPlotProps {
  mainEffects: MainEffectData[];
  grandMean: number;
  responseName: string;
  /** Unidade da resposta (opcional, o container passa quando disponível). */
  responseUnit?: string;
}

export function MainEffectsPlot({
  mainEffects,
  grandMean,
  responseName,
  responseUnit,
}: MainEffectsPlotProps) {
  // One panel per factor sharing a y-axis: encode each factor's two levels on a
  // shared categorical x-axis "<factor>: <level>" so every effect is visible.
  const data: Data[] = mainEffects.map((m, i) => {
    const color = SERIES_COLORS[i % SERIES_COLORS.length];
    return {
      type: "scatter",
      mode: "lines+markers",
      name: m.factor,
      x: m.level_labels.map((lbl) => `${m.factor}: ${lbl}`),
      y: m.means,
      line: { color, width: 2 },
      marker: sciMarker(color),
      hovertemplate: "%{x}<br>Média: %{y:.4g}<extra></extra>",
    };
  });

  const grandMeanLabel = grandMean.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  });

  return (
    <Plot
      data={data}
      layout={darkLayout({
        xaxis: darkAxis(undefined, { automargin: true, tickangle: -20 }),
        yaxis: darkAxis(withUnit(responseName, responseUnit)),
        showlegend: true,
        legend: { orientation: "h", y: 1.12, font: { color: PLOT_COLORS.text } },
        shapes: [
          refLine("y", grandMean, {
            color: PLOT_COLORS.amber,
            dash: "dash",
            width: 1.5,
          }),
        ],
        annotations: [
          {
            x: 1,
            xref: "paper",
            xanchor: "right",
            y: grandMean,
            yanchor: "bottom",
            text: `Média global: ${grandMeanLabel}`,
            showarrow: false,
            font: { color: PLOT_COLORS.amber, size: 11 },
          },
        ],
      })}
      config={plotConfig("efeitos-principais")}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
