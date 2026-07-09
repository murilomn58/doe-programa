/** API layer: publication-quality figure export (issue 08). No React here. */

import type { RSMModel } from "@/domain/analysis";
import { API_BASE_URL } from "@/lib/config";

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

/**
 * POST /export/plot → recebe a imagem (bytes), lê o nome do arquivo do header
 * ``Content-Disposition`` (ou deriva de plot/format) e dispara o download no
 * browser via ``createObjectURL`` + ``<a download>``. O cálculo/renderização é
 * TODO no backend (matplotlib/SciencePlots) — o front só entrega os bytes.
 */
export async function exportPlot(body: ExportPlotBody): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/export/plot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dpi: 600, ...body }),
  });
  if (!res.ok) {
    throw new Error(await describeError(res));
  }

  const blob = await res.blob();
  const filename =
    filenameFromDisposition(res.headers.get("Content-Disposition")) ??
    `${body.plot}.${body.format}`;

  triggerDownload(blob, filename);
}

/** Parse ``filename="..."`` (or RFC 5987 ``filename*=``) do Content-Disposition. */
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // fall through to the plain filename form
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() ?? null;
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

async function describeError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail) && body.detail.length > 0) {
      const first = body.detail[0] as { msg?: string };
      if (first.msg) return first.msg;
    }
  } catch {
    // fall through to the generic message
  }
  return `Falha ao exportar a figura (HTTP ${res.status})`;
}
