/** Domain types for design generation (mirror the backend Pydantic schemas). */

export type FactorType = "quantitative" | "qualitative";
export type DesignType =
  | "full_factorial_2k"
  | "fractional_factorial_2kp"
  | "central_composite"
  | "box_behnken"
  | "taguchi"
  | "plackett_burman"
  | "optimal"
  | "dsd"
  | "full_factorial_general";

export type CCDVariant = "rotatable" | "orthogonal" | "face_centered";

/** Objetivo da razão sinal/ruído (S/N) do Taguchi. */
export type SNObjective =
  | "larger_is_better"
  | "smaller_is_better"
  | "nominal_is_best";

/** Critério de otimalidade do planejamento D/I-ótimo. */
export type OptimalCriterion = "D" | "I";

/** Conjunto de termos do modelo RSM (usado pelo alvo do D/I-ótimo). */
export type RSMModel =
  | "linear"
  | "linear_quadratic"
  | "linear_interactions"
  | "full";

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

/** Taguchi: arranjo ortogonal + objetivo S/N. */
export interface TaguchiConfig {
  /** Nome do arranjo do catálogo (ex.: "L8(2^7)" ou "L8"); null → auto. */
  array_name?: string;
  sn_objective: SNObjective;
}

/** D/I-ótimo: critério + tamanho do design + modelo alvo. */
export interface OptimalConfig {
  criterion: OptimalCriterion;
  /** Nº de ensaios pedido (>= nº de parâmetros do modelo). */
  n_runs: number;
  /** Conjunto de termos que o design otimiza (default backend: interações). */
  model?: RSMModel;
  /** Resolução da grade de candidatos (2..5); default backend: 3. */
  n_levels?: number;
}

/** DSD (Definitive Screening Design). */
export interface DSDConfig {
  /** Corridas extras (n_fake_factors → +2 cada); default 0. */
  add_extra_runs?: number;
}

/** A factor as described in the setup wizard (request side). */
/**
 * Papel de uma entrada declarada no passo de fatores.
 *
 * Uma entrada marcada como `bloco` NÃO é um fator: ela sai da lista enviada ao
 * motor e vira a estrutura de blocagem (`blocks`, `block_labels`, `block_name`
 * no pedido). Existe porque o pesquisador declara "tipo de solo" uma vez, e só
 * depois decide se aquilo é objeto de estudo (fator, no máximo 2 categorias) ou
 * fonte de variação conhecida que ele quer tirar do erro (bloco, sem limite).
 */
export type PapelDeclarado = "fator" | "bloco";

export interface FactorInput {
  name: string;
  factor_type: FactorType;
  unit?: string;
  low?: number;
  high?: number;
  low_label?: string;
  high_label?: string;
  /** Fatores Taguchi de 3+ níveis: lista ordenada de valores; null → par baixo/alto. */
  levels?: number[];
  /** Ausente equivale a `"fator"`. Campo de interface: nunca chega ao motor. */
  papel?: PapelDeclarado;
  /** Nomes dos blocos, um por bloco, quando `papel === "bloco"`. Mínimo 2. */
  categorias?: string[];
}

/** A entrada declarada como bloco, se houver. Só uma é considerada. */
export function blocoDeclarado(entradas: FactorInput[]): FactorInput | undefined {
  return entradas.find((f) => f.papel === "bloco");
}

/** As entradas que são fator de verdade, isto é, o que vai ao motor. */
export function apenasFatores(entradas: FactorInput[]): FactorInput[] {
  return entradas.filter((f) => f.papel !== "bloco");
}

/** Quantos blocos as entradas declaram. Sem bloco declarado, 1. */
export function nBlocos(entradas: FactorInput[]): number {
  const bloco = blocoDeclarado(entradas);
  const nomes = bloco?.categorias?.filter((c) => c.trim()) ?? [];
  return nomes.length >= 2 ? nomes.length : 1;
}

/** Quantos níveis o fator declara. Sem `levels`, são os dois extremos. */
export function nNiveis(f: FactorInput): number {
  return f.levels?.length ?? 2;
}

/** Níveis igualmente espaçados entre low e high, incluindo os extremos. */
export function niveisEquiespacados(low: number, high: number, n: number): number[] {
  if (n <= 2) return [low, high];
  const passo = (high - low) / (n - 1);
  return Array.from({ length: n }, (_, i) => low + i * passo);
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
  /**
   * Nº de blocos: repetições completas do arranjo sob uma condição conhecida
   * diferente (lote de material, dia de moldagem, tipo de solo), separada do
   * que o estudo investiga. Total de ensaios = base × blocks × replicates.
   * Default backend 1 (comportamento anterior: um único bloco).
   */
  blocks?: number;
  /**
   * Nome de cada bloco, na ordem (bloco 1 é o primeiro). Quando presente, tem
   * exatamente `blocks` itens. É o que permite ler "Laterita" na matriz em vez
   * de "3", e sem isso a correspondência entre número e condição real fica
   * fora da plataforma, na memória do pesquisador.
   */
  block_labels?: string[];
  /** Nome do agrupamento, ex. "Tipo de solo". Rotula a linha da ANOVA. */
  block_name?: string;
  factors: FactorInput[];
  responses: ResponseInput[];
  seed?: number;
  /** Somente fracionado 2^(k-p). */
  fractional?: FractionalConfig;
  /** Somente composto central. */
  ccd?: CCDConfig;
  /** Somente Taguchi. */
  taguchi?: TaguchiConfig;
  /** Somente D/I-ótimo. */
  optimal?: OptimalConfig;
  /** Somente DSD. */
  dsd?: DSDConfig;
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
  /** Somente Taguchi/ótimo: nome do arranjo escolhido; null nas demais. */
  array_name?: string | null;
  /** Somente D/I-ótimo: D-eficiência do design gerado; null nas demais. */
  optimal_efficiency?: number | null;
}

/** One orthogonal array of the Taguchi catalog (GET /designs/taguchi-catalog). */
export interface TaguchiArray {
  /** Nome do catálogo pyDOE3, ex.: "L8(2^7)". */
  name: string;
  /** Nº de ensaios (linhas). */
  runs: number;
  /** Total de colunas disponíveis para alocar fatores. */
  n_columns: number;
  /** {níveis: nº de colunas que suportam esse nº de níveis}. */
  level_capacity: Record<number, number>;
}

export interface TaguchiCatalog {
  arrays: TaguchiArray[];
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
