/** Presentational: 3D response-surface (Plotly ``surface``, viridis colormap). */

import type { Data } from "plotly.js-dist-min";

import type { SurfaceData } from "@/domain/plots";
import { Plot, PLOT_COLORS, PLOT_CONFIG, darkLayout } from "@/lib/plotly";

interface SurfacePlotProps {
  surface: SurfaceData;
  responseName: string;
}

export function SurfacePlot({ surface, responseName }: SurfacePlotProps) {
  // @types/plotly.js only types contours for 2D traces; contours.z (show/usecolormap/project)
  // is the correct 3D-surface API and is valid at runtime — the cast bridges the type gap.
  const trace = {
    type: "surface",
    x: surface.x,
    y: surface.y,
    z: surface.z,
    colorscale: "Viridis",
    colorbar: { tickfont: { color: PLOT_COLORS.text }, thickness: 12 },
    contours: {
      z: { show: true, usecolormap: true, project: { z: true } },
    },
  } as unknown as Data;

  const axis = {
    gridcolor: PLOT_COLORS.grid,
    zerolinecolor: PLOT_COLORS.grid,
    color: PLOT_COLORS.text,
    backgroundcolor: "rgba(0,0,0,0)",
  };

  return (
    <Plot
      data={[trace]}
      layout={darkLayout({
        scene: {
          xaxis: { ...axis, title: { text: surface.factor_x } },
          yaxis: { ...axis, title: { text: surface.factor_y } },
          zaxis: { ...axis, title: { text: responseName } },
          camera: { eye: { x: 1.6, y: -1.6, z: 0.9 } },
        },
        margin: { l: 0, r: 0, t: 0, b: 0 },
      })}
      config={PLOT_CONFIG}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
