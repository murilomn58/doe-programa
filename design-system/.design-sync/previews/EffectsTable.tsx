import { EffectsTable } from "doe-design-system";

/**
 * Previews da EffectsTable — estimativa dos efeitos de um fatorial 2^k.
 * Exemplo da aula: solo reforçado com fibra e cimento, resposta
 * "Módulo de Resiliência (MPa)". Fatores: % Fibra (0 / 1.5) e % Cimento (4 / 7).
 */

const efeitosModuloResiliencia = [
  {
    term: "% Fibra",
    effect: -38.455,
    coef_coded: -19.2275,
    std_err: 8.34921,
    t: -4.60583,
    p: 0.00999,
    ci_low: -61.632,
    ci_high: -15.278,
    pseudo_t: null,
    significant: null,
  },
  {
    term: "% Cimento",
    effect: 52.31,
    coef_coded: 26.155,
    std_err: 8.34921,
    t: 6.26527,
    p: 0.00331,
    ci_low: 29.133,
    ci_high: 75.487,
    pseudo_t: null,
    significant: null,
  },
  {
    term: "% Fibra × % Cimento",
    effect: 6.515,
    coef_coded: 3.2575,
    std_err: 8.34921,
    t: 0.78031,
    p: 0.47876,
    ci_low: -16.662,
    ci_high: 29.692,
    pseudo_t: null,
    significant: null,
  },
];

/** Fatorial 2³ sem réplicas: modelo saturado, significância via PSE de Lenth. */
const efeitosSaturados = [
  {
    term: "% Fibra",
    effect: -41.2,
    coef_coded: -20.6,
    std_err: null,
    t: null,
    p: null,
    ci_low: null,
    ci_high: null,
    pseudo_t: -10.173,
    significant: true,
  },
  {
    term: "% Cimento",
    effect: 55.85,
    coef_coded: 27.925,
    std_err: null,
    t: null,
    p: null,
    ci_low: null,
    ci_high: null,
    pseudo_t: 13.79,
    significant: true,
  },
  {
    term: "Umidade de Compactação",
    effect: -12.3,
    coef_coded: -6.15,
    std_err: null,
    t: null,
    p: null,
    ci_low: null,
    ci_high: null,
    pseudo_t: -3.037,
    significant: false,
  },
  {
    term: "% Fibra × % Cimento",
    effect: 6.52,
    coef_coded: 3.26,
    std_err: null,
    t: null,
    p: null,
    ci_low: null,
    ci_high: null,
    pseudo_t: 1.609,
    significant: false,
  },
  {
    term: "% Fibra × Umidade de Compactação",
    effect: -2.42,
    coef_coded: -1.21,
    std_err: null,
    t: null,
    p: null,
    ci_low: null,
    ci_high: null,
    pseudo_t: -0.598,
    significant: false,
  },
  {
    term: "% Cimento × Umidade de Compactação",
    effect: 3.37,
    coef_coded: 1.685,
    std_err: null,
    t: null,
    p: null,
    ci_low: null,
    ci_high: null,
    pseudo_t: 0.831,
    significant: false,
  },
];

/** Números da aula (Statistica, Tabela 5): Deformação Permanente, 2² com 2 réplicas. */
const efeitosDeformacaoPermanente = [
  {
    term: "Tensão Desvio",
    effect: 4.334,
    coef_coded: 2.167,
    std_err: 0.94092,
    t: 4.60613,
    p: 0.00999,
    ci_low: 1.72155,
    ci_high: 6.94645,
    pseudo_t: null,
    significant: null,
  },
  {
    term: "Umidade",
    effect: 2.6415,
    coef_coded: 1.32075,
    std_err: 0.94092,
    t: 2.80736,
    p: 0.04845,
    ci_low: 0.02905,
    ci_high: 5.25395,
    pseudo_t: null,
    significant: null,
  },
  {
    term: "Tensão Desvio × Umidade",
    effect: 0.7325,
    coef_coded: 0.36625,
    std_err: 0.94092,
    t: 0.77849,
    p: 0.47976,
    ci_low: -1.87995,
    ci_high: 3.34495,
    pseudo_t: null,
    significant: null,
  },
];

/** Canônico: fatorial 2² com réplicas — % Fibra e % Cimento sobre o Módulo de Resiliência. */
export function FatorialCompleto() {
  return (
    <div className="bg-surface-0 p-4">
      <EffectsTable effects={efeitosModuloResiliencia} saturated={false} />
    </div>
  );
}

/** Variante saturada: 2³ sem réplicas, pseudo-t e significância via PSE de Lenth. */
export function SaturadoPseudoT() {
  return (
    <div className="bg-surface-0 p-4">
      <EffectsTable effects={efeitosSaturados} saturated={true} />
    </div>
  );
}

/** Composição: duas respostas do mesmo experimento lado a lado. */
export function DuasRespostas() {
  return (
    <div className="grid gap-4 bg-surface-0 p-4 xl:grid-cols-2">
      <div className="grid gap-2">
        <p className="text-sm text-muted">Resposta: Módulo de Resiliência (MPa)</p>
        <EffectsTable effects={efeitosModuloResiliencia} saturated={false} />
      </div>
      <div className="grid gap-2">
        <p className="text-sm text-muted">Resposta: Deformação Permanente (mm)</p>
        <EffectsTable effects={efeitosDeformacaoPermanente} saturated={false} />
      </div>
    </div>
  );
}

/** Estado vazio: sem efeitos estimados o componente não renderiza nada. */
export function SemEfeitos() {
  return (
    <div className="grid gap-2 bg-surface-0 p-4">
      <p className="text-sm text-muted">
        Nenhum efeito estimado — a tabela só aparece após a análise do experimento.
      </p>
      <EffectsTable effects={[]} saturated={false} />
    </div>
  );
}
