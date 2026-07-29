/**
 * Montagem do payload de geração de design a partir do estado do wizard.
 * Extraído do ExperimentSetup para ser compartilhado com o tour guiado.
 * Sem UI e sem rede — só transforma o estado do formulário na requisição.
 */

import type { DesignConfig } from "@/components/DesignPicker";
import { TAGUCHI_AUTO } from "@/components/DesignPicker";
import {
  apenasFatores,
  blocoDeclarado,
  niveisEquiespacados,
  type DesignGenerateRequest,
  type FactorInput,
  type ResponseInput,
} from "@/domain/design";

/** Tolerância numérica para comparar extremos de `levels` com `low`/`high`. */
const TOLERANCIA = 1e-9;

/**
 * `levels` declarados pelo usuário precisam ser uma lista com pelo menos 2
 * valores, estritamente crescente, cujo primeiro e último elemento batem com
 * `low`/`high` (com tolerância de ponto flutuante).
 */
function niveisDeclaradosSaoValidos(
  levels: number[],
  low: number,
  high: number,
): boolean {
  if (levels.length < 2) return false;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] <= levels[i - 1]) return false;
  }
  return (
    Math.abs(levels[0] - low) < TOLERANCIA &&
    Math.abs(levels[levels.length - 1] - high) < TOLERANCIA
  );
}

/** Um fator está completo o bastante para gerar o design? */
export function factorIsValid(factor: FactorInput): boolean {
  if (!factor.name.trim()) return false;
  if (factor.factor_type === "quantitative") {
    if (
      factor.low === undefined ||
      factor.high === undefined ||
      factor.low === factor.high
    ) {
      return false;
    }
    return (
      factor.levels === undefined ||
      niveisDeclaradosSaoValidos(factor.levels, factor.low, factor.high)
    );
  }
  return Boolean(factor.low_label?.trim() && factor.high_label?.trim());
}

/**
 * Sintetiza níveis igualmente espaçados para fatores quantitativos em arranjos
 * Taguchi de 3+ níveis; fatores qualitativos (2 rótulos) ficam com 2 níveis.
 * A declaração do usuário tem precedência: se o fator já traz `levels`,
 * respeita exatamente o que foi declarado e não reinterpola por cima.
 */
export function withTaguchiLevels(
  factor: FactorInput,
  nLevels: number,
): FactorInput {
  if (factor.levels !== undefined) return factor;
  if (nLevels <= 2 || factor.factor_type !== "quantitative") return factor;
  if (factor.low === undefined || factor.high === undefined) return factor;
  const levels = niveisEquiespacados(factor.low, factor.high, nLevels);
  return { ...factor, levels };
}

interface BuildDesignRequestArgs {
  name: string;
  designConfig: DesignConfig;
  replicates: number;
  factors: FactorInput[];
  responses: ResponseInput[];
}

/** Traduz o estado do wizard na requisição `DesignGenerateRequest` do backend. */
export function buildDesignRequest({
  name,
  designConfig,
  replicates,
  factors,
  responses,
}: BuildDesignRequestArgs): DesignGenerateRequest {
  // Uma entrada marcada como bloco NÃO é fator: ela sai da lista enviada ao
  // motor e vira a estrutura de blocagem. É o que permite o pesquisador
  // declarar "tipo de solo" com sete categorias, que como fator qualitativo
  // seria impossível (o motor aceita duas), e ainda assim ter os sete nomes
  // registrados no experimento.
  const bloco = blocoDeclarado(factors);
  const nomesDosBlocos = bloco?.categorias?.map((c) => c.trim()).filter(Boolean);
  const entradasQueSaoFator = apenasFatores(factors);

  const factorsPayload =
    designConfig.designType === "taguchi"
      ? entradasQueSaoFator.map((f) => withTaguchiLevels(f, designConfig.taguchiLevels))
      : entradasQueSaoFator;

  const payload: DesignGenerateRequest = {
    name: name.trim() || undefined,
    design_type: designConfig.designType,
    replicates,
    // O bloco declarado no passo de fatores tem precedência sobre o campo
    // numérico do catálogo avançado, para não haver duas fontes de verdade.
    blocks: nomesDosBlocos?.length ?? designConfig.blocks,
    factors: factorsPayload,
    responses: responses.filter((r) => r.name.trim()),
  };

  if (nomesDosBlocos && nomesDosBlocos.length >= 2) {
    payload.block_labels = nomesDosBlocos;
    if (bloco?.name.trim()) payload.block_name = bloco.name.trim();
  }

  if (designConfig.designType === "full_factorial_2k") {
    payload.center_points = designConfig.centerPoints;
  } else if (designConfig.designType === "fractional_factorial_2kp") {
    payload.center_points = designConfig.centerPoints;
    payload.fractional =
      designConfig.fractionalMode === "resolution"
        ? { resolution: designConfig.fractionalResolution }
        : { generators: designConfig.fractionalGenerators.trim() };
  } else if (designConfig.designType === "central_composite") {
    payload.ccd = {
      variant: designConfig.ccdVariant,
      center_factorial: designConfig.ccdCenterFactorial,
      center_axial: designConfig.ccdCenterAxial,
    };
  } else if (designConfig.designType === "box_behnken") {
    payload.bbd_center = designConfig.bbdCenter;
  } else if (designConfig.designType === "taguchi") {
    payload.taguchi = {
      sn_objective: designConfig.taguchiSN,
      ...(designConfig.taguchiArray !== TAGUCHI_AUTO
        ? { array_name: designConfig.taguchiArray }
        : {}),
    };
  } else if (designConfig.designType === "optimal") {
    payload.optimal = {
      criterion: designConfig.optimalCriterion,
      n_runs: designConfig.optimalNRuns,
      model: designConfig.optimalModel,
    };
  } else if (designConfig.designType === "dsd") {
    payload.dsd = { add_extra_runs: designConfig.dsdExtraRuns };
  }

  return payload;
}
