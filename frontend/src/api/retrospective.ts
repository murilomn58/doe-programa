/** API layer: typed fetch calls for retrospective design detection. No React. */

import type {
  RetroDiagnoseRequest,
  RetroDiagnoseResponse,
  RetroMaterializeRequest,
  RetroMaterializeResult,
} from "@/domain/retrospective";
import { API_BASE_URL } from "@/lib/config";

export async function postDiagnose(
  input: RetroDiagnoseRequest,
): Promise<RetroDiagnoseResponse> {
  const res = await fetch(`${API_BASE_URL}/retrospective/diagnose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await describeError(res, "Falha ao diagnosticar a tabela"));
  }
  return res.json() as Promise<RetroDiagnoseResponse>;
}

export async function postMaterialize(
  input: RetroMaterializeRequest,
): Promise<RetroMaterializeResult> {
  const res = await fetch(`${API_BASE_URL}/retrospective/materialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await describeError(res, "Falha ao criar o experimento"));
  }
  return res.json() as Promise<RetroMaterializeResult>;
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
