import type { FactorType } from "./RunsGrid";

export type { FactorType };

/** A factor as described in the setup wizard (request side). */
export interface FactorInput {
  name: string;
  factor_type: FactorType;
  unit?: string;
  low?: number;
  high?: number;
  low_label?: string;
  high_label?: string;
  /** Fatores Taguchi de 3+ níveis: lista ordenada de valores; null → par baixo/alto. */
  levels?: number[];
}

export interface FactorFormProps {
  factors: FactorInput[];
  onChange: (index: number, factor: FactorInput) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

const inputClass =
  "rounded-md border border-border-strong bg-surface-0 px-3 py-2 text-foreground-strong outline-none transition focus:border-primary focus:ring-1 focus:ring-primary";

const labelFor = (index: number) => String.fromCharCode(65 + index); // A, B, C…

function numberOrUndefined(value: string): number | undefined {
  return value === "" ? undefined : Number(value);
}

export function FactorForm({
  factors,
  onChange,
  onAdd,
  onRemove,
}: FactorFormProps) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-6 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-foreground">Fatores</h2>
        <span className="font-mono text-xs text-faint">
          {factors.length} fator(es)
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {factors.map((factor, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-surface-0/60 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-accent-mid">
                {labelFor(index)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="text-xs text-muted transition hover:text-danger"
              >
                Remover
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Nome</span>
                <input
                  type="text"
                  value={factor.name}
                  onChange={(e) =>
                    onChange(index, { ...factor, name: e.target.value })
                  }
                  placeholder="Ex.: % de fibra"
                  className={inputClass}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Tipo</span>
                <select
                  value={factor.factor_type}
                  onChange={(e) =>
                    onChange(index, {
                      ...factor,
                      factor_type: e.target.value as FactorType,
                    })
                  }
                  className={inputClass}
                >
                  <option value="quantitative">Quantitativo</option>
                  <option value="qualitative">Qualitativo</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Unidade</span>
                <input
                  type="text"
                  value={factor.unit ?? ""}
                  onChange={(e) =>
                    onChange(index, {
                      ...factor,
                      unit: e.target.value || undefined,
                    })
                  }
                  placeholder="Ex.: %, MPa (opcional)"
                  className={inputClass}
                />
              </label>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {factor.factor_type === "quantitative" ? (
                <>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-foreground-soft">Nível baixo (−1)</span>
                    <input
                      type="number"
                      value={factor.low ?? ""}
                      onChange={(e) =>
                        onChange(index, {
                          ...factor,
                          low: numberOrUndefined(e.target.value),
                        })
                      }
                      placeholder="Ex.: 0"
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-foreground-soft">Nível alto (+1)</span>
                    <input
                      type="number"
                      value={factor.high ?? ""}
                      onChange={(e) =>
                        onChange(index, {
                          ...factor,
                          high: numberOrUndefined(e.target.value),
                        })
                      }
                      placeholder="Ex.: 1.5"
                      className={inputClass}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-foreground-soft">Rótulo baixo (−1)</span>
                    <input
                      type="text"
                      value={factor.low_label ?? ""}
                      onChange={(e) =>
                        onChange(index, {
                          ...factor,
                          low_label: e.target.value || undefined,
                        })
                      }
                      placeholder="Ex.: Tucum"
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-foreground-soft">Rótulo alto (+1)</span>
                    <input
                      type="text"
                      value={factor.high_label ?? ""}
                      onChange={(e) =>
                        onChange(index, {
                          ...factor,
                          high_label: e.target.value || undefined,
                        })
                      }
                      placeholder="Ex.: Piassava"
                      className={inputClass}
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mt-4 rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary-soft"
      >
        + Adicionar fator
      </button>
    </div>
  );
}
