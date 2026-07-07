/** API layer: typed fetch calls for run/response entry. No React here. */

import type { ResponsesUpsertRequest, RunsRead } from "@/domain/design";
import { API_BASE_URL } from "@/lib/config";

export async function getRuns(experimentId: number): Promise<RunsRead> {
  const res = await fetch(`${API_BASE_URL}/experiments/${experimentId}/runs`);
  if (!res.ok) {
    throw new Error(await describeError(res, "Falha ao carregar os ensaios"));
  }
  return res.json() as Promise<RunsRead>;
}

export async function saveResponses(
  experimentId: number,
  input: ResponsesUpsertRequest,
): Promise<RunsRead> {
  const res = await fetch(
    `${API_BASE_URL}/experiments/${experimentId}/runs/responses`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) {
    throw new Error(await describeError(res, "Falha ao salvar as respostas"));
  }
  return res.json() as Promise<RunsRead>;
}

async function describeError(res: Response, fallback: string): Promise<string> {
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
  return `${fallback} (HTTP ${res.status})`;
}
