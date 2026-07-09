/** Presentational: desirability overlay (multi-response D in [0,1] over 2 factors). */

import type { Data } from "plotly.js-dist-min";

import type { DesirabilityData } from "@/domain/plots";
import {
  Plot,
  darkAxis,
  darkLayout,
  plotConfig,
  sciColorbar,
  withUnit,
} from "@/lib/plotly";

interface DesirabilityOverlayProps {
  desirability: DesirabilityData;
  /** Unidades opcionais dos eixos (o container passa quando disponíveis). */
  xUnit?: string;
  yUnit?: string;
}

export function DesirabilityOverlay({
  desirability: d,
  xUnit,
  yUnit,
}: DesirabilityOverlayProps) {
  const trace: Data = {
    type: "contour",
    x: d.x,
    y: d.y,
    z: d.d,
    colorscale: "Viridis",
    zmin: 0,
    zmax: 1,
    colorbar: sciColorbar("Desejabilidade (D)"),
    contours: { coloring: "heatmap", showlabels: true },
    hovertemplate:
      `${d.factor_x}: %{x:.4g}<br>${d.factor_y}: %{y:.4g}<br>` +
      "D: %{z:.3f}<extra></extra>",
  } as unknown as Data;

  return (
    <Plot
      data={[trace]}
      layout={darkLayout({
        xaxis: darkAxis(withUnit(d.factor_x, xUnit)),
        yaxis: darkAxis(withUnit(d.factor_y, yUnit)),
      })}
      config={plotConfig("desejabilidade")}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
