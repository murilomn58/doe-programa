"use client";

import {
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  useRef,
} from "react";

import type { FactorScale } from "@/domain/retrospective";
import type { RetroTableModel } from "@/lib/retroTable";
import { applyPaste, columnCount, normalizeRows } from "@/lib/retroTable";

interface RetroGridProps {
  model: RetroTableModel;
  onChange: (model: RetroTableModel) => void;
  /** Import a CSV/TSV file (the container parses it into a new model). */
  onImportFile: (file: File) => void;
}

const FACTOR_TYPE_LABEL: Record<FactorScale, string> = {
  auto: "auto",
  quantitative: "quant",
  qualitative: "qual",
};

const FACTOR_TYPE_ORDER: FactorScale[] = ["auto", "quantitative", "qualitative"];

const th =
  "border-b border-border px-2 py-2 text-left text-xs font-semibold text-foreground-soft";

/** Editable grid with dynamic factor/response columns (all cells editable). */
export function RetroGrid({ model, onChange, onImportFile }: RetroGridProps) {
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const fileInput = useRef<HTMLInputElement>(null);

  const rows = normalizeRows(model);
  const nFactors = model.factorCols.length;
  const nCols = columnCount(model);
  const rowCount = rows.length;

  function focusCell(r: number, c: number) {
    const row = Math.max(0, Math.min(rowCount - 1, r));
    const col = Math.max(0, Math.min(nCols - 1, c));
    const el = inputs.current.get(`${row}-${col}`);
    if (el) {
      el.focus();
      el.select();
    }
  }

  function setCell(r: number, c: number, value: string) {
    const next = rows.map((cells) => [...cells]);
    next[r][c] = value;
    onChange({ ...model, rows: next });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    const el = e.currentTarget;
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      focusCell(r + 1, c);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusCell(r - 1, c);
    } else if (e.key === "ArrowRight" && el.selectionStart === el.value.length) {
      e.preventDefault();
      focusCell(r, c + 1);
    } else if (e.key === "ArrowLeft" && el.selectionStart === 0) {
      e.preventDefault();
      focusCell(r, c - 1);
    }
    // Tab / Shift+Tab keep their native between-cell behaviour.
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>, r: number, c: number) {
    const text = e.clipboardData.getData("text");
    // Single-cell paste: let the browser handle it natively.
    if (!text.includes("\t") && !text.includes("\n") && !text.includes("\r")) {
      return;
    }
    e.preventDefault();
    onChange(applyPaste(model, r, c, text));
  }

  // --- column ops ------------------------------------------------------------

  function addFactor() {
    const name = `X${model.factorCols.length + 1}`;
    const factorCols = [
      ...model.factorCols,
      { name, type: "auto" as FactorScale },
    ];
    // Insert the new (blank) factor cell at the factor/response boundary.
    const grownRows = rows.map((cells) => [
      ...cells.slice(0, nFactors),
      "",
      ...cells.slice(nFactors),
    ]);
    onChange({ ...model, factorCols, rows: grownRows });
  }

  function addResponse() {
    const name = `Y${model.responseCols.length + 1}`;
    const next: RetroTableModel = {
      ...model,
      responseCols: [...model.responseCols, { name }],
    };
    onChange({ ...next, rows: normalizeRows(next) });
  }

  function addRow() {
    const blank = Array.from({ length: nCols }, () => "");
    onChange({ ...model, rows: [...rows, blank] });
  }

  function removeColumn(colIndex: number) {
    const isFactor = colIndex < nFactors;
    const factorCols = isFactor
      ? model.factorCols.filter((_, i) => i !== colIndex)
      : model.factorCols;
    const responseCols = isFactor
      ? model.responseCols
      : model.responseCols.filter((_, i) => i !== colIndex - nFactors);
    const trimmedRows = rows.map((cells) =>
      cells.filter((_, i) => i !== colIndex),
    );
    onChange({ factorCols, responseCols, rows: trimmedRows });
  }

  function removeRow(rowIndex: number) {
    onChange({ ...model, rows: rows.filter((_, i) => i !== rowIndex) });
  }

  function renameColumn(colIndex: number, name: string) {
    const isFactor = colIndex < nFactors;
    if (isFactor) {
      const factorCols = model.factorCols.map((c, i) =>
        i === colIndex ? { ...c, name } : c,
      );
      onChange({ ...model, factorCols });
    } else {
      const responseCols = model.responseCols.map((c, i) =>
        i === colIndex - nFactors ? { ...c, name } : c,
      );
      onChange({ ...model, responseCols });
    }
  }

  function cycleFactorType(colIndex: number) {
    const col = model.factorCols[colIndex];
    if (!col) return;
    const idx = FACTOR_TYPE_ORDER.indexOf(col.type);
    const nextType = FACTOR_TYPE_ORDER[(idx + 1) % FACTOR_TYPE_ORDER.length];
    const factorCols = model.factorCols.map((c, i) =>
      i === colIndex ? { ...c, type: nextType } : c,
    );
    onChange({ ...model, factorCols });
  }

  /** Toggle a column between factor (last factor) and response (first response). */
  function toggleColumnRole(colIndex: number) {
    const isFactor = colIndex < nFactors;
    if (isFactor) {
      // Move this factor to the end of the responses.
      const col = model.factorCols[colIndex];
      const factorCols = model.factorCols.filter((_, i) => i !== colIndex);
      const responseCols = [
        ...model.responseCols,
        { name: col.name, unit: col.unit },
      ];
      const newRows = rows.map((cells) => {
        const value = cells[colIndex] ?? "";
        const without = cells.filter((_, i) => i !== colIndex);
        return [...without, value];
      });
      onChange({ factorCols, responseCols, rows: newRows });
    } else {
      // Move this response to the end of the factors.
      const respIndex = colIndex - nFactors;
      const col = model.responseCols[respIndex];
      const responseCols = model.responseCols.filter((_, i) => i !== respIndex);
      const factorCols = [
        ...model.factorCols,
        { name: col.name, type: "auto" as FactorScale, unit: col.unit },
      ];
      const newRows = rows.map((cells) => {
        const value = cells[colIndex] ?? "";
        const without = cells.filter((_, i) => i !== colIndex);
        return [
          ...without.slice(0, nFactors),
          value,
          ...without.slice(nFactors),
        ];
      });
      onChange({ factorCols, responseCols, rows: newRows });
    }
  }

  const btn =
    "rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-border hover:bg-surface-2";

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-6 shadow-lg">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={addFactor} className={btn}>
          + Fator
        </button>
        <button type="button" onClick={addResponse} className={btn}>
          + Resposta
        </button>
        <button type="button" onClick={addRow} className={btn}>
          + Linha
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className={btn}
        >
          Importar CSV
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.tsv,.txt,text/csv"
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
            e.target.value = "";
          }}
        />
        <span className="ml-auto text-xs text-faint">
          Dica: cole (Ctrl+V) um bloco copiado do Excel em qualquer célula.
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${th} w-10 text-center text-faint`}>#</th>
              {model.factorCols.map((col, c) => (
                <th key={`f-head-${c}`} className={`${th} bg-accent-strong/5`}>
                  <ColumnHeader
                    name={col.name}
                    accent="cyan"
                    role="fator"
                    typeLabel={FACTOR_TYPE_LABEL[col.type]}
                    onRename={(v) => renameColumn(c, v)}
                    onToggleType={() => cycleFactorType(c)}
                    onToggleRole={() => toggleColumnRole(c)}
                    onRemove={() => removeColumn(c)}
                  />
                </th>
              ))}
              {model.responseCols.map((col, i) => {
                const c = nFactors + i;
                return (
                  <th key={`r-head-${i}`} className={`${th} bg-significant-strong/5`}>
                    <ColumnHeader
                      name={col.name}
                      accent="emerald"
                      role="resposta"
                      onRename={(v) => renameColumn(c, v)}
                      onToggleRole={() => toggleColumnRole(c)}
                      onRemove={() => removeColumn(c)}
                    />
                  </th>
                );
              })}
              <th className={`${th} w-8`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, r) => (
              <tr key={r} className="hover:bg-surface-0/40">
                <td className="border-b border-border-subtle px-2 py-1 text-center font-mono text-xs text-faint">
                  {r + 1}
                </td>
                {cells.map((value, c) => {
                  const isFactor = c < nFactors;
                  const accent = isFactor
                    ? "border-accent-deep-border/60 focus:border-accent-strong focus:ring-accent-strong"
                    : "border-significant-border/60 focus:border-significant-strong focus:ring-significant-strong";
                  return (
                    <td
                      key={c}
                      className="border-b border-border-subtle px-1 py-1"
                    >
                      <input
                        ref={(el) => {
                          const k = `${r}-${c}`;
                          if (el) inputs.current.set(k, el);
                          else inputs.current.delete(k);
                        }}
                        value={value}
                        aria-label={`Linha ${r + 1}, coluna ${c + 1}`}
                        onChange={(e) => setCell(r, c, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, r, c)}
                        onPaste={(e) => handlePaste(e, r, c)}
                        onFocus={(e) => e.currentTarget.select()}
                        className={`w-24 rounded-md border bg-surface-0 px-2 py-1 text-right font-mono text-sm text-foreground-strong outline-none transition focus:ring-1 ${accent}`}
                        placeholder="—"
                      />
                    </td>
                  );
                })}
                <td className="border-b border-border-subtle px-1 py-1 text-center">
                  <button
                    type="button"
                    aria-label={`Remover linha ${r + 1}`}
                    onClick={() => removeRow(r)}
                    className="rounded px-1.5 text-faint transition hover:bg-danger-strong/10 hover:text-danger"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-faint">
        Marque cada coluna como{" "}
        <span className="text-accent-mid">fator</span> ou{" "}
        <span className="text-significant">resposta</span> e defina o tipo do
        fator (auto/quant/qual). Navegue com Tab, Enter e as setas.
      </p>
    </div>
  );
}

interface ColumnHeaderProps {
  name: string;
  accent: "cyan" | "emerald";
  role: "fator" | "resposta";
  typeLabel?: string;
  onRename: (name: string) => void;
  onToggleType?: () => void;
  onToggleRole: () => void;
  onRemove: () => void;
}

function ColumnHeader({
  name,
  accent,
  role,
  typeLabel,
  onRename,
  onToggleType,
  onToggleRole,
  onRemove,
}: ColumnHeaderProps) {
  const nameColor = accent === "cyan" ? "text-accent" : "text-significant-soft";
  return (
    <div className="flex min-w-24 flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          value={name}
          onChange={(e) => onRename(e.target.value)}
          aria-label={`Nome da coluna ${role}`}
          className={`w-full rounded border border-border bg-surface-0 px-1.5 py-0.5 text-xs font-semibold outline-none focus:border-border ${nameColor}`}
        />
        <button
          type="button"
          aria-label="Remover coluna"
          onClick={onRemove}
          className="rounded px-1 text-faint transition hover:bg-danger-strong/10 hover:text-danger"
        >
          ×
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleRole}
          title="Alternar entre fator e resposta"
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide transition ${
            accent === "cyan"
              ? "bg-accent-strong/15 text-accent hover:bg-accent-strong/25"
              : "bg-significant-strong/15 text-significant-soft hover:bg-significant-strong/25"
          }`}
        >
          {role}
        </button>
        {onToggleType && typeLabel ? (
          <button
            type="button"
            onClick={onToggleType}
            title="Tipo do fator (auto → quantitativo → qualitativo)"
            className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground-soft transition hover:bg-surface-3"
          >
            {typeLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
