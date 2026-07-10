import { CoefTable } from "doe-design-system";

const coefFatorial = [
  {
    term: "Intercepto",
    coef_coded: 3120.45,
    coef_natural: 1856.32,
    std_err: 42.18,
    t: 73.9842,
    p: 0.0000012,
    ci_low: 3003.35,
    ci_high: 3237.55,
    vif: null,
  },
  {
    term: "% Fibra",
    coef_coded: -185.32,
    coef_natural: -247.09,
    std_err: 42.18,
    t: -4.3936,
    p: 0.0118,
    ci_low: -302.42,
    ci_high: -68.22,
    vif: 1.0,
  },
  {
    term: "% Cimento",
    coef_coded: 412.78,
    coef_natural: 275.19,
    std_err: 42.18,
    t: 9.7861,
    p: 0.0006,
    ci_low: 295.68,
    ci_high: 529.88,
    vif: 1.0,
  },
  {
    term: "% Fibra × % Cimento",
    coef_coded: 45.6,
    coef_natural: 40.53,
    std_err: 42.18,
    t: 1.0811,
    p: 0.3405,
    ci_low: -71.5,
    ci_high: 162.7,
    vif: 1.0,
  },
];

const coefSaturado = coefFatorial.map((c) => ({
  ...c,
  std_err: null,
  t: null,
  p: null,
  ci_low: null,
  ci_high: null,
  vif: null,
}));

const coefQuadratico = [
  ...coefFatorial,
  {
    term: "% Fibra²",
    coef_coded: -96.14,
    coef_natural: -170.92,
    std_err: 51.66,
    t: -1.861,
    p: 0.1362,
    ci_low: -239.57,
    ci_high: 47.29,
    vif: 1.02,
  },
  {
    term: "% Cimento²",
    coef_coded: 128.37,
    coef_natural: 57.05,
    std_err: 51.66,
    t: 2.4849,
    p: 0.0679,
    ci_low: -15.06,
    ci_high: 271.8,
    vif: 1.02,
  },
];

/** Fatorial 2² com réplicas: % Fibra e % Cimento sobre o Módulo de Resiliência (MPa). */
export function FatorialCompleto() {
  return (
    <div className="max-w-4xl bg-surface-0 p-6">
      <CoefTable coefficients={coefFatorial} saturated={false} />
    </div>
  );
}

/** Design saturado (sem graus de liberdade): só coeficientes, sem Std.Err/t/p/VIF. */
export function DesignSaturado() {
  return (
    <div className="max-w-4xl bg-surface-0 p-6">
      <CoefTable coefficients={coefSaturado} saturated={true} />
    </div>
  );
}

/** Modelo quadrático (RSM/CCD): termos ao quadrado com VIF acima de 1. */
export function ModeloQuadratico() {
  return (
    <div className="max-w-4xl bg-surface-0 p-6">
      <CoefTable coefficients={coefQuadratico} saturated={false} />
    </div>
  );
}

/** Composição realista: contexto da análise acima da tabela de coeficientes. */
export function ComposicaoAnalise() {
  return (
    <div className="max-w-4xl space-y-4 bg-surface-0 p-6">
      <div className="rounded-xl border border-border bg-surface-1 p-4">
        <p className="text-sm text-foreground">
          Resposta analisada:{" "}
          <span className="font-medium text-accent">Módulo de Resiliência (MPa)</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          Fatorial 2² com 2 réplicas — % Fibra (0 / 1.5) e % Cimento (4 / 7), codificação ±1
        </p>
      </div>
      <CoefTable coefficients={coefFatorial} saturated={false} />
    </div>
  );
}
