/**
 * Montagem do payload de geração de design a partir do estado do wizard.
 * Extraído do ExperimentSetup para ser compartilhado com o tour guiado.
 * Sem UI e sem rede — só transforma o estado do formulário na requisição.
 */

import type { DesignConfig } from "@/components/DesignPicker";
import { TAGUCHI_AUTO } from "@/components/DesignPicker";
import type {
  DesignGenerateRequest,
  FactorInput,
  ResponseInput,
} from "@/domain/design";

/** Um fator está completo o bastante para gerar o design? */
export function factorIsValid(factor: FactorInput): boolean {
  if (!factor.name.trim()) return false;
  if (factor.factor_type === "quantitative") {
    return (
      factor.low !== undefined &&
      factor.high !== undefined &&
      factor.low !== factor.high
    );
  }
  return Boolean(factor.low_label?.trim() && factor.high_label?.trim());
}

/**
 * Sintetiza níveis igualmente espaçados para fatores quantitativos em arranjos
 * Taguchi de 3+ níveis; fatores qualitativos (2 rótulos) ficam com 2 níveis.
 */
export function withTaguchiLevels(
  factor: FactorInput,
  nLevels: number,
): FactorInput {
  if (nLevels <= 2 || factor.factor_type !== "quantitative") return factor;
  if (factor.low === undefined || factor.high === undefined) return factor;
  const step = (factor.high - factor.low) / (nLevels - 1);
  const levels = Array.from(
    { length: nLevels },
    (_, i) => factor.low! + step * i,
  );
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
  const factorsPayload =
    designConfig.designType === "taguchi"
      ? factors.map((f) => withTaguchiLevels(f, designConfig.taguchiLevels))
      : factors;

  const payload: DesignGenerateRequest = {
    name: name.trim() || undefined,
    design_type: designConfig.designType,
    replicates,
    factors: factorsPayload,
    responses: responses.filter((r) => r.name.trim()),
  };

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
