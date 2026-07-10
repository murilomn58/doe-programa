import { RetroDiagnosisCard } from "doe-design-system";

// --- dados do exemplo da aula: solo-fibra-cimento, fatorial 2³ com 2 réplicas --

const FATORES = [
  {
    name: "% Fibra",
    factor_type: "quantitative",
    low: 0,
    high: 1.5,
    center: 0.75,
    n_levels: 2,
    distinct_levels: [0, 1.5],
    labels: null,
    alpha: null,
    is_constant: false,
    warnings: [],
  },
  {
    name: "% Cimento",
    factor_type: "quantitative",
    low: 4,
    high: 7,
    center: 5.5,
    n_levels: 2,
    distinct_levels: [4, 7],
    labels: null,
    alpha: null,
    is_constant: false,
    warnings: [],
  },
  {
    name: "Tempo de Cura (dias)",
    factor_type: "quantitative",
    low: 7,
    high: 28,
    center: 17.5,
    n_levels: 2,
    distinct_levels: [7, 28],
    labels: null,
    alpha: null,
    is_constant: false,
    warnings: [],
  },
];

const PONTOS_FATORIAIS: [number, number, number][] = [
  [-1, -1, -1],
  [1, -1, -1],
  [-1, 1, -1],
  [1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [-1, 1, 1],
  [1, 1, 1],
];

const RUNS_2E3_COM_REPLICAS = PONTOS_FATORIAIS.flatMap((coded, i) =>
  [0, 1].map((rep) => ({
    row: i * 2 + rep + 1,
    point_type: "factorial" as const,
    coded: {
      "% Fibra": coded[0],
      "% Cimento": coded[1],
      "Tempo de Cura (dias)": coded[2],
    },
    replicate_group: i + 1,
  })),
);

const PONTO_CENTRAL = {
  "% Fibra": 0.75,
  "% Cimento": 5.5,
  "Tempo de Cura (dias)": 17.5,
};

const PONTOS_AXIAIS_FACE = [
  { "% Fibra": 0, "% Cimento": 5.5, "Tempo de Cura (dias)": 17.5 },
  { "% Fibra": 1.5, "% Cimento": 5.5, "Tempo de Cura (dias)": 17.5 },
  { "% Fibra": 0.75, "% Cimento": 4, "Tempo de Cura (dias)": 17.5 },
  { "% Fibra": 0.75, "% Cimento": 7, "Tempo de Cura (dias)": 17.5 },
  { "% Fibra": 0.75, "% Cimento": 5.5, "Tempo de Cura (dias)": 7 },
  { "% Fibra": 0.75, "% Cimento": 5.5, "Tempo de Cura (dias)": 28 },
];

const DIAGNOSTICO_2E3_COMPLETO = {
  n_rows: 16,
  n_rows_valid: 16,
  row_issues: [],
  factors: FATORES,
  runs: RUNS_2E3_COM_REPLICAS,
  replicates: {
    n_points_replicated: 8,
    runs_per_point_max: 2,
    df_pure_error: 8,
  },
  design_matches: [
    {
      design_type: "full_factorial_2k",
      variant: "2³ · 2 réplicas",
      status: "complete" as const,
      detail:
        "Os 8 pontos fatoriais do 2³ estão presentes, cada um com 2 réplicas (16 ensaios). Erro puro estimável com 8 graus de liberdade.",
      match_pct: 100,
      resolution: null,
      defining_relation: null,
      aliasing: null,
      missing_runs: [],
      n_matched: 8,
      n_expected: 8,
    },
    {
      design_type: "central_composite",
      variant: "faces (CCF)",
      status: "partial" as const,
      detail:
        "O cubo fatorial está completo, mas faltam os 6 pontos axiais nas faces e ao menos 1 ponto central para fechar um CCD.",
      match_pct: 53,
      resolution: null,
      defining_relation: null,
      aliasing: null,
      missing_runs: [...PONTOS_AXIAIS_FACE, PONTO_CENTRAL],
      n_matched: 8,
      n_expected: 15,
    },
  ],
  best_design: "full_factorial_2k",
  models: [
    {
      model: "linear",
      status: "estimable" as const,
      n_params: 4,
      rank: 4,
      df_resid: 12,
      reason: null,
    },
    {
      model: "linear_interactions",
      status: "estimable" as const,
      n_params: 8,
      rank: 8,
      df_resid: 8,
      reason: null,
    },
    {
      model: "linear_quadratic",
      status: "not_estimable" as const,
      n_params: 11,
      rank: 8,
      df_resid: null,
      reason:
        "termos quadráticos exigem ao menos 3 níveis por fator — adicione pontos axiais e centrais",
    },
    {
      model: "full",
      status: "not_estimable" as const,
      n_params: 14,
      rank: 8,
      df_resid: null,
      reason: "posto da matriz (8) menor que o número de parâmetros (14)",
    },
  ],
  best_model: "linear_interactions",
  response_used: "Módulo de Resiliência (MPa)",
  completions: [
    {
      target: "central_composite",
      variant: "faces (α=1)",
      title: "Elevar a CCD de faces (6 axiais + 3 centrais)",
      runs_to_add: [
        ...PONTOS_AXIAIS_FACE,
        PONTO_CENTRAL,
        PONTO_CENTRAL,
        PONTO_CENTRAL,
      ],
      n_runs_to_add: 9,
      enables: ["linear_quadratic", "full"],
      rationale:
        "Com os pontos axiais nas faces e os centrais, o modelo quadrático fica estimável e a curvatura do Módulo de Resiliência pode ser testada.",
    },
  ],
};

// --- meia-fração 2³⁻¹ (resolução III), sem réplicas ----------------------------

const RUNS_MEIA_FRACAO = [
  { pf: [-1, -1, 1] as [number, number, number], row: 1 },
  { pf: [1, -1, -1] as [number, number, number], row: 2 },
  { pf: [-1, 1, -1] as [number, number, number], row: 3 },
  { pf: [1, 1, 1] as [number, number, number], row: 4 },
].map(({ pf, row }) => ({
  row,
  point_type: "factorial" as const,
  coded: {
    "% Fibra": pf[0],
    "% Cimento": pf[1],
    "Tempo de Cura (dias)": pf[2],
  },
  replicate_group: row,
}));

const DIAGNOSTICO_MEIA_FRACAO = {
  n_rows: 4,
  n_rows_valid: 4,
  row_issues: [],
  factors: FATORES,
  runs: RUNS_MEIA_FRACAO,
  replicates: {
    n_points_replicated: 0,
    runs_per_point_max: 1,
    df_pure_error: 0,
  },
  design_matches: [
    {
      design_type: "fractional_factorial_2kp",
      variant: "2³⁻¹",
      status: "complete" as const,
      detail:
        "Meia-fração regular do 2³ com relação de definição I = ABC: os efeitos principais estão em alias com as interações duplas.",
      match_pct: 100,
      resolution: 3,
      defining_relation: "I = ABC",
      aliasing: ["A = BC", "B = AC", "C = AB"],
      missing_runs: [],
      n_matched: 4,
      n_expected: 4,
    },
    {
      design_type: "full_factorial_2k",
      variant: "2³",
      status: "partial" as const,
      detail:
        "Metade dos pontos do cubo 2³ presente; faltam 4 combinações para o fatorial completo.",
      match_pct: 50,
      resolution: null,
      defining_relation: null,
      aliasing: null,
      missing_runs: [
        { "% Fibra": 0, "% Cimento": 4, "Tempo de Cura (dias)": 7 },
        { "% Fibra": 1.5, "% Cimento": 4, "Tempo de Cura (dias)": 28 },
        { "% Fibra": 0, "% Cimento": 7, "Tempo de Cura (dias)": 28 },
        { "% Fibra": 1.5, "% Cimento": 7, "Tempo de Cura (dias)": 7 },
      ],
      n_matched: 4,
      n_expected: 8,
    },
  ],
  best_design: "fractional_factorial_2kp",
  models: [
    {
      model: "linear",
      status: "saturated" as const,
      n_params: 4,
      rank: 4,
      df_resid: 0,
      reason:
        "4 ensaios para 4 parâmetros — sem graus de liberdade residuais; significância via pseudo-erro de Lenth",
    },
    {
      model: "linear_interactions",
      status: "not_estimable" as const,
      n_params: 7,
      rank: 4,
      df_resid: null,
      reason:
        "na resolução III as interações duplas estão em alias com os efeitos principais",
    },
    {
      model: "linear_quadratic",
      status: "not_estimable" as const,
      n_params: 7,
      rank: 4,
      df_resid: null,
      reason: "apenas 2 níveis por fator — sem informação de curvatura",
    },
    {
      model: "full",
      status: "not_estimable" as const,
      n_params: 8,
      rank: 4,
      df_resid: null,
      reason: "posto da matriz (4) menor que o número de parâmetros (8)",
    },
  ],
  best_model: "linear",
  response_used: "Módulo de Resiliência (MPa)",
  completions: [
    {
      target: "full_factorial_2k",
      variant: "dobra",
      title: "Dobra (fold-over) para completar o fatorial 2³",
      runs_to_add: [
        { "% Fibra": 0, "% Cimento": 4, "Tempo de Cura (dias)": 7 },
        { "% Fibra": 1.5, "% Cimento": 4, "Tempo de Cura (dias)": 28 },
        { "% Fibra": 0, "% Cimento": 7, "Tempo de Cura (dias)": 28 },
        { "% Fibra": 1.5, "% Cimento": 7, "Tempo de Cura (dias)": 7 },
      ],
      n_runs_to_add: 4,
      enables: ["linear_interactions"],
      rationale:
        "Adicionar a fração espelhada quebra o alias entre efeitos principais e interações duplas e libera graus de liberdade para o resíduo.",
    },
  ],
};

// --- variação com linhas problemáticas ----------------------------------------

const DIAGNOSTICO_COM_PROBLEMAS = {
  ...DIAGNOSTICO_2E3_COMPLETO,
  n_rows_valid: 14,
  row_issues: [
    { row: 6, message: 'valor não numérico "1,5a" em % Fibra' },
    { row: 11, message: "resposta Módulo de Resiliência (MPa) vazia" },
  ],
  replicates: {
    n_points_replicated: 6,
    runs_per_point_max: 2,
    df_pure_error: 6,
  },
  models: [
    {
      model: "linear",
      status: "estimable" as const,
      n_params: 4,
      rank: 4,
      df_resid: 10,
      reason: null,
    },
    {
      model: "linear_interactions",
      status: "estimable" as const,
      n_params: 8,
      rank: 8,
      df_resid: 6,
      reason: null,
    },
    {
      model: "linear_quadratic",
      status: "not_estimable" as const,
      n_params: 11,
      rank: 8,
      df_resid: null,
      reason:
        "termos quadráticos exigem ao menos 3 níveis por fator — adicione pontos axiais e centrais",
    },
    {
      model: "full",
      status: "not_estimable" as const,
      n_params: 14,
      rank: 8,
      df_resid: null,
      reason: "posto da matriz (8) menor que o número de parâmetros (14)",
    },
  ],
};

// --- stories -------------------------------------------------------------------

/** Canônico: fatorial 2³ completo com 2 réplicas, melhor modelo Linear + Interações. */
export function Diagnostico2Cubo() {
  return (
    <div className="max-w-2xl bg-surface-0 p-4">
      <RetroDiagnosisCard
        diagnosis={DIAGNOSTICO_2E3_COMPLETO}
        isLoading={false}
        onAddRuns={() => {}}
        onAnalyze={() => {}}
        isAnalyzing={false}
        analyzeError={null}
      />
    </div>
  );
}

/** Meia-fração 2³⁻¹ resolução III: modelo saturado (Lenth) e dobra sugerida. */
export function DiagnosticoMeiaFracao() {
  return (
    <div className="max-w-2xl bg-surface-0 p-4">
      <RetroDiagnosisCard
        diagnosis={DIAGNOSTICO_MEIA_FRACAO}
        isLoading={false}
        onAddRuns={() => {}}
        onAnalyze={() => {}}
        isAnalyzing={false}
        analyzeError={null}
      />
    </div>
  );
}

/** Linhas inválidas na tabela + erro ao preparar a análise. */
export function DiagnosticoComProblemasEErro() {
  return (
    <div className="max-w-2xl bg-surface-0 p-4">
      <RetroDiagnosisCard
        diagnosis={DIAGNOSTICO_COM_PROBLEMAS}
        isLoading={false}
        onAddRuns={() => {}}
        onAnalyze={() => {}}
        isAnalyzing={false}
        analyzeError="Falha ao preparar a análise: 2 linha(s) inválida(s) impedem a materialização do experimento."
      />
    </div>
  );
}

/** Estado de carregamento: diagnóstico ainda não retornou. */
export function DiagnosticoCarregando() {
  return (
    <div className="max-w-2xl bg-surface-0 p-4">
      <RetroDiagnosisCard
        diagnosis={undefined}
        isLoading={true}
        onAddRuns={() => {}}
        onAnalyze={() => {}}
        isAnalyzing={false}
        analyzeError={null}
      />
    </div>
  );
}

/** Estado vazio: dados insuficientes para detectar o planejamento. */
export function DiagnosticoVazio() {
  return (
    <div className="max-w-2xl bg-surface-0 p-4">
      <RetroDiagnosisCard
        diagnosis={undefined}
        isLoading={false}
        onAddRuns={() => {}}
        onAnalyze={() => {}}
        isAnalyzing={false}
        analyzeError={null}
      />
    </div>
  );
}
