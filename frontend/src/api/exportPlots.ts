/** API layer: publication-quality figure export, rendered by the LOCAL engine
 * (matplotlib + SciencePlots inside the Pyodide worker). Same signatures. */

import type { RSMModel } from "@/domain/analysis";
import { callEngine } from "@/engine/client";
import { getAnalysisBundle } from "@/engine/store";

export type ExportPlotKind =
  | "surface"
  | "contour"
  | "pareto"
  | "main_effects"
  | "interaction"
  | "obs_vs_pred"
  | "residual_vs_fitted"
  | "qq";

export type ExportFormat = "png" | "svg" | "pdf" | "tiff";

export interface ExportPlotBody {
  experiment_id: number;
  response_name: string;
  model: RSMModel;
  plot: ExportPlotKind;
  format: ExportFormat;
  /** DPI da figura raster (default 600). */
  dpi?: number;
  factor_x?: string | null;
  factor_y?: string | null;
}

interface ExportedPlot {
  content_b64: string;
  media_type: string;
  filename: string;
}

export async function exportPlot(body: ExportPlotBody): Promise<void> {
  const bundle = await getAnalysisBundle(body.experiment_id);
  const out = await callEngine<ExportedPlot>("export_plot", {
    bundle,
    experiment_id: body.experiment_id,
    response_name: body.response_name,
    model: body.model,
    plot: body.plot,
    fmt: body.format,
    dpi: body.dpi ?? 600,
    factor_x: body.factor_x ?? null,
    factor_y: body.factor_y ?? null,
  });
  const blob = b64ToBlob(out.content_b64, out.media_type);
  triggerDownload(blob, out.filename || `${body.plot}.${body.format}`);
}

function b64ToBlob(b64: string, mediaType: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mediaType });
}

/** Cria um object URL temporário e clica um ``<a download>`` invisível. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick — Firefox needs the URL alive during the click.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
