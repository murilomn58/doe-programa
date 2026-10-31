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
import { MINIMO_DE_FATORES } from "@/domain/limitesFamilia";
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
  /**
   * Nº de blocos declarados (repetições completas do arranjo sob uma condição
   * conhecida diferente do que o estudo investiga — ver `nBlocos` em
   * domain/design.ts). Default 1 (sem blocagem). Precisa chegar até aqui
   * porque `plano.nEnsaios` tem de ser o TOTAL real, o mesmo que o botão
   * "Gerar matriz" mostra — sem isto, o cartão conta 1 bloco enquanto o botão
   * conta os blocos de fato declarados.
   */
  blocks?: number;
}

export type RotuloPlano = "recomendado" | "economico" | "completo";

export interface PlanoSugerido {
  rotulo: RotuloPlano;
  designType: DesignType;
  /** Patch parcial aplicado sobre o defaultDesignConfig (knobs da família). */
  configPatch: Partial<DesignConfig>;
  /** Fora do DesignConfig: vive como estado irmão no GuidedTour. */
  replicates?: number;
  /** Ensaios já contando blocos, réplicas e pontos centrais (o TOTAL real). */
  nEnsaios: number;
  /**
   * Decomposição do total em blocos × réplicas, para o cartão não refazer
   * conta (ver PlanoCard). Ausente quando há só 1 bloco e 1 réplica — nesse
   * caso não há o que decompor, `nEnsaios` já é a única execução do arranjo.
   */
  decomposicao?: {
    /** Ensaios de UMA execução do arranjo: sem multiplicar blocos nem réplicas. */
    porExecucao: number;
    blocks: number;
    replicates: number;
  };
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
  /**
   * Remédio concreto quando falta alguma capacidade (hoje só erro puro, o
   * caso confirmado): o MESMO tipo `PlanoSugerido`, com o custo em ensaios já
   * calculado, para ser aplicado via `escolherPlano` (GuidedTour) como
   * qualquer outro cartão — nenhum caminho novo.
   */
  remedio?: {
    /** Frase que anuncia o que falta e o custo do remédio, ex.: "Sem erro
     * puro. Duas réplicas dariam isso, em 24 ensaios." */
    texto: string;
    plano: PlanoSugerido;
  };
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

/** Exportado: reaproveitado por PlanoCard para formatar a decomposição. */
export function plural(n: number, singular: string, noPlural: string): string {
  return n === 1 ? singular : noPlural;
}

/**
 * Ensaios de uma réplica (com pontos centrais) × blocos × réplicas — o TOTAL
 * real, a mesma conta que `configParaContagem`/`contarEnsaios` fazem para o
 * botão "Gerar matriz" (ver GuidedTour.tsx). As famílias e os `k` usados por
 * `recommendPlans` sempre têm contagem determinada para k >= 1; devolve 0 no
 * caso patológico k = 0 (tela ainda em edição, com a lista de fatores
 * transitoriamente vazia) em vez de lançar exceção.
 */
function ensaiosDoPatch(
  configPatch: Partial<DesignConfig>,
  factors: FactorInput[],
  replicates: number,
  blocks: number,
): number {
  const config: DesignConfig = { ...defaultDesignConfig(), ...configPatch, blocks };
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
  const { goal, factors, blocks = 1 } = input;
  const k = factors.length;
  const hasQualitative = factors.some((f) => f.factor_type === "qualitative");
  const quantFactors = factors.filter((f) => f.factor_type === "quantitative");
  const maxNiveisQuant =
    quantFactors.length > 0 ? Math.max(...quantFactors.map(nNiveis)) : 2;

  const precisaCurvatura = maxNiveisQuant >= 3 || goal === "optimization";

  const planos = precisaCurvatura
    ? recomendarSuperficie({ goal, factors, k, hasQualitative, maxNiveisQuant, blocks })
    : recomendarTriagem({ goal, factors, k, blocks });

  return planos.map((p) => decorarPlano(p, factors, blocks));
}

/**
 * Decoração final aplicada a TODO plano que sai daqui, no único ponto de
 * saída de `recommendPlans` — nunca espalhada pelas funções que montam cada
 * família, para não haver dois lugares que possam divergir:
 *
 * 1. `interacoes` nunca é `true` com menos de 2 fatores (não existe interação
 *    entre fatores com um fator só, seja qual for a família).
 * 2. Anexa a decomposição (blocos × réplicas) quando há o que decompor.
 * 3. Anexa o remédio de erro puro quando falta essa capacidade: dobrar as
 *    réplicas SEMPRE garante erro puro, então o remédio é sempre aplicável.
 */
function decorarPlano(
  plano: PlanoSugerido,
  factors: FactorInput[],
  blocks: number,
): PlanoSugerido {
  const k = factors.length;
  const capacidades = {
    ...plano.capacidades,
    interacoes: k >= 2 && plano.capacidades.interacoes,
  };
  const comCapacidadesReais: PlanoSugerido = { ...plano, capacidades };
  const comDecomp = comDecomposicao(comCapacidadesReais, factors, blocks);
  return comRemedioErroPuro(comDecomp, factors, blocks);
}

/** Anexa `decomposicao` só quando há mais de 1 bloco ou mais de 1 réplica. */
function comDecomposicao(
  plano: PlanoSugerido,
  factors: FactorInput[],
  blocks: number,
): PlanoSugerido {
  const replicates = plano.replicates ?? 1;
  if (blocks <= 1 && replicates <= 1) return plano;
  const porExecucao = ensaiosDoPatch(plano.configPatch, factors, 1, 1);
  return { ...plano, decomposicao: { porExecucao, blocks, replicates } };
}

/**
 * Remédio concreto para a falta de erro puro (a única capacidade para a qual
 * existe hoje um remédio simples e sempre válido): dobrar as réplicas do
 * MESMO plano. Não se aplica quando o plano já tem erro puro, nem quando já
 * está em 2+ réplicas (dobraria de novo sem necessidade).
 */
function comRemedioErroPuro(
  plano: PlanoSugerido,
  factors: FactorInput[],
  blocks: number,
): PlanoSugerido {
  const replicatesAtual = plano.replicates ?? 1;
  if (plano.capacidades.erroPuro || replicatesAtual >= 2) return plano;

  const replicatesRemedio = 2;
  const nEnsaiosRemedio = ensaiosDoPatch(
    plano.configPatch,
    factors,
    replicatesRemedio,
    blocks,
  );
  const planoRemedio: PlanoSugerido = comDecomposicao(
    {
      ...plano,
      replicates: replicatesRemedio,
      nEnsaios: nEnsaiosRemedio,
      capacidades: { ...plano.capacidades, erroPuro: true },
    },
    factors,
    blocks,
  );

  return {
    ...plano,
    remedio: {
      texto: `Sem erro puro. Duas réplicas dariam isso, em ${nEnsaiosRemedio} ${plural(nEnsaiosRemedio, "ensaio", "ensaios")}.`,
      plano: planoRemedio,
    },
  };
}

function recomendarSuperficie({
  goal,
  factors,
  k,
  hasQualitative,
  maxNiveisQuant,
  blocks,
}: {
  goal: ResearchGoal;
  factors: FactorInput[];
  k: number;
  hasQualitative: boolean;
  maxNiveisQuant: number;
  blocks: number;
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
        nEnsaios: ensaiosDoPatch(patch, factors, 1, blocks),
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

  // Com só 1 fator quantitativo, nem o CCD (mínimo 2) nem o Box-Behnken
  // (mínimo 3) atendem — recomendar CCD aqui foi exatamente o defeito
  // relatado (a vitrine oferecia CCD de 7 ensaios com 1 fator, e o motor
  // recusava ao clicar). A única família de superfície que sobra é o
  // fatorial geral (mínimo 1), o mesmo arranjo que o card de bloco já usa.
  if (k < MINIMO_DE_FATORES.central_composite) {
    return recomendarSuperficieUmFator({ goal, factors, maxNiveisQuant, blocks });
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
  const nEnsaiosCcd = ensaiosDoPatch(ccdPatch, factors, 1, blocks);

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
  if (k >= MINIMO_DE_FATORES.box_behnken && maxNiveisQuant === 3) {
    const patch: Partial<DesignConfig> = { designType: "box_behnken" };
    economico = {
      rotulo: "economico",
      designType: "box_behnken",
      configPatch: patch,
      nEnsaios: ensaiosDoPatch(patch, factors, 1, blocks),
      capacidades: { ...CAP_SUPERFICIE },
      porque: `Com ${k} fatores quantitativos em 3 níveis, o Box-Behnken estima a mesma curvatura do CCD sem levar todos os fatores aos extremos ao mesmo tempo, custando menos ensaios.`,
    };
  } else if (k === 2 && maxNiveisQuant === 3) {
    // Ramo pensado para "dois fatores em três níveis": só nesse caso o
    // fatorial geral 3² pode empatar ou ficar mais barato que o CCD. Com
    // k = 1 este ramo NUNCA é alcançado (o bloco acima já desviou para
    // `recomendarSuperficieUmFator`), mas o `=== 2` documenta a intenção
    // exata em vez do `<= 2` que deixava k = 1 passar por acidente.
    const patchGeral: Partial<DesignConfig> = {
      designType: "full_factorial_general",
    };
    const nEnsaiosGeral = ensaiosDoPatch(patchGeral, factors, 1, blocks);
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
        : fatorial2kComCentros(k, factors, blocks);
  } else {
    economico = fatorial2kComCentros(k, factors, blocks);
  }

  const completo: PlanoSugerido = {
    rotulo: "completo",
    designType: "central_composite",
    configPatch: ccdPatch,
    replicates: 2,
    nEnsaios: ensaiosDoPatch(ccdPatch, factors, 2, blocks),
    capacidades: { ...CAP_SUPERFICIE },
    porque:
      "Repetir o CCD de face centrada em 2 réplicas permite estimar o erro puro e checar a repetibilidade do experimento, ao custo de dobrar os ensaios.",
  };

  return [recomendado, economico, completo];
}

/**
 * Único fator quantitativo em 3+ níveis (ou otimização com 1 fator): a única
 * família de superfície cujo mínimo (1 fator) é atendido é o fatorial geral —
 * o mesmo arranjo do card de bloco (RCBD legítimo com blocos e/ou réplicas).
 * Um só plano, sem econômico nem completo: não há uma segunda família mais
 * barata nem mais completa disponível com 1 fator só. `decorarPlano` ainda
 * anexa o remédio de erro puro quando fizer falta (o caso confirmado: 1
 * fator, 3 níveis, 4 blocos, 1 réplica — nenhuma combinação nível × bloco se
 * repete).
 */
function recomendarSuperficieUmFator({
  goal,
  factors,
  maxNiveisQuant,
  blocks,
}: {
  goal: ResearchGoal;
  factors: FactorInput[];
  maxNiveisQuant: number;
  blocks: number;
}): PlanoSugerido[] {
  const temCurvatura = maxNiveisQuant >= 3;
  const patch: Partial<DesignConfig> = { designType: "full_factorial_general" };
  return [
    {
      rotulo: "recomendado",
      designType: "full_factorial_general",
      configPatch: patch,
      nEnsaios: ensaiosDoPatch(patch, factors, 1, blocks),
      capacidades: {
        detectaCurvatura: temCurvatura,
        curvaturaPorFator: temCurvatura,
        interacoes: true, // decorarPlano zera para k < 2
        erroPuro: false,
        pontoOtimo: temCurvatura,
      },
      porque: `Com só 1 fator declarado, nem o CCD (mínimo 2 fatores) nem o Box-Behnken (mínimo 3) atendem; o fatorial completo em ${maxNiveisQuant} níveis testa cada nível declarado e, combinado com a blocagem, ainda permite ${objetivoTexto(goal)}.`,
    },
  ];
}

/** Fallback econômico padrão: fatorial 2^k com 3 pontos centrais. */
function fatorial2kComCentros(
  k: number,
  factors: FactorInput[],
  blocks: number,
): PlanoSugerido {
  const patch: Partial<DesignConfig> = {
    designType: "full_factorial_2k",
    centerPoints: 3,
  };
  return {
    rotulo: "economico",
    designType: "full_factorial_2k",
    configPatch: patch,
    nEnsaios: ensaiosDoPatch(patch, factors, 1, blocks),
    capacidades: { ...CAP_2K_COM_CENTROS },
    porque: `Como alternativa mais simples, o fatorial 2^${k} com 3 pontos centrais já acusa a curvatura (sem apontar de qual fator) e custa bem menos ensaios que o CCD.`,
  };
}

function recomendarTriagem({
  factors,
  k,
  blocks,
}: {
  goal: ResearchGoal;
  factors: FactorInput[];
  k: number;
  blocks: number;
}): PlanoSugerido[] {
  if (k >= 6) {
    const patch: Partial<DesignConfig> = { designType: "plackett_burman" };
    return [
      {
        rotulo: "recomendado",
        designType: "plackett_burman",
        configPatch: patch,
        nEnsaios: ensaiosDoPatch(patch, factors, 1, blocks),
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
        nEnsaios: ensaiosDoPatch(patch, factors, 1, blocks),
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
      nEnsaios: ensaiosDoPatch(patch, factors, 1, blocks),
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
