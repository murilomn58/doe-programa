/** Presentational: response selector + RSM model picker + term preview. */

import type { RSMModel, TermRead } from "@/domain/analysis";
import { RSM_MODELS } from "@/domain/analysis";

interface ModelBuilderProps {
  responses: string[];
  selectedResponse: string | null;
  onSelectResponse: (name: string) => void;
  model: RSMModel;
  onSelectModel: (model: RSMModel) => void;
  terms: TermRead[];
}

export function ModelBuilder({
  responses,
  selectedResponse,
  onSelectResponse,
  model,
  onSelectModel,
  terms,
}: ModelBuilderProps) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
      <h3 className="mb-4 text-base font-medium text-slate-200">
        Modelo de superfície de resposta
      </h3>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
            Variável de resposta
          </label>
          <select
            value={selectedResponse ?? ""}
            onChange={(e) => onSelectResponse(e.target.value)}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          >
            {responses.length === 0 ? (
              <option value="">Nenhuma resposta definida</option>
            ) : null}
            {responses.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
            Modelo
          </span>
          <div className="flex flex-wrap gap-2">
            {RSM_MODELS.map((m) => {
              const active = m.value === model;
              return (
                <button
                  key={m.value}
                  type="button"
                  title={m.hint}
                  onClick={() => onSelectModel(m.value)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition ${
                    active
                      ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                      : "border-slate-600 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {terms.length > 0 ? (
        <div className="mt-4">
          <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
            Termos do modelo
          </span>
          <div className="flex flex-wrap gap-1.5">
            {terms.map((t) => (
              <span
                key={t.label}
                className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs text-slate-300"
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
