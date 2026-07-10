/** Presentational: factorial effects (Effect/Std.Err/t/p/IC95%/coded coef). */

import { fmt, fmtP } from "../lib/formatters";

/** One row of the factorial effects estimate table (mirrors the backend schema). */
export interface EffectRow {
  term: string;
  effect: number;
  coef_coded: number;
  std_err: number | null;
  t: number | null;
  p: number | null;
  ci_low: number | null;
  ci_high: number | null;
  pseudo_t: number | null;
  significant: boolean | null;
}

export interface EffectsTableProps {
  effects: EffectRow[];
  saturated: boolean;
}

const th =
  "border-b border-border px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted";
const thL = `${th} text-left`;
const td = "border-b border-border-subtle px-3 py-2 text-right font-mono text-sm text-foreground";
const tdL = `${td} text-left`;

export function EffectsTable({ effects, saturated }: EffectsTableProps) {
  if (effects.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-surface-1 p-6 shadow-lg">
      <h3 className="mb-3 text-base font-medium text-foreground">
        Estimativa dos Efeitos
        {saturated ? (
          <span className="ml-2 text-xs font-normal text-warning">
            (saturado — significância via PSE de Lenth)
          </span>
        ) : null}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={thL}>Termo</th>
              <th className={th}>Efeito</th>
              <th className={th}>Coef. cod.</th>
              {saturated ? (
                <th className={th}>Pseudo-t</th>
              ) : (
                <>
                  <th className={th}>Std.Err</th>
                  <th className={th}>t</th>
                  <th className={th}>p</th>
                  <th className={th}>IC95%</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {effects.map((e) => {
              const sig = saturated
                ? e.significant === true
                : e.p !== null && e.p < 0.05;
              return (
                <tr key={e.term} className="hover:bg-surface-0/40">
                  <td className={`${tdL} text-accent`}>{e.term}</td>
                  <td className={`${td} ${sig ? "font-semibold text-significant" : ""}`}>
                    {fmt(e.effect, 5)}
                  </td>
                  <td className={td}>{fmt(e.coef_coded, 5)}</td>
                  {saturated ? (
                    <td className={td}>{fmt(e.pseudo_t, 3)}</td>
                  ) : (
                    <>
                      <td className={td}>{fmt(e.std_err, 5)}</td>
                      <td className={td}>{fmt(e.t, 4)}</td>
                      <td className={`${td} ${sig ? "font-semibold text-significant" : ""}`}>
                        {fmtP(e.p)}
                      </td>
                      <td className={td}>
                        [{fmt(e.ci_low, 3)}, {fmt(e.ci_high, 3)}]
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
