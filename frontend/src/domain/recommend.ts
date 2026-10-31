/**
 * Motor de recomendação do tour guiado.
 *
 * Traduz o objetivo da pesquisa e os fatores declarados (com os níveis que o
 * pesquisador informou) numa lista de 1 a 3 planos de planejamento
 * comparados — recomendado, econômico e completo —, cada um com uma frase em
 * português corrente explicando a escolha. Função pura — sem estado, sem
 * rede. O usuário sempre pode trocar a família no "modo avançado"
 * (DesignPicker).
 *
 * Decisão travada: o CCD ROTÁVEL nunca é recomendado aqui. Seus pontos
 * axiais ficam em α ≈ 1,41, fora da faixa mínimo-máximo que o pesquisador
 * declarou — faixa que, em casos reais (ex.: fibra vegetal trazida por
 * avião, material contado), é limite físico de laboratório. Só o CCD de
 * face centrada (α = 1) respeita essa faixa; o rotável continua disponível
 * no catálogo manual (DesignPicker).
 */

import { nNiveis, type DesignType, type FactorInput } from "@/domain/design";
import { defaultDesignConfig, type DesignConfig } from "@/domain/designConfig";
import { contarEnsaios } from "@/domain/runCount";

/** Objetivo da pesquisa, como o pesquisador pensa (não em jargão de DoE). */
export type ResearchGoal = "screening" | "optimization";

/**
 * Entrada de `recommendPlans`: o objetivo e os fatores tal como declarados no
 * formulário, níveis inclusos. O nº de fatores e "tem qualitativo" são
 * sempre derivados de `factors` — nunca duplicados como campos à parte, para
 * não haver dois lugares de verdade sobre a mesma coisa.
 */
export interface RecommendInput {
  goal: ResearchGoal;
  factors: FactorInput[];
}

export type RotuloPlano = "recomendado" | "economico" | "completo";

