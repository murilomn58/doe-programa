import { Report } from "@/containers/Report";
import type { RSMModel } from "@/domain/analysis";
import { RSM_MODELS } from "@/domain/analysis";

/**
 * Printable report route consumed by the backend's Playwright renderer:
 *   GET /report/{id}?response={name}&model={model}
 *
 * Server component: unwraps ``params``/``searchParams`` (Promises in Next 15)
 * and hands them to the client ``<Report>`` container, which fetches the data,
 * embeds the publication figures and mounts ``#report-ready`` when everything
 * is painted. Rendered on WHITE paper (see the light theme in the container).
 *
 * Never statically cached — the report always reflects the current stored data.
 */
export const dynamic = "force-dynamic";

const VALID_MODELS = new Set<RSMModel>(RSM_MODELS.map((m) => m.value));

function normalizeModel(raw: string | string[] | undefined): RSMModel {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && VALID_MODELS.has(value as RSMModel)
    ? (value as RSMModel)
    : "linear";
}

function firstParam(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ?? null;
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const experimentId = Number(id);
  const response = firstParam(query.response);
  const model = normalizeModel(query.model);

  if (!Number.isFinite(experimentId) || experimentId <= 0) {
    return (
      <main className="mx-auto max-w-[21cm] bg-white px-10 py-10 text-slate-900">
        <p className="text-sm text-red-700">
          Identificador de experimento inválido.
        </p>
      </main>
    );
  }

  if (!response) {
    return (
      <main className="mx-auto max-w-[21cm] bg-white px-10 py-10 text-slate-900">
        <p className="text-sm text-red-700">
          Parâmetro obrigatório ausente: informe a variável de resposta em
          ?response=…
        </p>
      </main>
    );
  }

  return (
    <main className="report-page min-h-screen bg-white">
      <Report experimentId={experimentId} response={response} model={model} />
    </main>
  );
}
