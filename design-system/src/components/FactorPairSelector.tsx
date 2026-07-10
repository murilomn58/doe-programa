/** Presentational: dropdown to select which factor pair drives surface/contour. */

export interface FactorPairSelectorProps {
  pairs: string[][];
  selected: string[] | null;
  onSelect: (pair: [string, string]) => void;
}

export function FactorPairSelector({
  pairs,
  selected,
  onSelect,
}: FactorPairSelectorProps) {
  if (pairs.length <= 1) return null;

  const value = selected ? selected.join("|") : (pairs[0]?.join("|") ?? "");

  return (
    <select
      value={value}
      onChange={(e) => {
        const parts = e.target.value.split("|");
        if (parts.length === 2) {
          onSelect([parts[0], parts[1]]);
        }
      }}
      className="rounded border border-border-strong bg-surface-2 px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent-mid"
    >
      {pairs.map((p) => (
        <option key={p.join("|")} value={p.join("|")}>
          {p[0]} × {p[1]}
        </option>
      ))}
    </select>
  );
}
