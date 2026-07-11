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
    <section className="rounded-xl border border-border bg-surface-1 p-6 shadow-lg">
      <h3 className="mb-4 text-base font-medium text-foreground">
        Modelo de superfície de resposta
      </h3>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-muted">
            Variável de resposta
          </label>
          <select
            value={selectedResponse ?? ""}
            onChange={(e) => onSelectResponse(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-surface-0 px-3 py-2 text-sm text-foreground-strong outline-none focus:border-accent-strong focus:ring-1 focus:ring-accent-strong"
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
          <span className="mb-1 block text-xs uppercase tracking-wide text-muted">
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
                      ? "border-accent-strong bg-accent-strong/15 text-accent"
                      : "border-border-strong text-foreground-soft hover:border-border-strong"
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
          <span className="mb-1 block text-xs uppercase tracking-wide text-muted">
            Termos do modelo
          </span>
          <div className="flex flex-wrap gap-1.5">
            {terms.map((t) => (
              <span
                key={t.label}
                className="rounded bg-surface-0 px-2 py-0.5 font-mono text-xs text-foreground-soft"
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
