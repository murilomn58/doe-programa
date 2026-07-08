/** Domain types for the interactive plots (mirror the backend PlotsRead). */

export interface SurfaceData {
  factor_x: string;
  factor_y: string;
  x: number[];
  y: number[];
  z: (number | null)[][];
}

export interface ParetoData {
  terms: string[];
  std_effects: number[];
  sig_line: number;
  alpha: number;
}

export interface MainEffectData {
  factor: string;
  level_labels: string[];
  levels: number[];
  means: (number | null)[];
}

export interface InteractionLine {
  level_label: string;
  x: number[];
  y: (number | null)[];
  ci_low: (number | null)[];
  ci_high: (number | null)[];
}

export interface InteractionData {
  factor_x: string;
  factor_group: string;
  x_levels: number[];
  x_labels: string[];
  lines: InteractionLine[];
}

export interface ObsVsPredData {
  observed: number[];
  predicted: number[];
  line_min: number;
  line_max: number;
  r_squared: number | null;
}

export interface ScatterData {
  x: number[];
  y: number[];
}

export interface QQData {
  theoretical: number[];
  sample: number[];
  line_slope: number;
  line_intercept: number;
}

export interface PlotsData {
  factor_pairs: string[][];
  selected_pair: string[] | null;
  grand_mean: number;
  surface: SurfaceData | null;
  contour: SurfaceData | null;
  pareto: ParetoData | null;
  main_effects: MainEffectData[];
  interaction: InteractionData | null;
  obs_vs_pred: ObsVsPredData | null;
  residual_vs_fitted: ScatterData | null;
  qq: QQData | null;
}
