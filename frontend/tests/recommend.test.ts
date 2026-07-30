import { describe, expect, it } from "vitest";
import type { FactorInput } from "@/domain/design";
import { defaultDesignConfig, type DesignConfig } from "@/domain/designConfig";
import { contarEnsaios } from "@/domain/runCount";
import {
  recommendDesign,
  recommendPlans,
  type PlanoSugerido,
  type RecommendInput,
} from "@/domain/recommend";

/** Fator quantitativo de 2 níveis (sem `levels`), o caso mais comum. */
function fatorQuant2Niveis(nome: string): FactorInput {
  return { name: nome, factor_type: "quantitative" };
}

/** Fator quantitativo declarando `n` níveis igualmente espaçados. */
function fatorQuantNNiveis(nome: string, n: number): FactorInput {
  const levels = Array.from({ length: n }, (_, i) => i + 1);
  return { name: nome, factor_type: "quantitative", low: 1, high: n, levels };
}

function fatorQualitativo(nome: string): FactorInput {
  return {
    name: nome,
    factor_type: "qualitative",
    low_label: "Baixo",
    high_label: "Alto",
  };
}

function fatoresQuant2Niveis(n: number): FactorInput[] {
  return Array.from({ length: n }, (_, i) => fatorQuant2Niveis(`F${i + 1}`));
}

function fatoresQuantNNiveis(k: number, niveis: number): FactorInput[] {
  return Array.from({ length: k }, (_, i) =>
    fatorQuantNNiveis(`F${i + 1}`, niveis),
  );
}

/** Reconstrói o DesignConfig completo de um plano para conferir `nEnsaios`. */
function configDoPlano(plano: PlanoSugerido, blocks = 1): DesignConfig {
  return { ...defaultDesignConfig(), ...plano.configPatch, blocks };
}

describe("recommendPlans — triagem (2 níveis)", () => {
  it("poucos fatores (< 4) levam ao fatorial completo 2^k", () => {
    const input: RecommendInput = {
      goal: "screening",
      factors: fatoresQuant2Niveis(3),
    };
    const planos = recommendPlans(input);
    expect(planos).toHaveLength(1);
    expect(planos[0].rotulo).toBe("recomendado");
    expect(planos[0].designType).toBe("full_factorial_2k");
    expect(planos[0].porque).toContain("3");
  });

  it("4 a 5 fatores levam ao fracionado de resolução IV", () => {
    const planos = recommendPlans({
      goal: "screening",
      factors: fatoresQuant2Niveis(4),
    });
    expect(planos).toHaveLength(1);
    expect(planos[0].designType).toBe("fractional_factorial_2kp");
    expect(planos[0].configPatch.fractionalResolution).toBe(4);
  });

  it("6 ou mais fatores levam ao Plackett-Burman", () => {
    const planos = recommendPlans({
      goal: "screening",
      factors: fatoresQuant2Niveis(6),
    });
    expect(planos).toHaveLength(1);
    expect(planos[0].designType).toBe("plackett_burman");
  });
});

