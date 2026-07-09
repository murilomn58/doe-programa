/** Pure, framework-free helpers for the retrospective table editor.
 *
 * The table model here is a plain object: dynamic factor/response columns plus
 * a matrix of raw string cells. No React, no DOM — so paste-parsing, CSV import
 * and request building stay unit-testable in isolation. Cell text is kept raw
 * (spreadsheet-style, ','/'.' decimals) and handed to the backend as-is; the
 * backend owns all numeric parsing so there is one source of truth.
 */

import { parseClipboardMatrix } from "@/lib/gridEditing";
import type {
  FactorScale,
  RetroDiagnoseRequest,
} from "@/domain/retrospective";

export interface FactorColumn {
  name: string;
  type: FactorScale;
  unit?: string;
}

export interface ResponseColumn {
  name: string;
  unit?: string;
}

/** The full editable table: columns (factors then responses) + a row matrix. */
export interface RetroTableModel {
  factorCols: FactorColumn[];
  responseCols: ResponseColumn[];
  /** rows[r][c]: c indexes the flattened column order (factors, then responses). */
  rows: string[][];
}

/** Total column count (factors first, responses after). */
export function columnCount(model: RetroTableModel): number {
  return model.factorCols.length + model.responseCols.length;
}

/** Ensure a row has exactly ``columnCount`` cells (pad/truncate with ""). */
function normalizeRow(row: string[], width: number): string[] {
  const next = row.slice(0, width);
  while (next.length < width) next.push("");
  return next;
}

/** Reconcile every row against the current column count. */
export function normalizeRows(model: RetroTableModel): string[][] {
  const width = columnCount(model);
  return model.rows.map((r) => normalizeRow(r, width));
}

/** A blank model with sensible defaults (2 factors + 1 response, 4 rows). */
export function emptyModel(): RetroTableModel {
  const factorCols: FactorColumn[] = [
    { name: "X1", type: "auto" },
    { name: "X2", type: "auto" },
  ];
  const responseCols: ResponseColumn[] = [{ name: "Y" }];
  const width = factorCols.length + responseCols.length;
  const rows = Array.from({ length: 4 }, () =>
    Array.from({ length: width }, () => ""),
  );
  return { factorCols, responseCols, rows };
}

// --- clipboard paste ---------------------------------------------------------

/**
 * Apply a spreadsheet paste at (startRow, startCol), growing the table as
 * needed so a block copied from Excel lands whole. Extra columns beyond the
 * current width are appended as response columns (a pasted block that overflows
 * the response side is the common case). Reuses ``parseClipboardMatrix``.
 */
export function applyPaste(
  model: RetroTableModel,
  startRow: number,
  startCol: number,
  tsvText: string,
): RetroTableModel {
  const matrix = parseClipboardMatrix(tsvText);
  if (matrix.length === 0) return model;

  const pastedWidth = Math.max(...matrix.map((r) => r.length));
  const neededCols = startCol + pastedWidth;
  let next = growColumns(model, neededCols);

  const neededRows = startRow + matrix.length;
  const rows = normalizeRows(next).map((r) => [...r]);
  while (rows.length < neededRows) {
    rows.push(Array.from({ length: columnCount(next) }, () => ""));
  }

  matrix.forEach((cells, dr) => {
    cells.forEach((raw, dc) => {
      const r = startRow + dr;
      const c = startCol + dc;
      if (rows[r] && c < columnCount(next)) rows[r][c] = raw;
    });
  });

  next = { ...next, rows };
  return next;
}

/** Append response columns until the table has at least ``target`` columns. */
function growColumns(
  model: RetroTableModel,
  target: number,
): RetroTableModel {
  if (columnCount(model) >= target) return model;
  const responseCols = [...model.responseCols];
  let idx = model.responseCols.length + 1;
  while (model.factorCols.length + responseCols.length < target) {
    responseCols.push({ name: `Y${idx}` });
    idx += 1;
  }
  return { ...model, responseCols };
}

// --- CSV import --------------------------------------------------------------

/** True when a trimmed cell parses as a number (','/'.' decimal). */
function isNumericCell(raw: string): boolean {
  const text = raw.trim();
  if (text === "") return false;
  return Number.isFinite(Number(text.replace(",", ".")));
}

/**
 * Detect the CSV field separator. PT-BR spreadsheets often use ';' precisely
 * because ',' is the decimal mark; we pick ';' when it appears, else ','.
 */
function detectSeparator(text: string): ";" | "," | "\t" {
  const firstLine = text.replace(/\r\n?/g, "\n").split("\n")[0] ?? "";
  if (firstLine.includes("\t")) return "\t";
  if (firstLine.includes(";")) return ";";
  return ",";
}

