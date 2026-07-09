/** Presentational: influence diagnostics — leverage vs. Cook's distance. */

import type { Data } from "plotly.js-dist-min";

import type { InfluenceData } from "@/domain/plots";
import {
  Plot,
  PLOT_COLORS,
  darkAxis,
  darkLayout,
  plotConfig,
  refLine,
  sciMarker,
} from "@/lib/plotly";

interface InfluencePlotProps {
  influence: InfluenceData;
}

/** Color for the influential runs (over either threshold): rose alert. */
const FLAG_COLOR = PLOT_COLORS.rose;

export function InfluencePlot({ influence: inf }: InfluencePlotProps) {
  const { threshold_leverage: tLev, threshold_cook: tCook } = inf;

  // A run is flagged when it sits above the leverage OR the Cook threshold.
  const flagged = inf.run_order.map((_, i) => {
    const lev = inf.leverage[i];
    const cook = inf.cook[i];
    const overLev = tLev !== null && lev !== null && lev > tLev;
    const overCook = tCook !== null && cook !== null && cook > tCook;
    return overLev || overCook;
  });

  const colors = flagged.map((f) => (f ? FLAG_COLOR : PLOT_COLORS.cyan));

  const traces: Data[] = [
    {
      type: "scatter",
      mode: "markers",
      x: inf.leverage,
      y: inf.cook,
      marker: { ...sciMarker(), color: colors },
      customdata: inf.run_order.map((ro, i) => [ro, inf.std_resid[i]]),
      hovertemplate:
        "Run %{customdata[0]}<br>Leverage: %{x:.3f}<br>" +
        "Cook: %{y:.4f}<br>Resíduo std: %{customdata[1]:.3f}<extra></extra>",
      showlegend: false,
    },
  ];

  // Label the run number next to each flagged (influential) point.
  const annotations = inf.run_order
    .map((ro, i) => ({
      ro,
      x: inf.leverage[i],
      y: inf.cook[i],
      flag: flagged[i],
    }))
    .filter((p) => p.flag && p.x !== null && p.y !== null)
    .map((p) => ({
      x: p.x as number,
      y: p.y as number,
      text: `#${p.ro}`,
      showarrow: false,
      yanchor: "bottom" as const,
      yshift: 6,
      font: { color: FLAG_COLOR, size: 11 },
    }));

  const shapes = [];
  if (tLev !== null) {
    shapes.push(
      refLine("x", tLev, { color: PLOT_COLORS.amber, dash: "dash", width: 1.5 }),
    );
  }
  if (tCook !== null) {
    shapes.push(
      refLine("y", tCook, { color: PLOT_COLORS.amber, dash: "dash", width: 1.5 }),
    );
  }

  return (
    <Plot
      data={traces}
      layout={darkLayout({
        xaxis: darkAxis("Leverage (hᵢᵢ)", { rangemode: "tozero" }),
        yaxis: darkAxis("Distância de Cook", { rangemode: "tozero" }),
        shapes,
        annotations,
      })}
      config={plotConfig("influencia")}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
