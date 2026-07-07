/** Presentational: explicit non-estimability / saturated notices. */

interface EstimabilityWarningProps {
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
      ? "border-red-800 bg-red-950/40 text-red-300"
      : "border-amber-800 bg-amber-950/30 text-amber-300";
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