/**
 * Parse CSV/TSV text into a table model. Detects the separator (';' or ','),
 * infers a header row (see ``inferHeaderRow``), and — when ',' is the decimal
 * mark under a ';' separator — normalizes decimal commas so the raw cells stay
 * numeric strings. The first column defaults to a factor and everything is a
 * factor except the last column, which becomes the response (a safe default the
 * user can re-tag per column in the grid).
 */
export function parseCsv(text: string): RetroTableModel {
  const sep = detectSeparator(text);
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");
  if (lines.length === 0) return emptyModel();

  const grid = lines.map((line) =>
    line.split(sep).map((cell) => cell.trim()),
  );
  const width = Math.max(...grid.map((r) => r.length));
  const padded = grid.map((r) => normalizeRow(r, width));

  const hasHeader = inferHeaderRow(padded);
  const headerNames = hasHeader ? padded[0] : null;
  const bodyRaw = hasHeader ? padded.slice(1) : padded;

  // Under a ';' separator, decimal commas are values, not delimiters — keep
  // them as-is (the backend accepts ','). No transformation needed.
  const body = bodyRaw;

  // One response by default (last column); the rest are factors. If there is a
  // single column, treat it as a response so the grid is still usable.
  const nCols = width;
  const nFactors = nCols > 1 ? nCols - 1 : 0;

  const factorCols: FactorColumn[] = [];
  const responseCols: ResponseColumn[] = [];
  for (let c = 0; c < nCols; c += 1) {
    const name = headerNames?.[c]?.trim() || defaultColName(c, nFactors);
    if (c < nFactors) factorCols.push({ name, type: "auto" });
    else responseCols.push({ name });
  }

  return { factorCols, responseCols, rows: body };
}

function defaultColName(index: number, nFactors: number): string {
  return index < nFactors ? `X${index + 1}` : `Y${index - nFactors + 1}`;
}

/**
 * A header row is present when the first row is entirely non-numeric while at
 * least one later row contains a numeric cell (labels on top of data). A table
 * that is all text (pure qualitative labels) has no numeric body, so we do not
 * steal its first data row as a header.
 */
export function inferHeaderRow(grid: string[][]): boolean {
  if (grid.length < 2) return false;
  const first = grid[0];
  const firstAllText = first.every((c) => !isNumericCell(c));
  if (!firstAllText) return false;
  const bodyHasNumeric = grid
    .slice(1)
    .some((row) => row.some((c) => isNumericCell(c)));
  return bodyHasNumeric;
}

// --- request building --------------------------------------------------------

/** Trimmed unit or undefined (never send empty strings to the backend). */
function cleanUnit(unit?: string): string | undefined {
  const t = unit?.trim();
  return t ? t : undefined;
}

/**
 * Build the /retrospective/diagnose (or materialize factors/responses/rows)
 * payload from the table model. Empty rows (every cell blank) are dropped; each
 * kept row is keyed by column name. Cells stay raw strings for the backend.
 */
export function toDiagnoseRequest(
  model: RetroTableModel,
  responseName?: string,
): RetroDiagnoseRequest {
  const rows = normalizeRows(model);
  const nFactors = model.factorCols.length;

  const outRows = rows
    .filter((cells) => cells.some((c) => c.trim() !== ""))
    .map((cells) => {
      const factors: Record<string, string> = {};
      const responses: Record<string, string> = {};
      model.factorCols.forEach((col, i) => {
        factors[col.name] = cells[i] ?? "";
      });
      model.responseCols.forEach((col, i) => {
        responses[col.name] = cells[nFactors + i] ?? "";
      });
      return { factors, responses };
    });

  return {
    factors: model.factorCols.map((c) => ({
      name: c.name,
      factor_type: c.type,
      unit: cleanUnit(c.unit) ?? null,
    })),
    responses: model.responseCols.map((c) => ({
      name: c.name,
      unit: cleanUnit(c.unit) ?? null,
    })),
    rows: outRows,
    response_name: responseName ?? null,
  };
}

/**
 * Count rows that have at least one non-empty factor cell — the gate that
 * decides whether the diagnose request is worth firing (needs ≥ 3).
 */
export function countRowsWithFactors(model: RetroTableModel): number {
  const rows = normalizeRows(model);
  const nFactors = model.factorCols.length;
  if (nFactors === 0) return 0;
  return rows.filter((cells) =>
    cells.slice(0, nFactors).some((c) => c.trim() !== ""),
  ).length;
}
