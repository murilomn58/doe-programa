import { StatsPanel } from "doe-design-system";

/**
 * Preview do StatsPanel — painel de qualidade de ajuste do modelo.
 * Números do golden test da aula (fatorial 2² com 2 réplicas, 8 ensaios):
 * fatores "% Fibra" (0 / 1.5) e "% Cimento" (4 / 7),
 * resposta "Módulo de Resiliência (MPa)".
 */

const ajusteCompleto = {
  n_obs: 8,
  df_resid: 5,
  r_squared: 0.86692,
  adj_r_squared: 0.81369,
  rmse: 1.26921,
  sse: 8.05475,
  total_ss: 60.52557,
  press: 20.61956,
  predicted_r_squared: 0.65932,
};

const ajusteSemPress = {
  n_obs: 4,
  df_resid: 0,
  r_squared: 1.0,
  adj_r_squared: 1.0,
  rmse: 0.0,
  sse: 0.0,
  total_ss: 59.67792,
  press: null,
  predicted_r_squared: null,
};

const lenthSaturado = {
  pse: 0.54938,
  me: 2.02674,
  sme: 4.86341,
  alpha: 0.05,
};

/** Canônico: modelo linear ajustado ao Módulo de Resiliência (MPa) com réplicas. */
export function AjusteCompleto() {
  return (
    <div className="bg-surface-0 p-6">
      <p className="mb-3 text-sm text-muted">
        Resposta: Módulo de Resiliência (MPa) — fatores % Fibra e % Cimento
      </p>
      <StatsPanel stats={ajusteCompleto} lenth={null} />
    </div>
  );
}

/** Design saturado (sem réplicas): PRESS e R² previsto indisponíveis (—). */
export function SaturadoSemPress() {
  return (
    <div className="bg-surface-0 p-6">
      <p className="mb-3 text-sm text-muted">
        Fatorial 2² sem réplicas — sem graus de liberdade para o erro
      </p>
      <StatsPanel stats={ajusteSemPress} lenth={null} />
    </div>
  );
}

/** Apenas margens de Lenth (triagem saturada, sem estatísticas de ajuste). */
export function SomenteLenth() {
  return (
    <div className="bg-surface-0 p-6">
      <p className="mb-3 text-sm text-muted">
        Triagem saturada — significância dos efeitos pelo método de Lenth (α = 0,05)
      </p>
      <StatsPanel stats={null} lenth={lenthSaturado} />
    </div>
  );
}

/** Composição realista: estatísticas de ajuste + margens de Lenth no mesmo painel. */
export function AjusteComLenth() {
  return (
    <div className="grid gap-4 bg-surface-0 p-6">
      <h2 className="text-base font-medium text-foreground">
        Análise — Módulo de Resiliência (MPa)
      </h2>
      <StatsPanel stats={ajusteCompleto} lenth={lenthSaturado} />
    </div>
  );
}
