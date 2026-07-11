/**
 * Motor de recomendação do tour guiado.
 *
 * Traduz um mini-questionário em linguagem leiga (objetivo da pesquisa,
 * quantos fatores, se há fator categórico) numa família de planejamento DoE,
 * com um texto que explica a escolha. Função pura — sem estado, sem rede.
 * O usuário sempre pode trocar a família no "modo avançado" (DesignPicker).
 */

import type { DesignConfig } from "@/components/DesignPicker";
import type { DesignType } from "@/domain/design";

/** Objetivo da pesquisa, como o pesquisador pensa (não em jargão de DoE). */
export type ResearchGoal = "screening" | "optimization";

export interface RecommendInput {
  goal: ResearchGoal;
  nFactors: number;
  hasQualitative: boolean;
}

export interface DesignRecommendation {
  designType: DesignType;
  /** Patch parcial aplicado sobre o defaultDesignConfig (knobs da família). */
  configPatch: Partial<DesignConfig>;
  /** Nome amigável da família. */
  title: string;
  /** Por que esta escolha, em linguagem de leigo. */
  why: string;
  /** Aviso quando a recomendação foi condicionada (ex.: fator categórico). */
  caveat?: string;
}

/** Opções do questionário (rótulo + descrição leiga), para a UI montar os cards. */
export const GOAL_OPTIONS: {
  value: ResearchGoal;
  label: string;
  description: string;
}[] = [
  {
    value: "screening",
    label: "Descobrir QUAIS fatores importam",
    description:
      "Você tem vários fatores candidatos e quer saber quais realmente afetam o resultado (triagem).",
  },
  {
    value: "optimization",
    label: "Achar a MELHOR combinação",
    description:
      "Você já sabe quais fatores importam e quer encontrar os valores que maximizam ou minimizam a resposta (otimização).",
  },
];

/**
 * Recomenda a família de planejamento a partir das respostas do questionário.
 * Regras clássicas de DoE, simplificadas para o público leigo.
 */
export function recommendDesign(input: RecommendInput): DesignRecommendation {
  const { goal, nFactors, hasQualitative } = input;

  if (goal === "optimization") {
    // Otimização por superfície de resposta exige fatores numéricos (curvatura).
    if (hasQualitative) {
      return {
        designType: "full_factorial_2k",
        configPatch: { designType: "full_factorial_2k" },
        title: "Fatorial completo 2ᵏ",
        why: "Você quer otimizar, mas um dos fatores é categórico (não numérico). A busca pelo ponto ótimo por superfície de resposta precisa de fatores numéricos, então começamos pelo fatorial completo — ele mede todos os efeitos e interações e mostra a direção de melhoria.",
        caveat:
          "Para mapear a curvatura e achar o ótimo, deixe todos os fatores quantitativos e escolha um CCD.",
      };
    }
    return {
      designType: "central_composite",
      configPatch: { designType: "central_composite", ccdVariant: "rotatable" },
      title: "Composto Central (CCD)",
      why:
        nFactors >= 3
          ? "Para otimizar, o CCD acrescenta pontos axiais e centrais que medem a curvatura da resposta — assim dá para ajustar uma superfície e localizar o ponto ótimo. (Com 3+ fatores, o Box-Behnken é uma alternativa mais econômica, disponível no modo avançado.)"
          : "Para otimizar, o CCD acrescenta pontos axiais e centrais que medem a curvatura da resposta — assim dá para ajustar uma superfície de resposta e localizar o ponto ótimo.",
    };
  }

  // goal === "screening" — triagem: quantos fatores decide a economia de ensaios.
  if (nFactors >= 6) {
    return {
      designType: "plackett_burman",
      configPatch: { designType: "plackett_burman" },
      title: "Plackett-Burman",
      why: "Com muitos fatores, o Plackett-Burman tria quais importam usando pouquíssimos ensaios — ideal para uma primeira peneira antes de estudar os poucos fatores que sobrarem.",
    };
  }
  if (nFactors >= 4) {
    return {
      designType: "fractional_factorial_2kp",
      configPatch: {
        designType: "fractional_factorial_2kp",
        fractionalMode: "resolution",
        fractionalResolution: 4,
      },
      title: "Fatorial fracionado 2ᵏ⁻ᵖ",
      why: "Com vários fatores, uma fração testa só metade das combinações e ainda separa os efeitos principais das interações (resolução IV) — bem mais barato que o fatorial completo.",
    };
  }
  return {
    designType: "full_factorial_2k",
    configPatch: { designType: "full_factorial_2k" },
    title: "Fatorial completo 2ᵏ",
    why: "Com poucos fatores, o fatorial completo testa todas as combinações e já entrega efeitos principais e interações — é o planejamento mais direto e didático para começar.",
  };
}
