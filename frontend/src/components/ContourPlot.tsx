/** Presentational: 2D contour of the response + observed runs overlay. */

import type { Data } from "plotly.js-dist-min";

import type { SurfaceData } from "@/domain/plots";
import {
  Plot,
  darkAxis,
  darkLayout,
  plotConfig,
  sciColorbar,
  sciMarker,
  withUnit,
} from "@/lib/plotly";

interface ContourPlotProps {
  contour: SurfaceData;
  /** Nome da resposta para o título da colorbar (opcional, não quebra call sites). */
  responseName?: string;
  /** Unidades opcionais dos eixos/resposta (o container passa quando disponíveis). */
  xUnit?: string;
  yUnit?: string;
  zUnit?: string;
}

export function ContourPlot({
  contour,
  responseName,
  xUnit,
  yUnit,
  zUnit,
}: ContourPlotProps) {
  const data: Data[] = [
    {
      type: "contour",
      x: contour.x,
      y: contour.y,
      z: contour.z,
      colorscale: "Viridis",
      colorbar: sciColorbar(responseName ? withUnit(responseName, zUnit) : ""),
      contours: {
        coloring: "heatmap",
        showlabels: true,
        labelfont: { size: 11, color: "#e2e8f0" },
      },
      line: { smoothing: 0.85 },
      hovertemplate:
        `${contour.factor_x}: %{x:.4g}<br>` +
        `${contour.factor_y}: %{y:.4g}<br>` +
        "Ŷ: %{z:.4g}<extra></extra>",
    },
  ];

  // Overlay: observed runs at their natural coordinates (white markers).
  if (contour.points_x.length > 0) {
    data.push({
      type: "scatter",
      mode: "markers",
      x: contour.points_x,
      y: contour.points_y,
      marker: sciMarker("#ffffff"),
      name: "Ensaios",
      showlegend: false,
      hovertemplate:
        "Ensaio observado<br>" +
        `${contour.factor_x}: %{x:.4g}<br>` +
        `${contour.factor_y}: %{y:.4g}<extra></extra>`,
    });
  }

  return (
    <Plot
      data={data}
      layout={darkLayout({
        xaxis: darkAxis(withUnit(contour.factor_x, xUnit)),
        yaxis: darkAxis(withUnit(contour.factor_y, yUnit)),
      })}
      config={plotConfig("grafico-de-contorno")}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
