/** API layer: typed fetch for the interactive profiler (issue 10). No React. */

import type { ProfilerRequest, ProfilerResult } from "@/domain/plots";
import { API_BASE_URL } from "@/lib/config";

/**
 * POST /analysis/profiler — predição + IC no ponto codificado, uma fatia 1-D por
 * fator e o ótimo no cubo. Tudo recalculado no backend (statsmodels), nunca no
 * front. O POST é idempotente (leitura pura da matriz + ajuste), então casa com
 * uma query.
 */
export async function runProfiler(
  input: ProfilerRequest,
): Promise<ProfilerResult> {
  const res = await fetch(`${API_BASE_URL}/analysis/profiler`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await describeError(res));
  }
  return res.json() as Promise<ProfilerResult>;
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
  return `Falha ao rodar o profiler (HTTP ${res.status})`;
}
