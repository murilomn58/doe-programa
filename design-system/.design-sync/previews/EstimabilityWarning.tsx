import { EstimabilityWarning } from "doe-design-system";

/** Canônico: design singular — modelo com interação não estimável. */
export function ErroModeloNaoEstimavel() {
  return (
    <div className="bg-surface-0 p-6">
      <EstimabilityWarning
        tone="error"
        warnings={[
          "A matriz de planejamento tem posto 3, mas o modelo com interação % Fibra × % Cimento exige 4 parâmetros.",
          "Adicione ensaios (réplicas ou pontos centrais) ou reduza o modelo para efeitos principais.",
        ]}
      />
    </div>
  );
}

/** Tom de aviso: confundimento em fatorial fracionado de resolução III. */
export function AvisoConfundimento() {
  return (
    <div className="bg-surface-0 p-6">
      <EstimabilityWarning
        tone="warn"
        warnings={[
          "Fatorial fracionado 2^(3-1) de resolução III: efeitos principais confundidos com interações de 2 fatores.",
          "Sem réplicas: o erro puro não pode ser estimado; a ANOVA usará o resíduo do modelo.",
        ]}
      />
    </div>
  );
}

/** Erro com item único: mensagem direta de design saturado. */
export function ErroDesignSaturado() {
  return (
    <div className="bg-surface-0 p-6">
      <EstimabilityWarning
        tone="error"
        warnings={[
          "Design saturado: 4 ensaios para 4 parâmetros — sem graus de liberdade para estimar o erro da resposta Módulo de Resiliência (MPa).",
        ]}
      />
    </div>
  );
}

/** Composição realista: erro e aviso empilhados como na tela de análise. */
export function ComposicaoAnalise() {
  return (
    <div className="grid gap-4 bg-surface-0 p-6">
      <p className="text-sm text-foreground">
        Análise — Módulo de Resiliência (MPa) · fatores % Fibra (0 / 1.5) e %
        Cimento (4 / 7)
      </p>
      <EstimabilityWarning
        tone="error"
        warnings={[
          "Interação % Fibra × % Cimento não é estimável: coluna da interação é combinação linear das colunas de efeitos principais.",
        ]}
      />
      <EstimabilityWarning
        tone="warn"
        warnings={[
          "Apenas 1 réplica por ensaio: a significância dos efeitos pode estar superestimada.",
        ]}
      />
    </div>
  );
}
