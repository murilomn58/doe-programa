/** Presentational: explicit non-estimability / saturated notices. */

export interface EstimabilityWarningProps {
  warnings: string[];
  tone?: "error" | "warn";
}

export function EstimabilityWarning({
  warnings,
  tone = "error",
}: EstimabilityWarningProps) {
  if (warnings.length === 0) return null;
  const color =
    tone === "error"
      ? "border-danger-border bg-danger-surface/40 text-danger-soft"
      : "border-warning-border bg-warning-surface/30 text-warning-soft";
  return (
    <div className={`rounded-xl border p-4 text-sm ${color}`} role="alert">
      <p className="mb-1 font-semibold">
        {tone === "error"
          ? "Modelo não estimável neste planejamento"
          : "Aviso"}
      </p>
      <ul className="list-disc space-y-1 pl-5">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
