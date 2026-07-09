"use client";

/**
 * Presentational card: resolution badge + defining relation + alias list of a
 * fractional 2^(k-p) design. All strings come ready from the backend.
 */

interface AliasingReportProps {
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
      badge: "border-amber-500/40 bg-amber-500/10 text-amber-400",
      note: "Triagem: efeitos principais confundidos com interações de 2 fatores.",
    };
  }
  if (resolution === 4) {
    return {
      badge: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
      note: "Efeitos principais livres de interações de 2 fatores.",
    };
  }
  return {
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
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
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-medium text-slate-200">
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
        <p className="mb-4 text-xs text-slate-400">{style.note}</p>
      ) : (
        <div className="mb-4" />
      )}

      {definingRelation !== null ? (
        <p className="mb-4 rounded-md border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 font-mono text-sm text-cyan-300">
          {definingRelation}
        </p>
      ) : null}

      {aliases.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {aliases.map((alias) => (
            <li
              key={alias}
              className="rounded-md bg-slate-900 px-3 py-1.5 font-mono text-sm text-slate-200"
            >
              {alias}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-xs text-slate-500">
        Efeitos confundidos (aliased) compartilham a mesma coluna na matriz e
        não podem ser estimados separadamente — o efeito reportado é a soma dos
        efeitos confundidos.
      </p>
    </div>
  );
}
