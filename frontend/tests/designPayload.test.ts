import { describe, expect, it } from "vitest";
import { defaultDesignConfig } from "@/components/DesignPicker";
import { nNiveis, niveisEquiespacados, type FactorInput } from "@/domain/design";
import {
  buildDesignRequest,
  factorIsValid,
  withTaguchiLevels,
} from "@/domain/designPayload";

/** Fator quantitativo mínimo válido, pronto para receber overrides no teste. */
function fatorQuantitativo(overrides: Partial<FactorInput> = {}): FactorInput {
  return {
    name: "Fibra",
    factor_type: "quantitative",
    low: 2,
    high: 8,
    ...overrides,
  };
}

describe("nNiveis", () => {
  it("devolve 2 quando o fator não declara levels", () => {
    expect(nNiveis(fatorQuantitativo())).toBe(2);
  });

  it("devolve o tamanho de levels quando o fator declara três níveis", () => {
    expect(nNiveis(fatorQuantitativo({ levels: [2, 5, 8] }))).toBe(3);
  });
});

describe("niveisEquiespacados", () => {
  it("com n=3 devolve os extremos e o ponto médio", () => {
    expect(niveisEquiespacados(3, 9, 3)).toEqual([3, 6, 9]);
  });

  it("com n=5 divide o intervalo em quatro passos iguais", () => {
    expect(niveisEquiespacados(3, 9, 5)).toEqual([3, 4.5, 6, 7.5, 9]);
  });

  it("com n=2 devolve só os extremos", () => {
    expect(niveisEquiespacados(3, 9, 2)).toEqual([3, 9]);
  });
});

describe("factorIsValid", () => {
  it("fator de 2 níveis (sem levels) continua válido", () => {
    expect(factorIsValid(fatorQuantitativo())).toBe(true);
  });

  it("fator com levels bem formados (crescente, extremos batendo) é válido", () => {
    expect(factorIsValid(fatorQuantitativo({ levels: [2, 5, 8] }))).toBe(true);
  });

  it("fator com levels fora de ordem crescente é inválido", () => {
    expect(factorIsValid(fatorQuantitativo({ levels: [2, 8, 5] }))).toBe(
      false,
    );
  });

  it("fator com levels não estritamente crescente (repetido) é inválido", () => {
    expect(factorIsValid(fatorQuantitativo({ levels: [2, 5, 5, 8] }))).toBe(
      false,
    );
  });

  it("fator com levels cujo primeiro elemento não bate com low é inválido", () => {
    expect(factorIsValid(fatorQuantitativo({ levels: [3, 5, 8] }))).toBe(
      false,
    );
  });

  it("fator com levels cujo último elemento não bate com high é inválido", () => {
    expect(factorIsValid(fatorQuantitativo({ levels: [2, 5, 7] }))).toBe(
      false,
    );
  });

  it("aceita levels cujos extremos batem com low/high dentro da tolerância numérica", () => {
    const low = 0.1 + 0.2; // 0.30000000000000004 em ponto flutuante
    expect(
      factorIsValid(fatorQuantitativo({ low, high: 8, levels: [0.3, 4, 8] })),
    ).toBe(true);
  });
});

describe("withTaguchiLevels", () => {
  it("respeita levels já declarados e não reinterpola", () => {
    const fator = fatorQuantitativo({ levels: [2, 4, 8] });
    const resultado = withTaguchiLevels(fator, 5);
    expect(resultado.levels).toEqual([2, 4, 8]);
  });

  it("sem levels declarados, continua sintetizando por interpolação", () => {
    const fator = fatorQuantitativo({ low: 2, high: 8 });
    const resultado = withTaguchiLevels(fator, 3);
    expect(resultado.levels).toEqual([2, 5, 8]);
  });

  it("com nLevels <= 2 e sem levels declarados, não adiciona o campo", () => {
    const fator = fatorQuantitativo();
    const resultado = withTaguchiLevels(fator, 2);
    expect(resultado.levels).toBeUndefined();
  });
});

describe("buildDesignRequest", () => {
  it("fator com levels declarados chega ao request com a lista intacta", () => {
    const factors = [fatorQuantitativo({ levels: [2, 4, 6, 8] })];
    const payload = buildDesignRequest({
      name: "Ensaio",
      designConfig: defaultDesignConfig(),
      replicates: 1,
      factors,
      responses: [{ name: "Resistência" }],
    });
    expect(payload.factors[0].levels).toEqual([2, 4, 6, 8]);
  });

  it("fator de 2 níveis (sem levels) sai do request sem o campo levels", () => {
    const factors = [fatorQuantitativo()];
    const payload = buildDesignRequest({
      name: "Ensaio",
      designConfig: defaultDesignConfig(),
      replicates: 1,
      factors,
      responses: [{ name: "Resistência" }],
    });
    expect(payload.factors[0]).not.toHaveProperty("levels");
  });

  it("Taguchi com levels já declarados não reinterpola no request", () => {
    const factors = [fatorQuantitativo({ levels: [2, 4, 8] })];
    const payload = buildDesignRequest({
      name: "Ensaio",
      designConfig: {
        ...defaultDesignConfig(),
        designType: "taguchi",
        taguchiLevels: 5,
      },
      replicates: 1,
      factors,
      responses: [{ name: "Resistência" }],
    });
    expect(payload.factors[0].levels).toEqual([2, 4, 8]);
  });

  it("Taguchi sem levels continua sintetizando como antes (não regride)", () => {
    const factors = [fatorQuantitativo({ low: 2, high: 8 })];
    const payload = buildDesignRequest({
      name: "Ensaio",
      designConfig: {
        ...defaultDesignConfig(),
        designType: "taguchi",
        taguchiLevels: 3,
      },
      replicates: 1,
      factors,
      responses: [{ name: "Resistência" }],
    });
    expect(payload.factors[0].levels).toEqual([2, 5, 8]);
  });

  it("defaultDesignConfig() traz blocks: 1 (um único bloco, comportamento anterior à Task 1)", () => {
    expect(defaultDesignConfig().blocks).toBe(1);
  });

  it("envia blocks do designConfig no request, mesmo quando != 1", () => {
    const factors = [fatorQuantitativo()];
    const payload = buildDesignRequest({
      name: "Ensaio",
      designConfig: { ...defaultDesignConfig(), blocks: 7 },
      replicates: 1,
      factors,
      responses: [{ name: "Resistência" }],
    });
    expect(payload.blocks).toBe(7);
  });

  it("envia blocks: 1 quando o designConfig não foi alterado", () => {
    const factors = [fatorQuantitativo()];
    const payload = buildDesignRequest({
      name: "Ensaio",
      designConfig: defaultDesignConfig(),
      replicates: 1,
      factors,
      responses: [{ name: "Resistência" }],
    });
    expect(payload.blocks).toBe(1);
  });
});
