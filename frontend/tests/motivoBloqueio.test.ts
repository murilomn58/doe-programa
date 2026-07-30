import { describe, expect, it } from "vitest";

import type { FactorInput } from "@/domain/design";
import { defaultDesignConfig } from "@/domain/designConfig";
import { motivoBloqueio } from "@/containers/GuidedTour";

/**
 * `motivoBloqueio` é a mesma guarda que bloqueia "Gerar matriz" — decorada
 * também nos cartões da vitrine. Antes desta correção só 4 das 9 famílias
 * tinham checagem de mínimo aqui; CCD, fatorial geral, 2^k, fracionado e
 * Taguchi passavam sem checagem nenhuma, e foi assim que o CCD apareceu
 * ofertável com 1 fator só.
 */
function fatoresQuant(n: number): FactorInput[] {
  return Array.from({ length: n }, (_, i) => ({
    name: `F${i + 1}`,
    factor_type: "quantitative" as const,
  }));
}

describe("motivoBloqueio — mínimo de fatores cobre as 9 famílias", () => {
  it("Box-Behnken com 2 fatores aparece indisponível, com o motivo, ANTES de clicar", () => {
    const config = { ...defaultDesignConfig(), designType: "box_behnken" as const };
    const motivo = motivoBloqueio(config, fatoresQuant(2), false);
    expect(motivo).toBe("Um Box-Behnken precisa de pelo menos 3 fatores.");
  });

  it("CCD com 1 fator é bloqueado (o defeito relatado: a vitrine ofereceu CCD com 1 fator)", () => {
    const config = { ...defaultDesignConfig(), designType: "central_composite" as const };
    const motivo = motivoBloqueio(config, fatoresQuant(1), false);
    expect(motivo).toBe("Um CCD precisa de pelo menos 2 fatores.");
  });

  it("fatorial completo 2^k e fatorial geral aceitam 1 fator (RCBD legítimo)", () => {
    const cfg2k = { ...defaultDesignConfig(), designType: "full_factorial_2k" as const };
    const cfgGeral = {
      ...defaultDesignConfig(),
      designType: "full_factorial_general" as const,
    };
    expect(motivoBloqueio(cfg2k, fatoresQuant(1), false)).toBeUndefined();
    expect(motivoBloqueio(cfgGeral, fatoresQuant(1), false)).toBeUndefined();
  });

  it("fracionado, Plackett-Burman, ótimo e DSD bloqueiam com 1 fator, com a frase do motor", () => {
    const casos: Array<[ReturnType<typeof defaultDesignConfig>["designType"], string]> = [
      ["fractional_factorial_2kp", "Um planejamento fracionado precisa de pelo menos 2 fatores."],
      ["plackett_burman", "Um Plackett-Burman precisa de pelo menos 2 fatores."],
      ["optimal", "Um planejamento ótimo precisa de pelo menos 2 fatores."],
      ["dsd", "Um DSD precisa de pelo menos 2 fatores."],
    ];
    for (const [designType, esperado] of casos) {
      const config = { ...defaultDesignConfig(), designType };
      expect(motivoBloqueio(config, fatoresQuant(1), false)).toBe(esperado);
    }
  });

  it("uma vez atendido o mínimo, as guardas que não são de contagem continuam valendo", () => {
    const configFracionadoSemGeradores = {
      ...defaultDesignConfig(),
      designType: "fractional_factorial_2kp" as const,
      fractionalMode: "generators" as const,
      fractionalGenerators: "",
    };
    expect(motivoBloqueio(configFracionadoSemGeradores, fatoresQuant(3), false)).toBe(
      "Defina os geradores da fração antes de escolher este plano.",
    );

    const configCcdComQualitativo = {
      ...defaultDesignConfig(),
      designType: "central_composite" as const,
    };
    expect(motivoBloqueio(configCcdComQualitativo, fatoresQuant(2), true)).toBe(
      "Este arranjo não aceita fator qualitativo; remova ou converta o fator antes de escolher este plano.",
    );
  });
});
