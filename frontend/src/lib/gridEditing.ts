/** Pure, framework-free helpers for the editable runs grid.
 *
 * Extracted from the React component so the paste-parsing and value-validation
 * logic is unit-testable in isolation (no DOM, no server). Mirrors the backend
 * ``parse_response_value`` rules: ``.``/``,`` decimals, empty = "cleared".
 */

export type CellStatus = "empty" | "valid" | "invalid";

/** Classify one raw response cell the same way the backend would parse it. */
export function classifyCell(raw: string): CellStatus {
  const text = raw.trim();
  if (text === "") return "empty";
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) ? "valid" : "invalid";
}

/** Format a persisted response value for display in an input. */
export function formatServerValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * Parse a clipboard blob copied from a spreadsheet into a matrix of strings.
 *
 * Rows split on CRLF/CR/LF, columns on tab (Excel/Sheets TSV). A single
 * trailing empty line (common when copying a block) is dropped.
 */
export function parseClipboardMatrix(text: string): string[][] {
  if (text === "") return [];
  const rows = text.replace(/\r\n?/g, "\n").split("\n");
  if (rows.length > 1 && rows[rows.length - 1] === "") rows.pop();
  return rows.map((row) => row.split("\t"));
}
