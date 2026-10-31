"use client";

import {
  type ClipboardEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  FactorRead,
  ResponseRead,
  ResponseValueUpsert,
  RunCellRead,
  RunRead,
} from "@/domain/design";
import {
  classifyCell,
  formatServerValue,
  parseClipboardMatrix,
} from "@/lib/gridEditing";

interface RunsGridProps {
  factors: FactorRead[];
  responses: ResponseRead[];
  runs: RunRead[];
  onSave: (values: ResponseValueUpsert[]) => void;
  isSaving: boolean;
  saveError: string | null;
  savedAt: number | null;
}

const th =
  "border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted";
const td = "border-b border-border-subtle px-3 py-2 font-mono text-sm text-foreground";

function factorDisplay(cell: RunCellRead | undefined): string {
  if (!cell) return "";
  if (cell.label !== null && cell.label !== undefined) return cell.label;
  if (cell.natural !== null && cell.natural !== undefined) return String(cell.natural);
  return String(cell.coded);
}

const makeKey = (runId: number, name: string) => `${runId}|${name}`;

/** Numeric-or-empty equality, so a saved edit ("1,5") matches server (1.5). */
function sameValue(a: string, b: string): boolean {
  const ca = classifyCell(a);
  const cb = classifyCell(b);
  if (ca === "empty" && cb === "empty") return true;
  if (ca === "valid" && cb === "valid") {
    return Number(a.replace(",", ".")) === Number(b.replace(",", "."));
  }
  return a === b;
}

