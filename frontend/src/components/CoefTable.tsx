/** Presentational: regression coefficients (coded + natural units, with VIF). */

import type { CoefRow } from "@/domain/analysis";
import { fmt, fmtP } from "@/lib/formatters";

interface CoefTableProps {
  coefficients: CoefRow[];
  saturated: boolean;
}

const th =
  "border-b border-slate-700 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-400";
const thL = `${th} text-left`;
const td = "border-b border-slate-800 px-3 py-2 text-right font-mono text-sm text-slate-200";
const tdL = `${td} text-left`;

export function CoefTable({ coefficients, saturated }: CoefTableProps) {
  if (coefficients.length === 0) return null;
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
      <h3 className="mb-3 text-base font-medium text-slate-200">
        Coeficientes de Regressão
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={thL}>Termo</th>
              <th className={th}>Coef. codificado</th>
              <th className={th}>Coef. natural</th>
              {saturated ? null : (
                <>
                  <th className={th}>Std.Err</th>
                  <th className={th}>t</th>
                  <th className={th}>p</th>
                  <th className={th}>VIF</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {coefficients.map((c) => (
              <tr key={c.term} className="hover:bg-slate-900/40">
                <td className={`${tdL} text-cyan-300`}>{c.term}</td>
                <td className={td}>{fmt(c.coef_coded, 5)}</td>
                <td className={td}>{fmt(c.coef_natural, 5)}</td>
                {saturated ? null : (
                  <>
                    <td className={td}>{fmt(c.std_err, 5)}</td>
                    <td className={td}>{fmt(c.t, 4)}</td>
                    <td className={td}>{fmtP(c.p)}</td>
                    <td className={td}>{fmt(c.vif, 2)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
