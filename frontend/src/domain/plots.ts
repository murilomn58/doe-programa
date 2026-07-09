/** Domain types for the interactive plots (mirror the backend PlotsRead). */

import type { RSMModel } from "@/domain/analysis";

export interface SurfaceData {
  factor_x: string;
  factor_y: string;
  x: number[];
  y: number[];
  z: (number | null)[][];
  /** Coordenadas NATURAIS dos ensaios observados no par de fatores exibido. */
  points_x: number[];
  points_y: number[];
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

/** Cubo 2^3: 8 cantos ±1 (na ordem dos 3 fatores) + valor da resposta no canto. */
export interface CubeData {
  factors: string[];
  corner_coded: number[][];
  corner_values: (number | null)[];
}

/** Half-normal: |efeitos| ordenados ASC vs quantis teóricos; termos ativos rotulados. */
export interface HalfNormalData {
  terms: string[];
  abs_effects: (number | null)[];
  theoretical: (number | null)[];
  labels_significant: string[];
}

/** Diagnóstico de influência: leverage/Cook/resíduo studentizado por run. */
export interface InfluenceData {
  run_order: number[];
  leverage: (number | null)[];
  cook: (number | null)[];
  std_resid: (number | null)[];
  threshold_leverage: number | null;
  threshold_cook: number | null;
}

/** Overlay de desejabilidade (grid NxN em [0,1]); null no path single-response. */
export interface DesirabilityData {
  factor_x: string;
  factor_y: string;
  x: number[];
  y: number[];
  d: (number | null)[][];
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
  /** Diagnósticos avançados (issue 10) — todos opcionais, default null. */
  cube: CubeData | null;
  half_normal: HalfNormalData | null;
  influence: InfluenceData | null;
  residual_vs_order: ScatterData | null;
  desirability: DesirabilityData | null;
}

/** Uma fatia 1-D do profiler: um fator variando -1..1 com os demais fixos. */
export interface ProfilerSlice {
  factor: string;
  coded: number[];
  predicted: (number | null)[];
  ci_low: (number | null)[];
  ci_high: (number | null)[];
}

/** Ótimo do profiler no cubo codificado. */
export interface ProfilerOptimum {
  point: Record<string, number>;
  value: number | null;
}

/** Resultado do POST /analysis/profiler: predição no ponto + fatias + ótimo. */
export interface ProfilerResult {
  prediction: number | null;
  ci_low: number | null;
  ci_high: number | null;
  slices: ProfilerSlice[];
  optimum: ProfilerOptimum;
}

/** Body do POST /analysis/profiler. */
export interface ProfilerRequest {
  experiment_id: number;
  response_name: string;
  model: RSMModel;
  /** Coordenadas CODED por fator em [-1,1]; fatores omitidos = centro (0). */
  point: Record<string, number>;
  maximize?: boolean;
}