export function RunsGrid({
  factors,
  responses,
  runs,
  onSave,
  isSaving,
  saveError,
  savedAt,
}: RunsGridProps) {
  const factorNames = useMemo(() => factors.map((f) => f.name), [factors]);
  const orderedRuns = useMemo(
    () => [...runs].sort((a, b) => a.run_order - b.run_order),
    [runs],
  );

  // Sparse overlay of user edits keyed `${runId}|${responseName}`. Server data
  // (via TanStack Query) stays the source of truth; this holds only changes.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const inputs = useRef(new Map<string, HTMLInputElement>());

  const runById = useMemo(() => {
    const map = new Map<number, RunRead>();
    for (const run of orderedRuns) if (run.id !== null) map.set(run.id, run);
    return map;
  }, [orderedRuns]);

  // After a save refetch, drop edits that now equal the persisted value.
  useEffect(() => {
    setEdits((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(prev)) {
        const sep = key.indexOf("|");
        const runId = Number(key.slice(0, sep));
        const name = key.slice(sep + 1);
        const run = runById.get(runId);
        if (!run) continue;
        if (sameValue(prev[key], formatServerValue(run.response_values[name]))) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [runById]);

  const rowCount = orderedRuns.length;
  const colCount = responses.length;

  function displayValue(run: RunRead, name: string): string {
    const key = makeKey(run.id ?? -1, name);
    if (Object.prototype.hasOwnProperty.call(edits, key)) return edits[key];
    return formatServerValue(run.response_values[name]);
  }

  function setCell(runId: number, name: string, value: string) {
    setEdits((prev) => ({ ...prev, [makeKey(runId, name)]: value }));
  }

  function focusCell(r: number, c: number) {
    const row = Math.max(0, Math.min(rowCount - 1, r));
    const col = Math.max(0, Math.min(colCount - 1, c));
    const el = inputs.current.get(`${row}-${col}`);
    if (el) {
      el.focus();
      el.select();
    }
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
    const matrix = parseClipboardMatrix(text);
    if (matrix.length <= 1 && (matrix[0]?.length ?? 0) <= 1) return; // single cell: native
    e.preventDefault();
    setEdits((prev) => {
      const next = { ...prev };
      matrix.forEach((cells, dr) => {
        cells.forEach((raw, dc) => {
          const run = orderedRuns[r + dr];
          const response = responses[c + dc];
          if (run && response && run.id !== null) {
            next[makeKey(run.id, response.name)] = raw;
          }
        });
      });
      return next;
    });
  }

  const editKeys = Object.keys(edits);
  const invalidCount = editKeys.filter(
    (k) => classifyCell(edits[k]) === "invalid",
  ).length;
  const dirtyCount = editKeys.length;

  const emptyCount = useMemo(() => {
    let count = 0;
    for (const run of orderedRuns) {
      for (const response of responses) {
        if (classifyCell(displayValue(run, response.name)) === "empty") count += 1;
      }
    }
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedRuns, responses, edits]);

  function handleSave() {
    const values: ResponseValueUpsert[] = editKeys.map((key) => {
      const sep = key.indexOf("|");
      return {
        run_id: Number(key.slice(0, sep)),
        response_name: key.slice(sep + 1),
        value: edits[key],
      };
    });
    onSave(values);
  }

  const canSave = dirtyCount > 0 && invalidCount === 0 && !isSaving;

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-6 shadow-lg">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-medium text-foreground">
          Entrada de dados — respostas dos ensaios
        </h2>
        <span className="font-mono text-xs text-faint">{rowCount} ensaios</span>
      </div>

      {colCount === 0 ? (
        <p className="text-sm text-warning">
          Nenhuma variável de resposta definida para este experimento.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Run</th>
                  <th className={th}>Std</th>
                  <th className={th}>Pt</th>
                  <th className={th}>Blk</th>
                  <th className={th}>Rep</th>
                  {factors.map((factor) => (
                    <th key={`f-${factor.name}`} className={`${th} text-accent-mid`}>
                      {factor.name}
                      {factor.unit ? (
                        <span className="text-faint"> ({factor.unit})</span>
                      ) : null}
                    </th>
                  ))}
                  {responses.map((response) => (
                    <th key={`r-${response.name}`} className={`${th} text-primary-strong`}>
                      {response.name}
                      {response.unit ? (
                        <span className="text-faint"> ({response.unit})</span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderedRuns.map((run, r) => (
                  <tr key={run.id ?? run.run_order} className="hover:bg-surface-0/40">
                    <td className={`${td} text-accent-mid`}>{run.run_order}</td>
                    <td className={td}>{run.std_order}</td>
                    <td className={td}>{run.point_type}</td>
                    <td className={td}>{run.block}</td>
                    <td className={td}>{run.replicate}</td>
                    {factorNames.map((name) => (
                      <td key={name} className={td}>
                        {factorDisplay(run.factors[name])}
                      </td>
                    ))}
                    {responses.map((response, c) => {
                      const value = displayValue(run, response.name);
                      const status = classifyCell(value);
                      const ring =
                        status === "invalid"
                          ? "border-danger-strong focus:border-danger focus:ring-danger"
                          : status === "empty"
                            ? "border-border focus:border-primary focus:ring-primary"
                            : "border-border-strong focus:border-primary focus:ring-primary";
                      return (
                        <td key={response.name} className="border-b border-border-subtle px-1 py-1">
                          <input
                            ref={(el) => {
                              const k = `${r}-${c}`;
                              if (el) inputs.current.set(k, el);
                              else inputs.current.delete(k);
                            }}
                            inputMode="decimal"
                            aria-label={`${response.name} do ensaio ${run.run_order}`}
                            aria-invalid={status === "invalid"}
                            value={value}
                            onChange={(e) =>
                              run.id !== null &&
                              setCell(run.id, response.name, e.target.value)
                            }
                            onKeyDown={(e) => handleKeyDown(e, r, c)}
                            onPaste={(e) => handlePaste(e, r, c)}
                            onFocus={(e) => e.currentTarget.select()}
                            className={`w-24 rounded-md border bg-surface-0 px-2 py-1 text-right font-mono text-sm text-foreground-strong outline-none transition focus:ring-1 ${ring}`}
                            placeholder="—"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1 text-xs">
              {invalidCount > 0 ? (
                <span className="text-danger">
                  Corrija {invalidCount} valor(es) não numérico(s) para salvar.
                </span>
              ) : null}
              {emptyCount > 0 ? (
                <span className="text-warning">
                  {emptyCount} célula(s) de resposta ainda vazia(s) — o salvamento
                  parcial é permitido.
                </span>
              ) : (
                <span className="text-significant">
                  Todas as respostas preenchidas.
                </span>
              )}
              {saveError ? <span className="text-danger">{saveError}</span> : null}
              {savedAt && dirtyCount === 0 && !saveError ? (
                <span className="text-significant">Respostas salvas.</span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-md bg-accent-strong px-4 py-2 text-sm font-medium text-on-accent transition hover:bg-accent-mid disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving
                ? "Salvando…"
                : dirtyCount > 0
                  ? `Salvar respostas (${dirtyCount})`
                  : "Salvar respostas"}
            </button>
          </div>

          <p className="mt-3 text-xs text-faint">
            Edite as células de resposta e navegue com Tab, Enter e as setas. Você
            pode colar um bloco copiado do Excel a partir de qualquer célula.
          </p>
        </>
      )}
    </div>
  );
}
