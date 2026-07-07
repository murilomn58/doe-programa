"use client";

import type { ResponseInput } from "@/domain/design";

interface ResponsesFormProps {
  responses: ResponseInput[];
  onChange: (index: number, response: ResponseInput) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

const inputClass =
  "rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

export function ResponsesForm({
  responses,
  onChange,
  onAdd,
  onRemove,
}: ResponsesFormProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-200">Respostas</h2>
        <span className="font-mono text-xs text-slate-500">
          {responses.length} resposta(s)
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {responses.map((response, index) => (
          <div
            key={index}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">Nome</span>
              <input
                type="text"
                value={response.name}
                onChange={(e) =>
                  onChange(index, { ...response, name: e.target.value })
                }
                placeholder="Ex.: Módulo de Resiliência"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">Unidade</span>
              <input
                type="text"
                value={response.unit ?? ""}
                onChange={(e) =>
                  onChange(index, {
                    ...response,
                    unit: e.target.value || undefined,
                  })
                }
                placeholder="Ex.: MPa (opcional)"
                className={inputClass}
              />
            </label>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="h-fit rounded-md px-2 py-2 text-xs text-slate-400 transition hover:text-red-400"
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mt-4 rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-500 hover:text-blue-400"
      >
        + Adicionar resposta
      </button>
    </div>
  );
}
