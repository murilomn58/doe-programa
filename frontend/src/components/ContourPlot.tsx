/** Presentational: 2D contour of the response over two factors. */

import type { Data } from "plotly.js-dist-min";

import type { SurfaceData } from "@/domain/plots";
import { Plot, PLOT_COLORS, PLOT_CONFIG, darkAxis, darkLayout } from "@/lib/plotly";

interface ContourPlotProps {
  contour: SurfaceData;
}

export function ContourPlot({ contour }: ContourPlotProps) {
  const data: Data[] = [
    {
      type: "contour",
      x: contour.x,
      y: contour.y,
      z: contour.z,
      colorscale: "Viridis",
      colorbar: { tickfont: { color: PLOT_COLORS.text }, thickness: 12 },
      contours: { coloring: "heatmap", showlabels: true },
      line: { smoothing: 1 },
    },
  ];

  return (
    <Plot
      data={data}
      layout={darkLayout({
        xaxis: darkAxis(contour.factor_x),
        yaxis: darkAxis(contour.factor_y),
      })}
      config={PLOT_CONFIG}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