describe("recommendPlans — curvatura (3+ níveis ou otimização)", () => {
  it("3 níveis declarados e otimização levam ao CCD de face centrada, nunca ao rotável", () => {
    const planos = recommendPlans({
      goal: "optimization",
      factors: fatoresQuantNNiveis(2, 3),
    });
    const recomendado = planos.find((p) => p.rotulo === "recomendado")!;
    expect(recomendado.designType).toBe("central_composite");
    expect(recomendado.configPatch.ccdVariant).toBe("face_centered");
    expect(recomendado.configPatch.ccdVariant).not.toBe("rotatable");
    // Nenhum plano da lista pode recair no rotável, em nenhuma hipótese.
    for (const p of planos) {
      expect(p.configPatch.ccdVariant).not.toBe("rotatable");
    }
  });

  it("otimização com apenas 2 níveis declarados também leva à face centrada", () => {
    const planos = recommendPlans({
      goal: "optimization",
      factors: fatoresQuant2Niveis(3),
    });
    const recomendado = planos.find((p) => p.rotulo === "recomendado")!;
    expect(recomendado.designType).toBe("central_composite");
    expect(recomendado.configPatch.ccdVariant).toBe("face_centered");
    expect(recomendado.porque).toContain("2 níveis");
  });

  it("3 fatores em 3 níveis trazem Box-Behnken como econômico", () => {
    const planos = recommendPlans({
      goal: "optimization",
      factors: fatoresQuantNNiveis(3, 3),
    });
    const economico = planos.find((p) => p.rotulo === "economico")!;
    expect(economico.designType).toBe("box_behnken");
  });

  it("2 fatores em 3 níveis trazem o fatorial geral 3² como econômico", () => {
    const planos = recommendPlans({
      goal: "optimization",
      factors: fatoresQuantNNiveis(2, 3),
    });
    const economico = planos.find((p) => p.rotulo === "economico")!;
    expect(economico.designType).toBe("full_factorial_general");
    expect(economico.nEnsaios).toBe(9); // 3^2
  });

  it("5 níveis declarados: o CCD recomendado avisa que só usa 3 (mín, centro, máx)", () => {
    const planos = recommendPlans({
      goal: "optimization",
      factors: fatoresQuantNNiveis(2, 5),
    });
    const recomendado = planos.find((p) => p.rotulo === "recomendado")!;
    expect(recomendado.designType).toBe("central_composite");
    expect(recomendado.porque).toContain("5 níveis");
    expect(recomendado.porque).toContain("três dos níveis declarados");
    // Com 5 níveis e só 2 fatores, o econômico NÃO deve ser o fatorial geral
    // 5² (25 ensaios): cai no fatorial 2^k + 3 centros, mais barato.
    const economico = planos.find((p) => p.rotulo === "economico")!;
    expect(economico.designType).toBe("full_factorial_2k");
  });

  it("o plano completo carrega replicates: 2 e o mesmo designType do recomendado", () => {
    const planos = recommendPlans({
      goal: "optimization",
      factors: fatoresQuantNNiveis(2, 3),
    });
    const completo = planos.find((p) => p.rotulo === "completo")!;
    expect(completo.replicates).toBe(2);
    expect(completo.designType).toBe("central_composite");
    expect(completo.configPatch.ccdVariant).toBe("face_centered");
  });

  it("fator qualitativo no meio da curvatura leva ao fatorial geral misto, com ressalva", () => {
    const planos = recommendPlans({
      goal: "optimization",
      factors: [fatorQuantNNiveis("Fibra", 3), fatorQualitativo("Tipo")],
    });
    expect(planos).toHaveLength(1);
    expect(planos[0].designType).toBe("full_factorial_general");
    expect(planos[0].porque).toContain("qualitativo");
    expect(planos[0].capacidades.pontoOtimo).toBe(false);
  });
});

