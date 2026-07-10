/** Presentational: response selector + RSM model picker + term preview. */

export type RSMModel =
  | "linear"
  | "linear_quadratic"
  | "linear_interactions"
  | "full";

export interface TermRead {
  label: string;
  kind: "main" | "interaction" | "quadratic";
}

/** The four class RSM models, ordered for the ModelBuilder. */
const RSM_MODELS: { value: RSMModel; label: string; hint: string }[] = [
  { value: "linear", label: "Linear", hint: "Somente efeitos principais" },
  {
    value: "linear_interactions",
    label: "Linear + Interações",
    hint: "Efeitos principais + interações de 2 fatores",
  },
  {
    value: "linear_quadratic",
    label: "Linear + Quadrático",
    hint: "Efeitos principais + termos quadráticos (exige CCD/Box-Behnken)",
  },
  {
    value: "full",
    label: "Completo",
    hint: "Principais + interações + quadráticos",
  },
];

export interface ModelBuilderProps {
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
                      : "border-border-strong text-foreground-soft hover:border-faint"
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
