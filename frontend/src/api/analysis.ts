/** API layer: typed fetch call for the analysis engine. No React here. */

import type { AnalysisRequest, AnalysisResult } from "@/domain/analysis";
import { API_BASE_URL } from "@/lib/config";

export async function runAnalysis(
  input: AnalysisRequest,
): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE_URL}/analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await describeError(res));
  }
  return res.json() as Promise<AnalysisResult>;
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
  return `Falha ao rodar a análise (HTTP ${res.status})`;
}
