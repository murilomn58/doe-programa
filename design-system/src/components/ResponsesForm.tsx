export interface ResponseInput {
  name: string;
  unit?: string;
}

export interface ResponsesFormProps {
  responses: ResponseInput[];
  onChange: (index: number, response: ResponseInput) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

const inputClass =
  "rounded-md border border-border-strong bg-surface-0 px-3 py-2 text-foreground-strong outline-none transition focus:border-primary focus:ring-1 focus:ring-primary";

export function ResponsesForm({
  responses,
  onChange,
  onAdd,
  onRemove,
}: ResponsesFormProps) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-6 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-foreground">Respostas</h2>
        <span className="font-mono text-xs text-faint">
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
              <span className="text-foreground-soft">Nome</span>
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
              <span className="text-foreground-soft">Unidade</span>
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
              className="h-fit rounded-md px-2 py-2 text-xs text-muted transition hover:text-danger"
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mt-4 rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary-soft"
      >
        + Adicionar resposta
      </button>
    </div>
  );
}
