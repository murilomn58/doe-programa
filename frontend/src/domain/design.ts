/** Domain types for design generation (mirror the backend Pydantic schemas). */

export type FactorType = "quantitative" | "qualitative";
export type DesignType = "full_factorial_2k";

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
  run_order: number;
  std_order: number;
  point_type: number;
  block: number;
  replicate: number;
  factors: Record<string, RunCellRead>;
}

export interface GeneratedDesign {
  experiment_id: number;
  design_type: DesignType;
  n_runs: number;
  factors: FactorRead[];
  responses: ResponseRead[];
  runs: RunRead[];
}