describe("recommendPlans — invariantes gerais", () => {
  it("a lista tem sempre entre 1 e 3 planos, com rótulos únicos", () => {
    const cenarios: RecommendInput[] = [
      { goal: "screening", factors: fatoresQuant2Niveis(2) },
      { goal: "screening", factors: fatoresQuant2Niveis(5) },
      { goal: "screening", factors: fatoresQuant2Niveis(8) },
      { goal: "optimization", factors: fatoresQuantNNiveis(2, 3) },
      { goal: "optimization", factors: fatoresQuantNNiveis(4, 3) },
      { goal: "optimization", factors: fatoresQuantNNiveis(2, 5) },
    ];
    for (const cenario of cenarios) {
      const planos = recommendPlans(cenario);
      expect(planos.length).toBeGreaterThanOrEqual(1);
      expect(planos.length).toBeLessThanOrEqual(3);
      const rotulos = planos.map((p) => p.rotulo);
      expect(new Set(rotulos).size).toBe(rotulos.length);
      // O econômico (quando existe) nunca repete a família do recomendado —
      // o completo É a mesma família do recomendado por definição (replica o
      // CCD), então essa checagem vale só para o par recomendado/econômico.
      const recomendado = planos.find((p) => p.rotulo === "recomendado");
      const economico = planos.find((p) => p.rotulo === "economico");
      if (recomendado && economico) {
        expect(economico.designType).not.toBe(recomendado.designType);
      }
    }
  });

  it("nEnsaios de cada plano bate com contarEnsaios sobre o mesmo config/réplicas", () => {
    const factors = fatoresQuantNNiveis(3, 3);
    const planos = recommendPlans({ goal: "optimization", factors });
    for (const plano of planos) {
      const esperado = contarEnsaios(
        configDoPlano(plano),
        factors,
        plano.replicates ?? 1,
      );
      expect(plano.nEnsaios).toBe(esperado);
    }
  });

  it("recommendDesign devolve o primeiro plano de recommendPlans (mesma família e mesmo motivo)", () => {
    // Cenário equivalente ao legado: 6 fatores, 2 níveis, triagem.
    const legado = recommendDesign({
      goal: "screening",
      nFactors: 6,
      hasQualitative: false,
    });
    const [primeiro] = recommendPlans({
      goal: "screening",
      factors: fatoresQuant2Niveis(6),
    });
    expect(legado.designType).toBe(primeiro.designType);
    expect(legado.configPatch).toEqual(primeiro.configPatch);
    expect(legado.why).toBe(primeiro.porque);
  });

  it("recommendDesign (legado) também nunca recomenda o CCD rotável", () => {
    const legado = recommendDesign({
      goal: "optimization",
      nFactors: 2,
      hasQualitative: false,
    });
    expect(legado.designType).toBe("central_composite");
    expect(legado.configPatch.ccdVariant).toBe("face_centered");
  });

  it("usa três pontos centrais no CCD, não os 4 + 4 do formulário", () => {
    // O padrão 4 + 4 é o de um CCD blocado. Sem blocagem ele infla o arranjo:
    // em 2 fatores o CCD de face centrada tem a mesma geometria do fatorial 3²,
    // então 16 ensaios entregariam o mesmo modelo que 9 entregam.
    const [recomendado] = recommendPlans({
      goal: "optimization",
      factors: [fatorQuantNNiveis("A", 3), fatorQuantNNiveis("B", 3)],
    });
    expect(recomendado.designType).toBe("central_composite");
    const centrais =
      (recomendado.configPatch.ccdCenterFactorial ?? 0) +
      (recomendado.configPatch.ccdCenterAxial ?? 0);
    expect(centrais).toBe(3);
  });

  it("o plano recomendado não custa muito mais que o econômico", () => {
    // Um mestrando que vê o recomendado custar quase o dobro do econômico, para
    // o mesmo modelo, conclui com razão que a recomendação está errada. O CCD
    // só se justifica pelos graus de liberdade de erro puro que os pontos
    // centrais dão, e isso tem de caber em poucos ensaios a mais.
    for (const k of [2, 3, 4]) {
      const planos = recommendPlans({
        goal: "optimization",
        factors: Array.from({ length: k }, (_, i) =>
          fatorQuantNNiveis(`F${i + 1}`, 3),
        ),
      });
      const recomendado = planos.find((p) => p.rotulo === "recomendado");
      const economico = planos.find((p) => p.rotulo === "economico");
      if (!recomendado || !economico || economico.indisponivel) continue;
      expect(recomendado.nEnsaios).toBeLessThanOrEqual(
        economico.nEnsaios * 1.35,
      );
    }
  });
});

