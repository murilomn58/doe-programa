/** Presentational: Pareto of standardized effects with the p=.05 line. */

import type { Data } from "plotly.js-dist-min";

import type { ParetoData } from "@/domain/plots";
import { Plot, PLOT_COLORS, PLOT_CONFIG, darkAxis, darkLayout } from "@/lib/plotly";

interface ParetoPlotProps {
  pareto: ParetoData;
}

export function ParetoPlot({ pareto }: ParetoPlotProps) {
  // Horizontal bars render bottom-up; reverse so the largest effect is on top.
  const terms = [...pareto.terms].reverse();
  const values = [...pareto.std_effects].reverse();
  const colors = values.map((v) =>
    v >= pareto.sig_line ? PLOT_COLORS.cyan : PLOT_COLORS.axis,
  );

  const data: Data[] = [
    {
      type: "bar",
      orientation: "h",
      x: values,
      y: terms,
      marker: { color: colors },
      text: values.map((v) => v.toFixed(2)),
      textposition: "auto",
      hovertemplate: "%{y}: %{x:.3f}<extra></extra>",
    },
  ];

  const maxX = Math.max(pareto.sig_line, ...values) * 1.15;

  return (
    <Plot
      data={data}
      layout={darkLayout({
        xaxis: { ...darkAxis("Efeito padronizado (|t|)"), range: [0, maxX] },
        yaxis: { ...darkAxis(), automargin: true },
        shapes: [
          {
            type: "line",
            x0: pareto.sig_line,
            x1: pareto.sig_line,
            y0: -0.5,
            y1: terms.length - 0.5,
            line: { color: PLOT_COLORS.rose, width: 2, dash: "dash" },
          },
        ],
        annotations: [
          {
            x: pareto.sig_line,
            y: terms.length - 0.5,
            yanchor: "bottom",
            text: `p=${pareto.alpha} (t=${pareto.sig_line.toFixed(2)})`,
            showarrow: false,
            font: { color: PLOT_COLORS.rose, size: 11 },
          },
        ],
      })}
      config={PLOT_CONFIG}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
