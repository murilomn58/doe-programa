/** Presentational: Pareto of standardized effects with the critical-t line. */

import type { Data } from "plotly.js-dist-min";

import type { ParetoData } from "@/domain/plots";
import {
  Plot,
  PLOT_COLORS,
  darkAxis,
  darkLayout,
  plotConfig,
  refLine,
} from "@/lib/plotly";

interface ParetoPlotProps {
  pareto: ParetoData;
}

/**
 * Cor das barras não significativas — recuam atrás do teal das significativas.
 *
 * Mesmo tom morno de ``PLOT_COLORS.axis`` (``rgb(28,26,23)``), mas com alfa
 * próprio (``.55``, não os ``.45`` do token): reusar o token puro deixava a
 * barra em 2,88:1 sobre o painel branco, abaixo dos 3:1 de objeto gráfico
 * exigidos pela WCAG 1.4.11. Subir só o alfa aqui, sem tocar em
 * ``PLOT_COLORS.axis`` (compartilhado com eixos e grade, onde ``.45`` é
 * correto), resolve a barra em 3,9:1 sem esfriar a paleta de volta para o
 * ``#475569`` (slate-600) que havia antes.
 */
const NON_SIG_COLOR = "rgba(28,26,23,.55)";

export function ParetoPlot({ pareto }: ParetoPlotProps) {
  // Horizontal bars render bottom-up; reverse so the largest effect is on top.
  const terms = [...pareto.terms].reverse();
  const values = [...pareto.std_effects].reverse();
  const colors = values.map((v) =>
    v >= pareto.sig_line ? PLOT_COLORS.cyan : NON_SIG_COLOR,
  );

  const data: Data[] = [
    {
      type: "bar",
      orientation: "h",
      x: values,
      y: terms,
      marker: { color: colors },
      texttemplate: "%{x:.2f}",
      textposition: "outside",
      textfont: { color: PLOT_COLORS.text, size: 11 },
      cliponaxis: false,
      hovertemplate: "%{y}: %{x:.3f}<extra></extra>",
    },
  ];

  // Headroom for the outside value labels and the annotation.
  const maxX = Math.max(pareto.sig_line, ...values) * 1.25;
  const tCrit = pareto.sig_line.toFixed(2).replace(".", ",");
  const alphaLabel = String(pareto.alpha).replace(".", ",");

  return (
    <Plot
      data={data}
      layout={darkLayout({
        xaxis: darkAxis("Efeito padronizado (|t|)", { range: [0, maxX] }),
        yaxis: darkAxis(undefined, { automargin: true }),
        shapes: [
          refLine("x", pareto.sig_line, {
            color: PLOT_COLORS.rose,
            dash: "dash",
            width: 1.5,
          }),
        ],
        annotations: [
          {
            x: pareto.sig_line,
            y: 1,
            yref: "paper",
            yanchor: "bottom",
            text: `t crít = ${tCrit} (α=${alphaLabel})`,
            showarrow: false,
            font: { color: PLOT_COLORS.rose, size: 11 },
          },
        ],
      })}
      config={plotConfig("pareto-dos-efeitos")}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
