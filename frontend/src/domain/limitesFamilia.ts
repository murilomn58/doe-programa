/**
 * Fonte única do nº mínimo de fatores que cada família de planejamento aceita
 * — a MESMA regra que o motor Python aplica ao gerar a matriz (ver
 * `backend/services/design_service.py` e `backend/services/design_builders*.py`).
 * Antes desta extração, a mesma informação vivia solta em três lugares
 * (`motivoBloqueio` em GuidedTour.tsx, os `k >= N` soltos de `designBaseRuns` e
 * o ramo `full_factorial_general` de `contarEnsaios`, ambos em runCount.ts) e
 * cada lugar tinha um mínimo diferente — foi assim que a vitrine ofereceu CCD
 * com 1 fator (mínimo real: 2).
 *
 * ESPELHADO em `backend/tests/test_minimos_por_familia.py`: qualquer mudança
 * aqui exige a mesma mudança lá, e vice-versa. As duas tabelas precisam
 * concordar sempre.
 */

import type { DesignType } from "@/domain/design";

/** Nº mínimo de fatores que cada família aceita, espelhando o motor Python. */
export const MINIMO_DE_FATORES: Record<DesignType, number> = {
  // Um fator só, dentro de blocos e/ou réplicas, é um RCBD legítimo (o caso
  // do pesquisador com % de fibra em 3 níveis e 4 blocos de material).
  full_factorial_2k: 1,
  full_factorial_general: 1,
  taguchi: 1,
  fractional_factorial_2kp: 2,
  central_composite: 2,
  plackett_burman: 2,
  optimal: 2,
  dsd: 2,
  box_behnken: 3,
};

/**
 * Frase EXATA que o motor Python emite quando `k` fica abaixo do mínimo da
 * família — a mesma frase nos dois lados, para o aluno ler a mesma explicação
 * antes de clicar (vitrine) e depois de clicar (erro do backend, se algo
 * escapar). `undefined` quando `k` já atende o mínimo.
 */
const MOTIVO_POR_FAMILIA: Record<DesignType, string> = {
  full_factorial_2k: "Um planejamento fatorial 2^k precisa de pelo menos 1 fator.",
  full_factorial_general:
    "Um fatorial completo com níveis precisa de pelo menos 1 fator.",
  taguchi: "Um planejamento Taguchi precisa de fatores.",
  fractional_factorial_2kp: "Um planejamento fracionado precisa de pelo menos 2 fatores.",
  central_composite: "Um CCD precisa de pelo menos 2 fatores.",
  plackett_burman: "Um Plackett-Burman precisa de pelo menos 2 fatores.",
  optimal: "Um planejamento ótimo precisa de pelo menos 2 fatores.",
  dsd: "Um DSD precisa de pelo menos 2 fatores.",
  box_behnken: "Um Box-Behnken precisa de pelo menos 3 fatores.",
};

/**
 * Motivo de bloqueio por mínimo de fatores, ou `undefined` quando `k` já
 * atende. Só cobre a guarda de CONTAGEM — as guardas que não são de contagem
 * (fator qualitativo em CCD/BBD, geradores vazios, `optimalNRuns` insuficiente)
 * continuam vivendo em `motivoBloqueio` (GuidedTour.tsx), que consulta esta
 * função para a parte de contagem e mantém as próprias por cima.
 */
export function motivoDeMinimo(designType: DesignType, k: number): string | undefined {
  return k < MINIMO_DE_FATORES[designType] ? MOTIVO_POR_FAMILIA[designType] : undefined;
}
