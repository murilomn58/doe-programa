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
function configDoPlano(plano: PlanoSugerido): DesignConfig {
  return { ...defaultDesignConfig(), ...plano.configPatch };
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
});