describe("recommendPlans — caso real: 1 fator, 3 níveis, 4 blocos (o bug de produção)", () => {
  // O pesquisador declarou um bloco de 4 categorias (Tucum, Piassava, Buriti,
  // Juta) e 1 fator quantitativo (% de fibra) em 3 níveis. O card do bloco e
  // o botão "Gerar matriz" já calculavam certo: 3 x 4 = 12 ensaios. A vitrine
  // oferecia CCD de 7 ensaios, fatorial geral de 3 ensaios e CCD com 2
  // réplicas de 14 ensaios — nenhum batendo com os 12 do botão, e o CCD nem
  // gerava (motor recusa CCD com 1 fator).
  const factors = [fatorQuantNNiveis("Fibra", 3)];

  it("o único plano proposto é o fatorial geral (o CCD exige mínimo 2 fatores)", () => {
    const planos = recommendPlans({ goal: "optimization", factors, blocks: 4 });
    expect(planos).toHaveLength(1);
    expect(planos[0].designType).toBe("full_factorial_general");
    expect(planos[0].rotulo).toBe("recomendado");
  });

  it("nEnsaios é 12 (3 níveis x 4 blocos), o mesmo total do botão Gerar matriz", () => {
    const [plano] = recommendPlans({ goal: "optimization", factors, blocks: 4 });
    expect(plano.nEnsaios).toBe(12);
    expect(plano.nEnsaios).toBe(
      contarEnsaios(configDoPlano(plano, 4), factors, plano.replicates ?? 1),
    );
  });

  it("a decomposição é 3 por execução x 4 blocos", () => {
    const [plano] = recommendPlans({ goal: "optimization", factors, blocks: 4 });
    expect(plano.decomposicao).toEqual({ porExecucao: 3, blocks: 4, replicates: 1 });
  });

  it("capacidades batem com o confirmado: curvatura por fator sim, interações não, erro puro não, ponto ótimo sim", () => {
    const [plano] = recommendPlans({ goal: "optimization", factors, blocks: 4 });
    expect(plano.capacidades.detectaCurvatura).toBe(true);
    expect(plano.capacidades.curvaturaPorFator).toBe(true);
    expect(plano.capacidades.interacoes).toBe(false);
    expect(plano.capacidades.erroPuro).toBe(false);
    expect(plano.capacidades.pontoOtimo).toBe(true);
  });

  it("o remédio de erro puro anuncia 24 ensaios (dobrar réplicas)", () => {
    const [plano] = recommendPlans({ goal: "optimization", factors, blocks: 4 });
    expect(plano.remedio).toBeDefined();
    expect(plano.remedio!.texto).toBe(
      "Sem erro puro. Duas réplicas dariam isso, em 24 ensaios.",
    );
    expect(plano.remedio!.plano.nEnsaios).toBe(24);
    expect(plano.remedio!.plano.capacidades.erroPuro).toBe(true);
    expect(plano.remedio!.plano.replicates).toBe(2);
  });
});

describe("recommendPlans — k = 1 nunca propõe família com mínimo maior que 1", () => {
  it("nenhum plano proposto (triagem ou superfície) tem mínimo de fatores > 1", () => {
    const cenarios: RecommendInput[] = [
      { goal: "screening", factors: fatoresQuant2Niveis(1) },
      { goal: "optimization", factors: fatoresQuant2Niveis(1) },
      { goal: "optimization", factors: fatoresQuantNNiveis(1, 3) },
      { goal: "optimization", factors: fatoresQuantNNiveis(1, 3), blocks: 4 },
      { goal: "optimization", factors: [fatorQualitativo("Solo")] },
    ];
    for (const cenario of cenarios) {
      const planos = recommendPlans(cenario);
      for (const plano of planos) {
        expect(["full_factorial_2k", "full_factorial_general", "taguchi"]).toContain(
          plano.designType,
        );
      }
    }
  });

  it("nenhum cartão com 1 fator promete interações entre fatores", () => {
    const planos = recommendPlans({
      goal: "optimization",
      factors: fatoresQuantNNiveis(1, 3),
      blocks: 4,
    });
    for (const plano of planos) {
      expect(plano.capacidades.interacoes).toBe(false);
    }
  });
});

describe("recommendPlans — invariante: nEnsaios bate SEMPRE com contarEnsaios (matriz de cenários)", () => {
  it("1 e 2 fatores x 2 e 3 níveis x 1 e 4 blocos: cada cartão aplica o total que o próprio configPatch/replicates produzem", () => {
    const goals: RecommendInput["goal"][] = ["screening", "optimization"];
    for (const goal of goals) {
      for (const nFatores of [1, 2]) {
        for (const niveis of [2, 3]) {
          for (const blocks of [1, 4]) {
            const factors =
              niveis === 2
                ? fatoresQuant2Niveis(nFatores)
                : fatoresQuantNNiveis(nFatores, niveis);
            const planos = recommendPlans({ goal, factors, blocks });
            for (const plano of planos) {
              const esperado = contarEnsaios(
                configDoPlano(plano, blocks),
                factors,
                plano.replicates ?? 1,
              );
              expect(plano.nEnsaios).toBe(esperado);
              // O remédio (quando existe) é igualmente um PlanoSugerido: a
              // mesma invariante vale para ele, senão o botão "Aplicar
              // réplicas" prometeria um total que o motor não entregaria.
              if (plano.remedio) {
                const esperadoRemedio = contarEnsaios(
                  configDoPlano(plano.remedio.plano, blocks),
                  factors,
                  plano.remedio.plano.replicates ?? 1,
                );
                expect(plano.remedio.plano.nEnsaios).toBe(esperadoRemedio);
              }
            }
          }
        }
      }
    }
  });
});
