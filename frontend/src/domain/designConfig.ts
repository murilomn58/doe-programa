/**
 * Configuração do formulário de planejamento (estado do DesignPicker),
 * mapeada depois para o payload de geração do design. Vive no domínio (e não
 * em components/DesignPicker.tsx, de onde foi extraída) porque
 * designPayload.ts e o motor de recomendação (recommend.ts/runCount.ts)
 * precisam dela sem depender de um componente React — dependência sempre
 * aponta do componente para o domínio, nunca o contrário.
 */

import type {
  CCDVariant,
  DesignType,
  OptimalCriterion,
  RSMModel,
  SNObjective,
} from "@/domain/design";

export type FractionalMode = "resolution" | "generators";

/** Sentinela do seletor de arranjo Taguchi: deixa o backend escolher. */
export const TAGUCHI_AUTO = "" as const;

/** UI state of the design picker (mapped to the request payload on generate). */
export interface DesignConfig {
  designType: DesignType;
  fractionalMode: FractionalMode;
  fractionalResolution: number;
  fractionalGenerators: string;
  ccdVariant: CCDVariant;
  ccdCenterFactorial: number;
  ccdCenterAxial: number;
  bbdCenter: number;
  centerPoints: number;
  /**
   * Nº de blocos: repetições completas do arranjo sob uma condição conhecida
   * diferente do que o estudo investiga (lote de material, dia de moldagem,
   * tipo de solo). Combina com `replicates` — ver `contarEnsaios`.
   */
  blocks: number;
  // Taguchi
  taguchiArray: string; // "" → automático
  taguchiSN: SNObjective;
  taguchiLevels: number; // níveis por fator (2, 3, 4…) quando o arranjo comporta
  // D/I-ótimo
  optimalCriterion: OptimalCriterion;
  optimalNRuns: number;
  optimalModel: RSMModel;
  // DSD
  dsdExtraRuns: number;
}

export function defaultDesignConfig(): DesignConfig {
  return {
    designType: "full_factorial_2k",
    fractionalMode: "resolution",
    fractionalResolution: 3,
    fractionalGenerators: "",
    ccdVariant: "rotatable",
    ccdCenterFactorial: 4,
    ccdCenterAxial: 4,
    bbdCenter: 3,
    centerPoints: 0,
    blocks: 1,
    taguchiArray: TAGUCHI_AUTO,
    taguchiSN: "larger_is_better",
    taguchiLevels: 2,
    optimalCriterion: "D",
    optimalNRuns: 0,
    optimalModel: "linear_interactions",
    dsdExtraRuns: 0,
  };
}
