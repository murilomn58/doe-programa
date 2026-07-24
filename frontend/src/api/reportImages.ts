/**
 * API layer: publication-quality PNG (600 DPI, white background) rendered by
 * the LOCAL engine for the printable /report route. Returns an object URL, or
 * null when the fitted model does not produce that figure (old 422-skip).
 */

import type { RSMModel } from "@/domain/analysis";
import { callEngine } from "@/engine/client";
import { getAnalysisBundle } from "@/engine/store";

/** The eight figures the report may show, in rendering order. */
export const REPORT_PLOTS = [
  "surface",
  "contour",
  "pareto",
  "main_effects",
  "interaction",
  "obs_vs_pred",
  "residual_vs_fitted",
  "qq",
] as const;

export type ReportPlotKind = (typeof REPORT_PLOTS)[number];

export interface ReportPlotRequest {
  experimentId: number;
  responseName: string;
  model: RSMModel;
  plot: ReportPlotKind;
  factorX?: string | null;
  factorY?: string | null;
}

interface ExportedPlot {
  content_b64: string;
  media_type: string;
  filename: string;
}

export async function fetchReportPlot(
  input: ReportPlotRequest,
): Promise<string | null> {
  const bundle = await getAnalysisBundle(input.experimentId);
  const out = await callEngine<ExportedPlot | null>("export_plot_report", {
    bundle,
    experiment_id: input.experimentId,
    response_name: input.responseName,
    model: input.model,
    plot: input.plot,
    factor_x: input.factorX ?? null,
    factor_y: input.factorY ?? null,
  });
  if (out === null) return null;
  const bin = atob(out.content_b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: out.media_type }));
}