export interface PlanoSugerido {
  rotulo: RotuloPlano;
  designType: DesignType;
  /** Patch parcial aplicado sobre o defaultDesignConfig (knobs da família). */
  configPatch: Partial<DesignConfig>;
  /** Fora do DesignConfig: vive como estado irmão no GuidedTour. */
  replicates?: number;
  /** Ensaios já contando réplicas e pontos centrais. */
  nEnsaios: number;
  capacidades: {
    /** Acusa que há curvatura, sem dizer de qual fator. */
    detectaCurvatura: boolean;
    /** Estima o termo quadrático de cada fator. */
    curvaturaPorFator: boolean;
    interacoes: boolean;
    erroPuro: boolean;
    pontoOtimo: boolean;
  };
  /** Uma frase em português corrente, sem travessão, sem negrito. */
  porque: string;
  /** Motivo, quando o plano não cabe (ex.: "exige ao menos 3 fatores"). */
  indisponivel?: string;
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

// ---------------------------------------------------------------------------
// Perfis fixos de capacidade por família (o que cada arranjo consegue
// estimar). Vivem soltos porque várias famílias reaproveitam o mesmo perfil.
// ---------------------------------------------------------------------------

const CAP_SUPERFICIE = {
  detectaCurvatura: true,
  curvaturaPorFator: true,
  interacoes: true,
  erroPuro: true,
  pontoOtimo: true,
};

const CAP_FATORIAL_GERAL = {
  detectaCurvatura: true,
  curvaturaPorFator: true,
  interacoes: true,
  erroPuro: false,
  pontoOtimo: true,
};

const CAP_2K_COM_CENTROS = {
  detectaCurvatura: true,
  curvaturaPorFator: false,
  interacoes: true,
  erroPuro: true,
  pontoOtimo: false,
};

const CAP_2K = {
  detectaCurvatura: false,
  curvaturaPorFator: false,
  interacoes: true,
  erroPuro: false,
  pontoOtimo: false,
};

const CAP_TRIAGEM_2_NIVEIS = {
  detectaCurvatura: false,
  curvaturaPorFator: false,
  interacoes: false,
  erroPuro: false,
  pontoOtimo: false,
};

// ---------------------------------------------------------------------------
// Helpers de texto (PT-BR corrente, sem travessão, sem negrito) e de contagem.
// ---------------------------------------------------------------------------

function objetivoTexto(goal: ResearchGoal): string {
  return goal === "optimization"
    ? "achar o ponto ótimo"
    : "mapear a curvatura da resposta";
}

function plural(n: number, singular: string, noPlural: string): string {
  return n === 1 ? singular : noPlural;
}

/**
 * Ensaios de uma réplica (com pontos centrais) × réplicas. As famílias e os
 * `k` usados por `recommendPlans` sempre têm contagem determinada para
 * k >= 1; devolve 0 no caso patológico k = 0 (tela ainda em edição, com a
 * lista de fatores transitoriamente vazia) em vez de lançar exceção.
 */
function ensaiosDoPatch(
  configPatch: Partial<DesignConfig>,
  factors: FactorInput[],
  replicates: number,
): number {
  const config: DesignConfig = { ...defaultDesignConfig(), ...configPatch };
  return contarEnsaios(config, factors, replicates) ?? 0;
}

/** Nome amigável por família — só as que este motor recomenda. */
const TITULOS: Partial<Record<DesignType, string>> = {
  full_factorial_2k: "Fatorial completo 2ᵏ",
  fractional_factorial_2kp: "Fatorial fracionado 2ᵏ⁻ᵖ",
  central_composite: "Composto Central (CCD)",
  box_behnken: "Box-Behnken",
  full_factorial_general: "Fatorial completo (níveis múltiplos)",
  plackett_burman: "Plackett-Burman",
};

/**
 * Recomenda de 1 a 3 planos de planejamento a partir do objetivo e dos
 * fatores declarados (níveis inclusos).
 *
 * Regra: se o maior nº de níveis entre os fatores QUANTITATIVOS é >= 3, ou o
 * objetivo é otimização, a família precisa estimar curvatura (ver
 * `recomendarSuperficie`); caso contrário, é triagem clássica de 2 níveis
 * (ver `recomendarTriagem`).
 */
export function recommendPlans(input: RecommendInput): PlanoSugerido[] {
  const { goal, factors } = input;
  const k = factors.length;
  const hasQualitative = factors.some((f) => f.factor_type === "qualitative");
  const quantFactors = factors.filter((f) => f.factor_type === "quantitative");
  const maxNiveisQuant =
    quantFactors.length > 0 ? Math.max(...quantFactors.map(nNiveis)) : 2;

  const precisaCurvatura = maxNiveisQuant >= 3 || goal === "optimization";

  return precisaCurvatura
    ? recomendarSuperficie({ goal, factors, k, hasQualitative, maxNiveisQuant })
    : recomendarTriagem({ goal, factors, k });
}

function recomendarSuperficie({
  goal,
  factors,
  k,
  hasQualitative,
  maxNiveisQuant,
}: {
  goal: ResearchGoal;
  factors: FactorInput[];
  k: number;
  hasQualitative: boolean;
  maxNiveisQuant: number;
}): PlanoSugerido[] {
  // Fator qualitativo: nem CCD nem Box-Behnken aceitam. Só resta o fatorial
  // geral (mistura níveis quantitativos e qualitativos), com a ressalva de
  // que ele não ajusta superfície de resposta nem localiza o ótimo sozinho.
  if (hasQualitative) {
    const temCurvaturaQuant = maxNiveisQuant >= 3;
    const patch: Partial<DesignConfig> = { designType: "full_factorial_general" };
    return [
      {
        rotulo: "recomendado",
        designType: "full_factorial_general",
        configPatch: patch,
        nEnsaios: ensaiosDoPatch(patch, factors, 1),
        capacidades: {
          detectaCurvatura: temCurvaturaQuant,
          curvaturaPorFator: temCurvaturaQuant,
          interacoes: true,
          erroPuro: false,
          pontoOtimo: false,
        },
        porque: `Você quer ${objetivoTexto(goal)}, mas há fator qualitativo entre os ${k} fatores declarados, e nem o CCD nem o Box-Behnken aceitam fator qualitativo; o fatorial geral testa todas as combinações dos níveis declarados, inclusive o qualitativo, e mostra a direção de melhoria, mas não ajusta uma superfície de resposta nem localiza sozinho o ponto ótimo.`,
      },
    ];
  }

  // Três pontos centrais no total, e não os 4 + 4 do padrão do formulário.
  // Aquele padrão é o de um CCD blocado, com quatro centrais no bloco do cubo e
  // quatro no da estrela. Sem blocagem ele infla o arranjo sem contrapartida: em
  // dois fatores, o CCD de face centrada tem exatamente a mesma geometria do
  // fatorial 3² (os quatro vértices mais os quatro pontos de face são os mesmos
  // pontos médios de aresta), de modo que 4 + 4 + 8 = 16 ensaios entregariam o
  // mesmo modelo que 9 entregam, e a plataforma estaria mandando moldar 78 % mais
  // corpos de prova à toa. Com 3 centrais sobram 2 graus de liberdade de erro
  // puro, que é o suficiente para o teste de falta de ajuste, ao custo honesto de
  // 2 ensaios acima do fatorial 3².
  const ccdPatch: Partial<DesignConfig> = {
    designType: "central_composite",
    ccdVariant: "face_centered",
    ccdCenterFactorial: 2,
    ccdCenterAxial: 1,
  };
  const nEnsaiosCcd = ensaiosDoPatch(ccdPatch, factors, 1);

  // Com mais de 3 níveis declarados, o CCD só consome 3 (mínimo, centro e
  // máximo) — os demais só são aproveitados por fatorial geral, Taguchi ou
  // D-ótimo. O aluno precisa saber que declarar 5 não foi em vão à toa.
  const desperdicaNiveis = maxNiveisQuant > 3;
  const fraseFatores = plural(k, "fator quantitativo", "fatores quantitativos");
  const baseTexto =
    maxNiveisQuant >= 3
      ? `Você declarou ${maxNiveisQuant} níveis em ${k} ${fraseFatores} e o objetivo é ${objetivoTexto(goal)}, então o CCD de face centrada acrescenta pontos axiais e centrais dentro da própria faixa mínimo-máximo para estimar essa curvatura.`
      : `Você declarou só 2 níveis em ${k} ${fraseFatores}, mas o objetivo é ${objetivoTexto(goal)}; com 2 níveis não haveria curvatura a estimar, então o CCD de face centrada acrescenta pontos axiais e centrais dentro da própria faixa mínimo-máximo para revelar essa curvatura.`;
  const porqueRecomendado = desperdicaNiveis
    ? `${baseTexto} O arranjo usa só três dos níveis declarados (mínimo, centro e máximo); os demais níveis só são aproveitados por planejamentos como o fatorial geral, o Taguchi ou o D-ótimo.`
    : baseTexto;

  const recomendado: PlanoSugerido = {
    rotulo: "recomendado",
    designType: "central_composite",
    configPatch: ccdPatch,
    nEnsaios: nEnsaiosCcd,
    capacidades: { ...CAP_SUPERFICIE },
    porque: porqueRecomendado,
  };

  let economico: PlanoSugerido;
  if (k >= 3 && maxNiveisQuant === 3) {
    const patch: Partial<DesignConfig> = { designType: "box_behnken" };
    economico = {
      rotulo: "economico",
      designType: "box_behnken",
      configPatch: patch,
      nEnsaios: ensaiosDoPatch(patch, factors, 1),
      capacidades: { ...CAP_SUPERFICIE },
      porque: `Com ${k} fatores quantitativos em 3 níveis, o Box-Behnken estima a mesma curvatura do CCD sem levar todos os fatores aos extremos ao mesmo tempo, custando menos ensaios.`,
    };
  } else if (k <= 2 && maxNiveisQuant === 3) {
    const patchGeral: Partial<DesignConfig> = {
      designType: "full_factorial_general",
    };
    const nEnsaiosGeral = ensaiosDoPatch(patchGeral, factors, 1);
    economico =
      nEnsaiosGeral < nEnsaiosCcd
        ? {
            rotulo: "economico",
            designType: "full_factorial_general",
            configPatch: patchGeral,
            nEnsaios: nEnsaiosGeral,
            capacidades: { ...CAP_FATORIAL_GERAL },
            porque: `Com ${k} ${plural(k, "fator", "fatores")} em 3 níveis, o fatorial geral 3^${k} testa todas as combinações declaradas em menos ensaios que o CCD, então é a opção econômica aqui.`,
          }
        : fatorial2kComCentros(k, factors);
  } else {
    economico = fatorial2kComCentros(k, factors);
  }

  const completo: PlanoSugerido = {
    rotulo: "completo",
    designType: "central_composite",
    configPatch: ccdPatch,
    replicates: 2,
    nEnsaios: ensaiosDoPatch(ccdPatch, factors, 2),
    capacidades: { ...CAP_SUPERFICIE },
    porque:
      "Repetir o CCD de face centrada em 2 réplicas permite estimar o erro puro e checar a repetibilidade do experimento, ao custo de dobrar os ensaios.",
  };

  return [recomendado, economico, completo];
}

/** Fallback econômico padrão: fatorial 2^k com 3 pontos centrais. */
function fatorial2kComCentros(k: number, factors: FactorInput[]): PlanoSugerido {
  const patch: Partial<DesignConfig> = {
    designType: "full_factorial_2k",
    centerPoints: 3,
  };
  return {
    rotulo: "economico",
    designType: "full_factorial_2k",
    configPatch: patch,
    nEnsaios: ensaiosDoPatch(patch, factors, 1),
    capacidades: { ...CAP_2K_COM_CENTROS },
    porque: `Como alternativa mais simples, o fatorial 2^${k} com 3 pontos centrais já acusa a curvatura (sem apontar de qual fator) e custa bem menos ensaios que o CCD.`,
  };
}

function recomendarTriagem({
  factors,
  k,
}: {
  goal: ResearchGoal;
  factors: FactorInput[];
  k: number;
}): PlanoSugerido[] {
  if (k >= 6) {
    const patch: Partial<DesignConfig> = { designType: "plackett_burman" };
    return [
      {
        rotulo: "recomendado",
        designType: "plackett_burman",
        configPatch: patch,
        nEnsaios: ensaiosDoPatch(patch, factors, 1),
        capacidades: { ...CAP_TRIAGEM_2_NIVEIS },
        porque: `Com ${k} fatores e o objetivo de triagem, o Plackett-Burman separa quais fatores importam usando pouquíssimos ensaios, ideal para uma primeira peneira.`,
      },
    ];
  }
  if (k >= 4) {
    const patch: Partial<DesignConfig> = {
      designType: "fractional_factorial_2kp",
      fractionalMode: "resolution",
      fractionalResolution: 4,
    };
    return [
      {
        rotulo: "recomendado",
        designType: "fractional_factorial_2kp",
        configPatch: patch,
        nEnsaios: ensaiosDoPatch(patch, factors, 1),
        capacidades: { ...CAP_TRIAGEM_2_NIVEIS },
        porque: `Com ${k} fatores e o objetivo de triagem, o fatorial fracionado de resolução IV testa metade (ou menos) das combinações e ainda separa os efeitos principais das interações de 2 fatores.`,
      },
    ];
  }
  const patch: Partial<DesignConfig> = { designType: "full_factorial_2k" };
  return [
    {
      rotulo: "recomendado",
      designType: "full_factorial_2k",
      configPatch: patch,
      nEnsaios: ensaiosDoPatch(patch, factors, 1),
      capacidades: { ...CAP_2K },
      porque: `Com ${k} fatores em 2 níveis e o objetivo de triagem, o fatorial completo 2^${k} testa todas as combinações e já entrega efeitos principais e interações.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Compatibilidade com o consumidor legado (GuidedTour), que ainda não declara
// os níveis de cada fator no formulário — só a contagem e se há qualitativo.
// Sintetiza fatores de 2 níveis (o comportamento de sempre, sem curvatura
// declarada) e delega inteiramente para `recommendPlans`, mantendo uma única
// fonte de regra.
// ---------------------------------------------------------------------------

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

/** Entrada legada de `recommendDesign` (GuidedTour): sem níveis por fator. */
export interface LegacyRecommendInput {
  goal: ResearchGoal;
  nFactors: number;
  hasQualitative: boolean;
}

/** Sintetiza `nFactors` fatores de 2 níveis; o primeiro vira qualitativo
 * quando `hasQualitative`, espelhando o flag booleano legado (que nunca
 * contou quantos fatores qualitativos havia, só se havia algum). */
function fatoresLegado(nFactors: number, hasQualitative: boolean): FactorInput[] {
  const n = Math.max(nFactors, 0);
  return Array.from({ length: n }, (_, i): FactorInput => {
    if (hasQualitative && i === 0) {
      return {
        name: `Fator ${i + 1}`,
        factor_type: "qualitative",
        low_label: "Nível baixo",
        high_label: "Nível alto",
      };
    }
    return { name: `Fator ${i + 1}`, factor_type: "quantitative" };
  });
}

/**
 * Recomenda a família de planejamento a partir das respostas do
 * questionário legado (objetivo, contagem de fatores, tem qualitativo).
 * Devolve o primeiro plano ("recomendado") de `recommendPlans`, traduzido
 * para o formato antigo — nenhum consumidor existente quebra.
 */
export function recommendDesign(
  input: LegacyRecommendInput,
): DesignRecommendation {
  const factors = fatoresLegado(input.nFactors, input.hasQualitative);
  const [primeiro] = recommendPlans({ goal: input.goal, factors });
  return {
    designType: primeiro.designType,
    configPatch: primeiro.configPatch,
    title: TITULOS[primeiro.designType] ?? primeiro.designType,
    why: primeiro.porque,
    caveat: primeiro.indisponivel,
  };
}
