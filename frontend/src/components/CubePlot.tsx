/** Presentational: 2^3 cube — 8 corners + edges, response value at each vertex. */

import type { Data } from "plotly.js-dist-min";

import type { CubeData } from "@/domain/plots";
import { Plot, PLOT_COLORS, darkLayout, plotConfig, scene3d } from "@/lib/plotly";

interface CubePlotProps {
  cube: CubeData;
  responseName: string;
  /** Unidade da resposta, anexada ao rótulo do vértice (opcional). */
  responseUnit?: string;
}

/** Two corners share an edge when they differ in exactly one coordinate. */
function isEdge(a: number[], b: number[]): boolean {
  let diff = 0;
  for (let k = 0; k < a.length; k += 1) {
    if (a[k] !== b[k]) diff += 1;
  }
  return diff === 1;
}

/** PT-BR number: 4 significant digits, comma decimal separator. */
function fmt(v: number | null): string {
  if (v === null) return "—";
  return v.toPrecision(4).replace(".", ",");
}

export function CubePlot({ cube, responseName, responseUnit }: CubePlotProps) {
  const corners = cube.corner_coded;
  const [fx, fy, fz] = cube.factors;
  const respLabel = responseUnit
    ? `${responseName} (${responseUnit})`
    : responseName;

  // Edge segments: one line trace per pair of adjacent corners (null-separated
  // would break 3D lines, so each edge is its own two-point trace).
  const edges: Data[] = [];
  for (let i = 0; i < corners.length; i += 1) {
    for (let j = i + 1; j < corners.length; j += 1) {
      if (!isEdge(corners[i], corners[j])) continue;
      edges.push({
        type: "scatter3d",
        mode: "lines",
        x: [corners[i][0], corners[j][0]],
        y: [corners[i][1], corners[j][1]],
        z: [corners[i][2], corners[j][2]],
        line: { color: PLOT_COLORS.axis, width: 3 },
        hoverinfo: "skip",
        showlegend: false,
      });
    }
  }

  const vertices: Data = {
    type: "scatter3d",
    mode: "markers+text",
    x: corners.map((c) => c[0]),
    y: corners.map((c) => c[1]),
    z: corners.map((c) => c[2]),
    marker: {
      size: 6,
      color: cube.corner_values.map((v) => (v === null ? 0 : v)),
      colorscale: "Viridis",
      line: { color: PLOT_COLORS.markerEdge, width: 1 },
    },
    text: cube.corner_values.map((v) => fmt(v)),
    textposition: "top center",
    textfont: { color: PLOT_COLORS.text, size: 11 },
    customdata: cube.corner_values.map((v) => fmt(v)),
    hovertemplate:
      `${fx}: %{x}<br>${fy}: %{y}<br>${fz}: %{z}<br>` +
      `${respLabel}: %{customdata}<extra></extra>`,
    showlegend: false,
  } as unknown as Data;

  // Coded ±1 axes: fixed ticks, a little padding beyond the cube corners.
  const base = scene3d(fx, fy, fz);
  const codedAxis = { tickvals: [-1, 1], range: [-1.4, 1.4] };

  return (
    <Plot
      data={[...edges, vertices]}
      layout={darkLayout({
        scene: {
          ...base,
          xaxis: { ...base.xaxis, ...codedAxis },
          yaxis: { ...base.yaxis, ...codedAxis },
          zaxis: { ...base.zaxis, ...codedAxis },
          aspectmode: "cube",
        },
        margin: { l: 0, r: 0, t: 0, b: 0 },
      })}
      config={plotConfig("cubo-2k")}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
