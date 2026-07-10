/** Presentational: goodness-of-fit panel (R²/R²aj/R²previsto/PRESS/RMSE/df). */

import { fmt } from "../lib/formatters";

/** Goodness-of-fit statistics of the fitted model. */
export interface StatsPanelData {
  n_obs: number;
  df_resid: number;
  r_squared: number;
  adj_r_squared: number;
  rmse: number;
  sse: number;
  total_ss: number;
  press: number | null;
  predicted_r_squared: number | null;
}

/** Lenth's method margins for saturated designs. */
export interface LenthData {
  pse: number;
  me: number;
  sme: number;
  alpha: number;
}

export interface StatsPanelProps {
  stats: StatsPanelData | null;
  lenth: LenthData | null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-0/50 px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-lg text-accent">{value}</dd>
    </div>
  );
}

export function StatsPanel({ stats, lenth }: StatsPanelProps) {
  if (!stats && !lenth) return null;
  return (
    <section className="rounded-xl border border-border bg-surface-1 p-6 shadow-lg">
      <h3 className="mb-3 text-base font-medium text-foreground">Estatísticas</h3>
      {stats ? (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="R²" value={fmt(stats.r_squared, 5)} />
          <Stat label="R² ajustado" value={fmt(stats.adj_r_squared, 5)} />
          <Stat label="R² previsto" value={fmt(stats.predicted_r_squared, 5)} />
          <Stat label="PRESS" value={fmt(stats.press, 5)} />
          <Stat label="RMSE" value={fmt(stats.rmse, 5)} />
          <Stat label="SS Residual" value={fmt(stats.sse, 4)} />
          <Stat label="df (erro)" value={String(stats.df_resid)} />
          <Stat label="Nº ensaios" value={String(stats.n_obs)} />
        </dl>
      ) : null}
      {lenth ? (
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="PSE (Lenth)" value={fmt(lenth.pse, 4)} />
          <Stat label="Margem ME" value={fmt(lenth.me, 4)} />
          <Stat label="Margem SME" value={fmt(lenth.sme, 4)} />
        </dl>
      ) : null}
    </section>
  );
}
