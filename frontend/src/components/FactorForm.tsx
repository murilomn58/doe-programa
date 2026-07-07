"use client";

import type { FactorInput, FactorType } from "@/domain/design";

interface FactorFormProps {
  factors: FactorInput[];
  onChange: (index: number, factor: FactorInput) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

const inputClass =
  "rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

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
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-200">Fatores</h2>
        <span className="font-mono text-xs text-slate-500">
          {factors.length} fator(es)
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {factors.map((factor, index) => (
          <div
            key={index}
            className="rounded-lg border border-slate-700 bg-slate-900/60 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-cyan-400">
                {labelFor(index)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="text-xs text-slate-400 transition hover:text-red-400"
              >
                Remover
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-300">Nome</span>
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
                <span className="text-slate-300">Tipo</span>
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
                <span className="text-slate-300">Unidade</span>
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
                    <span className="text-slate-300">Nível baixo (−1)</span>
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
                    <span className="text-slate-300">Nível alto (+1)</span>
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
                    <span className="text-slate-300">Rótulo baixo (−1)</span>
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
                    <span className="text-slate-300">Rótulo alto (+1)</span>
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
        className="mt-4 rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-500 hover:text-blue-400"
      >
        + Adicionar fator
      </button>
    </div>
  );
}
