/** Domain types for design generation (mirror the backend Pydantic schemas). */

export type FactorType = "quantitative" | "qualitative";
export type DesignType =
  | "full_factorial_2k"
  | "fractional_factorial_2kp"
  | "central_composite"
  | "box_behnken";

export type CCDVariant = "rotatable" | "orthogonal" | "face_centered";

/** Fração 2^(k-p): exatamente UM entre `generators` e `resolution`. */
export interface FractionalConfig {
  /** String de geradores no formato pyDOE3, ex.: "a b ab". */
  generators?: string;
  /** Resolução desejada (3..6); o backend escolhe a menor fração. */
  resolution?: number;
}

export interface CCDConfig {
  variant: CCDVariant;
  /** Pontos centrais no bloco fatorial (cubo). */
  center_factorial: number;
  /** Pontos centrais no bloco axial (estrela). */
  center_axial: number;
}

/** A factor as described in the setup wizard (request side). */
export interface FactorInput {
  name: string;
  factor_type: FactorType;
  unit?: string;
  low?: number;
  high?: number;
  low_label?: string;
  high_label?: string;
}

export interface ResponseInput {
  name: string;
  unit?: string;
}

export interface DesignGenerateRequest {
  name?: string;
  experiment_id?: number;
  design_type?: DesignType;
  replicates: number;
  factors: FactorInput[];
  responses: ResponseInput[];
  seed?: number;
  /** Somente fracionado 2^(k-p). */
  fractional?: FractionalConfig;
  /** Somente composto central. */
  ccd?: CCDConfig;
  /** Pontos centrais do Box-Behnken (default 3 no backend). */
  bbd_center?: number;
  /** Pontos centrais para 2^k e fracionado (default 0 no backend). */
  center_points?: number;
}

/** The persisted ±1 map of a factor (response side). */
export interface LevelRead {
  coded_value: number;
  natural_value: number | null;
  label: string | null;
}

export interface FactorRead {
  id: number | null;
  name: string;
  factor_type: FactorType;
  unit: string | null;
  position: number;
  levels: LevelRead[];
}

export interface ResponseRead {
  id: number | null;
  name: string;
  unit: string | null;
  position: number;
}

export interface RunCellRead {
  coded: number;
  natural: number | null;
  label: string | null;
}

export interface RunRead {
  id: number | null;
  run_order: number;
  std_order: number;
  point_type: number;
  block: number;
  replicate: number;
  factors: Record<string, RunCellRead>;
  /** Measured response values keyed by response name; empty until entered. */
  response_values: Record<string, number | null>;
}

export interface GeneratedDesign {
  experiment_id: number;
  design_type: DesignType;
  n_runs: number;
  factors: FactorRead[];
  responses: ResponseRead[];
  runs: RunRead[];
  /** Somente fracionado 2^(k-p); null nas demais famílias. */
  resolution?: number | null;
  /** Relação de definição + aliases ("I = ABC", "A = BC", …); null fora do fracionado. */
  aliasing?: string[] | null;
}

/** The persisted matrix + response values for the editable data-entry grid. */
export interface RunsRead {
  experiment_id: number;
  n_runs: number;
  factors: FactorRead[];
  responses: ResponseRead[];
  runs: RunRead[];
}

/** One response cell to persist (raw text — the backend parses/validates it). */
export interface ResponseValueUpsert {
  run_id: number;
  response_name: string;
  value: string | null;
}

export interface ResponsesUpsertRequest {
  values: ResponseValueUpsert[];
}
