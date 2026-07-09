/**
 * API layer: fetch a publication-quality figure (PNG, white background, 600 DPI)
 * from ``POST /export/plot`` as a blob → object URL, for embedding as an <img>
 * in the printable /report route. No React here.
 *
 * The report embeds the *server-rendered* matplotlib figures (not the live
 * Plotly dark charts) so the PDF comes out journal-ready and print-friendly.
 */

import type { RSMModel } from "@/domain/analysis";
import { API_BASE_URL } from "@/lib/config";

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

/**
 * Fetches one figure as an object URL, or ``null`` when the fitted model does
 * not produce that plot (backend answers 422). The caller revokes the URL on
 * unmount. A non-422 error (e.g. 404/500) rejects so the report can surface it.
 */
export async function fetchReportPlot(
  input: ReportPlotRequest,
): Promise<string | null> {
  const res = await fetch(`${API_BASE_URL}/export/plot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      experiment_id: input.experimentId,
      response_name: input.responseName,
      model: input.model,
      plot: input.plot,
      format: "png",
      dpi: 600,
      factor_x: input.factorX ?? null,
      factor_y: input.factorY ?? null,
    }),
  });

  // 422 = "o modelo ajustado nao produz esse grafico" → not an error, just skip.
  if (res.status === 422) return null;
  if (!res.ok) {
    throw new Error(`Falha ao gerar a figura '${input.plot}' (HTTP ${res.status})`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
