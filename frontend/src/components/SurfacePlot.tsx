/** Presentational: 3D response-surface (Plotly ``surface``, viridis colormap). */

import type { Data } from "plotly.js-dist-min";

import type { SurfaceData } from "@/domain/plots";
import { Plot, darkLayout, plotConfig, scene3d, sciColorbar, withUnit } from "@/lib/plotly";

interface SurfacePlotProps {
  surface: SurfaceData;
  responseName: string;
  /** Unidades opcionais dos eixos (o container passa quando disponíveis). */
  xUnit?: string;
  yUnit?: string;
  zUnit?: string;
}

export function SurfacePlot({
  surface,
  responseName,
  xUnit,
  yUnit,
  zUnit,
}: SurfacePlotProps) {
  const zLabel = withUnit(responseName, zUnit);

  // @types/plotly.js only types contours for 2D traces; contours.z
  // (show/usecolormap/project/width) and lighting/lightposition are the correct
  // 3D-surface API and are valid at runtime — the cast bridges the type gap.
  const trace = {
    type: "surface",
    x: surface.x,
    y: surface.y,
    z: surface.z,
    colorscale: "Viridis",
    colorbar: sciColorbar(zLabel),
    lighting: {
      ambient: 0.6,
      diffuse: 0.55,
      specular: 0.25,
      roughness: 0.6,
      fresnel: 0.1,
    },
    lightposition: { x: 120, y: 200, z: 60 },
    contours: {
      z: { show: true, usecolormap: true, project: { z: true }, width: 2 },
    },
    hovertemplate:
      `${surface.factor_x}: %{x:.4g}<br>` +
      `${surface.factor_y}: %{y:.4g}<br>` +
      "Ŷ: %{z:.4g}<extra></extra>",
  } as unknown as Data;

  return (
    <Plot
      data={[trace]}
      layout={darkLayout({
        scene: scene3d(
          withUnit(surface.factor_x, xUnit),
          withUnit(surface.factor_y, yUnit),
          zLabel,
        ),
        margin: { l: 0, r: 0, t: 0, b: 0 },
      })}
      config={plotConfig("superficie-de-resposta")}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
