/** Presentational: regression coefficients (coded + natural units, with VIF). */

import { fmt, fmtP } from "../lib/formatters";

/** One row of the regression coefficients table. */
export interface CoefRow {
  term: string;
  coef_coded: number;
  coef_natural: number | null;
  std_err: number | null;
  t: number | null;
  p: number | null;
  ci_low: number | null;
  ci_high: number | null;
  vif: number | null;
}

export interface CoefTableProps {
  coefficients: CoefRow[];
  saturated: boolean;
}

const th =
  "border-b border-border px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted";
const thL = `${th} text-left`;
const td = "border-b border-border-subtle px-3 py-2 text-right font-mono text-sm text-foreground";
const tdL = `${td} text-left`;

export function CoefTable({ coefficients, saturated }: CoefTableProps) {
  if (coefficients.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-surface-1 p-6 shadow-lg">
      <h3 className="mb-3 text-base font-medium text-foreground">
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
              <tr key={c.term} className="hover:bg-surface-0/40">
                <td className={`${tdL} text-accent`}>{c.term}</td>
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
