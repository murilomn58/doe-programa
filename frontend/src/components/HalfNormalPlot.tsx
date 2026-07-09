/** Presentational: half-normal plot of |effects| — active terms are labelled. */

import type { Data } from "plotly.js-dist-min";

import type { HalfNormalData } from "@/domain/plots";
import {
  Plot,
  PLOT_COLORS,
  darkAxis,
  darkLayout,
  plotConfig,
  sciMarker,
} from "@/lib/plotly";

interface HalfNormalPlotProps {
  halfNormal: HalfNormalData;
}

/** Points on the reference (dominant inert) line stay slate; active ones cyan. */
const INERT_COLOR = "#64748b";

export function HalfNormalPlot({ halfNormal: h }: HalfNormalPlotProps) {
  const active = new Set(h.labels_significant);

  // Marker colors: cyan for active terms (|effect| > ME), slate otherwise.
  const colors = h.terms.map((t) =>
    active.has(t) ? PLOT_COLORS.cyan : INERT_COLOR,
  );

  const traces: Data[] = [
    {
      type: "scatter",
      mode: "markers",
      x: h.theoretical,
      y: h.abs_effects,
      marker: { ...sciMarker(), color: colors },
      text: h.terms,
      hovertemplate:
        "%{text}<br>Quantil: %{x:.3f}<br>|efeito|: %{y:.4g}<extra></extra>",
      showlegend: false,
    },
  ];

  // Label only the active (significant) terms, offset to the left of the point.
  const annotations = h.terms
    .map((term, i) => ({ term, x: h.theoretical[i], y: h.abs_effects[i] }))
    .filter((p) => active.has(p.term) && p.x !== null && p.y !== null)
    .map((p) => ({
      x: p.x as number,
      y: p.y as number,
      text: p.term,
      showarrow: false,
      xanchor: "right" as const,
      xshift: -8,
      font: { color: PLOT_COLORS.cyan, size: 11 },
    }));

  return (
    <Plot
      data={traces}
      layout={darkLayout({
        xaxis: darkAxis("Quantis half-normal"),
        yaxis: darkAxis("|Efeito|", { rangemode: "tozero" }),
        annotations,
      })}
      config={plotConfig("half-normal")}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
