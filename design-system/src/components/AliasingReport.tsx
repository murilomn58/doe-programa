/**
 * Presentational card: resolution badge + defining relation + alias list of a
 * fractional 2^(k-p) design. All strings come ready from the backend.
 */

export interface AliasingReportProps {
  resolution: number | null;
  aliasing: string[];
}

function toRoman(resolution: number): string {
  switch (resolution) {
    case 3:
      return "III";
    case 4:
      return "IV";
    case 5:
      return "V";
    case 6:
      return "VI";
    default:
      return String(resolution);
  }
}

function resolutionStyle(resolution: number): {
  badge: string;
  note: string;
} {
  if (resolution <= 3) {
    return {
      badge: "border-warning-strong/40 bg-warning-strong/10 text-warning",
      note: "Triagem: efeitos principais confundidos com interações de 2 fatores.",
    };
  }
  if (resolution === 4) {
    return {
      badge: "border-accent-strong/40 bg-accent-strong/10 text-accent-mid",
      note: "Efeitos principais livres de interações de 2 fatores.",
    };
  }
  return {
    badge: "border-significant-strong/40 bg-significant-strong/10 text-significant",
    note: "Efeitos principais e interações de 2 fatores livres entre si.",
  };
}

export function AliasingReport({ resolution, aliasing }: AliasingReportProps) {
  const first = aliasing[0];
  const definingRelation =
    first !== undefined && first.startsWith("I ") ? first : null;
  const aliases = definingRelation !== null ? aliasing.slice(1) : aliasing;
  const style = resolution !== null ? resolutionStyle(resolution) : null;

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-6 shadow-lg">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-medium text-foreground">
          Estrutura de confundimento
        </h2>
        {resolution !== null && style !== null ? (
          <span
            className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${style.badge}`}
          >
            Resolução {toRoman(resolution)}
          </span>
        ) : null}
      </div>
      {style !== null ? (
        <p className="mb-4 text-xs text-muted">{style.note}</p>
      ) : (
        <div className="mb-4" />
      )}

      {definingRelation !== null ? (
        <p className="mb-4 rounded-md border border-accent-strong/30 bg-accent-strong/5 px-3 py-2 font-mono text-sm text-accent">
          {definingRelation}
        </p>
      ) : null}

      {aliases.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {aliases.map((alias) => (
            <li
              key={alias}
              className="rounded-md bg-surface-0 px-3 py-1.5 font-mono text-sm text-foreground"
            >
              {alias}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-xs text-faint">
        Efeitos confundidos (aliased) compartilham a mesma coluna na matriz e
        não podem ser estimados separadamente — o efeito reportado é a soma dos
        efeitos confundidos.
      </p>
    </div>
  );
}
