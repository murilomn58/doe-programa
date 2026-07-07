/** Small numeric formatters for the scientific tables. */

/** Fixed-decimal display; renders an em dash for null/undefined/NaN. */
export function fmt(value: number | null | undefined, digits = 5): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

/** Compact p-value: "< 0.0001" for tiny values, else 4 decimals. */
export function fmtP(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value < 0.0001) return "< 0.0001";
  return value.toFixed(4);
}
