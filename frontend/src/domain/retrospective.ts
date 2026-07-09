/** Domain types for retrospective design detection (mirror backend schemas). */

/** How the user marks a factor column ("auto" lets the backend infer). */
export type FactorScale = "auto" | "quantitative" | "qualitative";

/** Geometric classification of a parsed run in coded space. */
export type RunClass = "factorial" | "center" | "axial" | "edge" | "other";

/** Status of a design-family hypothesis scored against the data. */
export type DesignMatchStatus = "complete" | "partial" | "irregular";

/** Estimability verdict of one RSM model on the pasted data. */
export type ModelStatus =
  | "estimable"
  | "saturated"
  | "not_estimable"
  | "no_data";

// --- request side ------------------------------------------------------------

export interface RetroFactorSpec {
  name: string;
  factor_type: FactorScale;
  unit?: string | null;
}

export interface RetroResponseSpec {
  name: string;
  unit?: string | null;
}

export interface RetroRow {
  /** Raw cell text keyed by column name (backend parses ','/'.' decimals). */
  factors: Record<string, string>;
  responses: Record<string, string>;
}

export interface RetroDiagnoseRequest {
  factors: RetroFactorSpec[];
  responses: RetroResponseSpec[];
  rows: RetroRow[];
  response_name?: string | null;
}

export interface RetroMaterializeRequest {
  name: string;
  description?: string | null;
  factors: RetroFactorSpec[];
  responses: RetroResponseSpec[];
  rows: RetroRow[];
  response_name?: string | null;
  /** Extra runs (natural values/labels) to append without responses. */
  append_runs?: Record<string, number | string>[] | null;
}

// --- response side -----------------------------------------------------------

export interface RowIssue {
  row: number;
  message: string;
}

export interface FactorScaleRead {
  name: string;
  factor_type: string;
  low: number | null;
  high: number | null;
  center: number | null;
  n_levels: number;
  distinct_levels?: number[] | null;
  labels?: string[] | null;
  alpha?: number | null;
  is_constant: boolean;
  warnings: string[];
}

export interface RunClassRead {
  row: number;
  point_type: RunClass;
  coded: Record<string, number>;
  replicate_group: number;
}

export interface DesignMatchRead {
  design_type: string;
  variant?: string | null;
  status: DesignMatchStatus;
  detail: string;
  match_pct: number;
  resolution?: number | null;
  defining_relation?: string | null;
  aliasing?: string[] | null;
  missing_runs: Record<string, number | string | null>[];
  n_matched: number;
  n_expected: number;
}

export interface ReplicateInfoRead {
  n_points_replicated: number;
  runs_per_point_max: number;
  df_pure_error: number;
}

export interface ModelAssessmentRead {
  model: string;
  status: ModelStatus;
  n_params?: number | null;
  rank?: number | null;
  df_resid?: number | null;
  reason?: string | null;
}

export interface CompletionRead {
  target: string;
  variant?: string | null;
  title: string;
  runs_to_add: Record<string, number | string>[];
  n_runs_to_add: number;
  enables: string[];
  rationale: string;
}

export interface RetroDiagnoseResponse {
  n_rows: number;
  n_rows_valid: number;
  row_issues: RowIssue[];
  factors: FactorScaleRead[];
  runs: RunClassRead[];
  replicates: ReplicateInfoRead;
  design_matches: DesignMatchRead[];
  best_design?: string | null;
  models: ModelAssessmentRead[];
  best_model?: string | null;
  response_used?: string | null;
  completions: CompletionRead[];
}

export interface RetroMaterializeResult {
  experiment_id: number;
  design_type: string;
  n_runs: number;
  excluded_constant_factors: string[];
  warnings: string[];
}
