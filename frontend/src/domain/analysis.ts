/** Domain types for the analysis engine (mirror the backend Pydantic schemas). */

import type { PlotsData } from "@/domain/plots";

export type RSMModel =
  | "linear"
  | "linear_quadratic"
  | "linear_interactions"
  | "full";

export interface AnalysisRequest {
  experiment_id: number;
  response_name: string;
  model: RSMModel;
  /** Which pair of quantitative factors drives surface/contour/interaction. */
  factor_x?: string | null;
  factor_y?: string | null;
}

export interface TermRead {
  label: string;
  kind: "main" | "interaction" | "quadratic";
}

export interface AnovaRow {
  source: string;
  ss: number;
  df: number;
  ms: number | null;
  f: number | null;
  p: number | null;
}

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

export interface LenthData {
  pse: number;
  me: number;
  sme: number;
  alpha: number;
}

export interface AnalysisResult {
  response_name: string;
  model: RSMModel;
  estimable: boolean;
  saturated: boolean;
  warnings: string[];
  sign_maps: Record<string, Record<string, string>>;
  terms: TermRead[];
  anova: AnovaRow[];
  pure_error: AnovaRow | null;
  lack_of_fit: AnovaRow | null;
  total: AnovaRow | null;
  effects: EffectRow[];
  coefficients: CoefRow[];
  stats: StatsPanelData | null;
  lenth: LenthData | null;
  r_squared: number | null;
  adj_r_squared: number | null;
  ms_pure_error: number | null;
  plots: PlotsData | null;
}

/** The four class RSM models, ordered for the ModelBuilder. */
export const RSM_MODELS: { value: RSMModel; label: string; hint: string }[] = [
  { value: "linear", label: "Linear", hint: "Somente efeitos principais" },
  {
    value: "linear_interactions",
    label: "Linear + Interações",
    hint: "Efeitos principais + interações de 2 fatores",
  },
  {
    value: "linear_quadratic",
    label: "Linear + Quadrático",
    hint: "Efeitos principais + termos quadráticos (exige CCD/Box-Behnken)",
  },
  {
    value: "full",
    label: "Completo",
    hint: "Principais + interações + quadráticos",
  },
];
