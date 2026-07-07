/** Presentational: ANOVA table (SS/df/MS/F/p) with Pure Error / LOF / Total. */

import type { AnovaRow } from "@/domain/analysis";
import { fmt, fmtP } from "@/lib/formatters";

interface AnovaTableProps {
  rows: AnovaRow[];
  pureError: AnovaRow | null;
  lackOfFit: AnovaRow | null;
  total: AnovaRow | null;
  rSquared: number | null;
  adjRSquared: number | null;
  msPureError: number | null;
}

const th =
  "border-b border-slate-700 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-400";
const thL = `${th} text-left`;
const td = "border-b border-slate-800 px-3 py-2 text-right font-mono text-sm text-slate-200";
const tdL = `${td} text-left`;

function Row({ row, muted }: { row: AnovaRow; muted?: boolean }) {
  const sig = row.p !== null && row.p < 0.05;
  return (
    <tr className={muted ? "text-slate-400" : "hover:bg-slate-900/40"}>
      <td className={`${tdL} ${muted ? "" : "text-cyan-300"}`}>{row.source}</td>
      <td className={td}>{fmt(row.ss, 4)}</td>
      <td className={td}>{row.df}</td>
      <td className={td}>{fmt(row.ms, 4)}</td>
      <td className={td}>{fmt(row.f, 4)}</td>
      <td className={`${td} ${sig ? "font-semibold text-emerald-400" : ""}`}>
        {fmtP(row.p)}
      </td>
    </tr>
  );
}

export function AnovaTable({
  rows,
  pureError,
  lackOfFit,
  total,
  rSquared,
  adjRSquared,
  msPureError,
}: AnovaTableProps) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-medium text-slate-200">ANOVA</h3>
        <div className="flex flex-wrap gap-4 font-mono text-xs text-slate-400">
          <span>
            R² = <span className="text-cyan-300">{fmt(rSquared, 5)}</span>
          </span>
          <span>
            R²aj = <span className="text-cyan-300">{fmt(adjRSquared, 5)}</span>
          </span>
          {msPureError !== null ? (
            <span>
              MS Erro Puro ={" "}
              <span className="text-cyan-300">{fmt(msPureError, 5)}</span>
            </span>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={thL}>Fonte</th>
              <th className={th}>SS</th>
              <th className={th}>df</th>
              <th className={th}>MS</th>
              <th className={th}>F</th>
              <th className={th}>p</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Row key={row.source} row={row} />
            ))}
            {lackOfFit ? <Row row={lackOfFit} muted /> : null}
            {pureError ? <Row row={pureError} muted /> : null}
            {total ? <Row row={total} muted /> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
