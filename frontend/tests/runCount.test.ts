import { describe, expect, it } from "vitest";
import type { FactorInput, TaguchiArray } from "@/domain/design";
import { defaultDesignConfig, type DesignConfig } from "@/domain/designConfig";
import { contarEnsaios, designBaseRuns } from "@/domain/runCount";

/**
 * Os valores travados abaixo (8, 7, 8, 4, 16, 15, null, 8, 8, 12, 9, 11, 12,
 * null, 8, 9, 9) foram obtidos rodando `designBaseRuns` ANTES desta extração
 * (ainda em components/DesignPicker.tsx), com um teste-rascunho descartado
 * em seguida — não foram inventados. Qualquer mudança neles é uma regressão
 * de contagem de ensaios, não um ajuste de teste.
 */

function config(overrides: Partial<DesignConfig> = {}): DesignConfig {
  return { ...defaultDesignConfig(), ...overrides };
}

/** Fator quantitativo mínimo, só para preencher a contagem de fatores (k). */
function fatoresQuantitativos(n: number): FactorInput[] {
  return Array.from({ length: n }, (_, i) => ({
    name: `F${i + 1}`,
    factor_type: "quantitative" as const,
  }));
}

const FAKE_ARRAYS: TaguchiArray[] = [
  { name: "L8(2^7)", runs: 8, n_columns: 7, level_capacity: { 2: 7 } },
  { name: "L9(3^4)", runs: 9, n_columns: 4, level_capacity: { 3: 4 } },
  {
    name: "L18(2^1 3^7)",
    runs: 18,
    n_columns: 8,
    level_capacity: { 2: 1, 3: 7 },
  },
];

describe("designBaseRuns (valores travados contra o comportamento anterior)", () => {
  it("full_factorial_2k: 2^k + pontos centrais", () => {
    expect(
      designBaseRuns(
        config({ designType: "full_factorial_2k", centerPoints: 0 }),
        3,
      ),
    ).toBe(8);
    expect(
      designBaseRuns(
        config({ designType: "full_factorial_2k", centerPoints: 3 }),
        2,
      ),
    ).toBe(7);
  });

  it("fractional_factorial_2kp por resolução", () => {
    expect(
      designBaseRuns(
        config({
          designType: "fractional_factorial_2kp",
          fractionalMode: "resolution",
          fractionalResolution: 3,
          centerPoints: 0,
        }),
        5,
      ),
    ).toBe(8);
  });

  it("fractional_factorial_2kp por geradores", () => {
    expect(
      designBaseRuns(
        config({
          designType: "fractional_factorial_2kp",
          fractionalMode: "generators",
          fractionalGenerators: "a b ab",
          centerPoints: 0,
        }),
        3,
      ),
    ).toBe(4);
  });

  it("central_composite: 2^k + 2k + centros (fatorial e axial)", () => {
    expect(
      designBaseRuns(config({ designType: "central_composite" }), 2),
    ).toBe(16);
  });

  it("box_behnken: exige k >= 3", () => {
    expect(designBaseRuns(config({ designType: "box_behnken" }), 3)).toBe(15);
    expect(designBaseRuns(config({ designType: "box_behnken" }), 2)).toBeNull();
  });

  it("plackett_burman: próximo múltiplo de 4 estritamente maior que k", () => {
    expect(designBaseRuns(config({ designType: "plackett_burman" }), 6)).toBe(8);
    expect(designBaseRuns(config({ designType: "plackett_burman" }), 7)).toBe(8);
    expect(designBaseRuns(config({ designType: "plackett_burman" }), 8)).toBe(
      12,
    );
  });

  it("dsd: 2k + 1 (+2 por corrida extra)", () => {
    expect(
      designBaseRuns(config({ designType: "dsd", dsdExtraRuns: 0 }), 4),
    ).toBe(9);
    expect(
      designBaseRuns(config({ designType: "dsd", dsdExtraRuns: 1 }), 4),
    ).toBe(11);
  });

  it("optimal: usa optimalNRuns diretamente; < 1 é indeterminado", () => {
    expect(
      designBaseRuns(config({ designType: "optimal", optimalNRuns: 12 }), 4),
    ).toBe(12);
    expect(
      designBaseRuns(config({ designType: "optimal", optimalNRuns: 0 }), 4),
    ).toBeNull();
  });

  it("taguchi: resolve pelo catálogo (automático ou nomeado)", () => {
    expect(
      designBaseRuns(
        config({ designType: "taguchi", taguchiLevels: 2 }),
        3,
        FAKE_ARRAYS,
      ),
    ).toBe(8);
    expect(
      designBaseRuns(
        config({ designType: "taguchi", taguchiLevels: 3 }),
        4,
        FAKE_ARRAYS,
      ),
    ).toBe(9);
    expect(
      designBaseRuns(
        config({
          designType: "taguchi",
          taguchiArray: "L9(3^4)",
          taguchiLevels: 3,
        }),
        4,
        FAKE_ARRAYS,
      ),
    ).toBe(9);
  });

  it("full_factorial_general: indeterminado aqui (não recebe os níveis)", () => {
    expect(
      designBaseRuns(config({ designType: "full_factorial_general" }), 2),
    ).toBeNull();
  });
});

describe("contarEnsaios", () => {
  it("para as famílias já cobertas por designBaseRuns, multiplica pelas réplicas", () => {
    const cfg = config({ designType: "full_factorial_2k", centerPoints: 0 });
    const fatores = fatoresQuantitativos(3);
    expect(contarEnsaios(cfg, fatores, 1)).toBe(8);
    expect(contarEnsaios(cfg, fatores, 3)).toBe(24);
  });

  it("replicates = 1 é uma única execução, não 'zero réplicas extras'", () => {
    const cfg = config({ designType: "box_behnken" });
    const fatores = fatoresQuantitativos(3);
    // A mesma contagem de designBaseRuns (15), sem nenhum acréscimo.
    expect(contarEnsaios(cfg, fatores, 1)).toBe(15);
  });

  it("propaga null quando designBaseRuns não consegue determinar (ex.: Box-Behnken com k<3)", () => {
    const cfg = config({ designType: "box_behnken" });
    expect(contarEnsaios(cfg, fatoresQuantitativos(2), 1)).toBeNull();
  });

  it("full_factorial_general: produto dos níveis declarados por fator", () => {
    const cfg = config({ designType: "full_factorial_general" });
    const fatores: FactorInput[] = [
      { name: "F1", factor_type: "quantitative", levels: [1, 2, 3] }, // 3 níveis
      { name: "F2", factor_type: "quantitative" }, // 2 níveis (sem levels)
    ];
    expect(contarEnsaios(cfg, fatores, 1)).toBe(6); // 3 * 2
    expect(contarEnsaios(cfg, fatores, 3)).toBe(18); // 3 réplicas do mesmo bloco
  });

  it("full_factorial_general com 3 fatores de 3 níveis: 3^3 = 27", () => {
    const cfg = config({ designType: "full_factorial_general" });
    const fatores: FactorInput[] = fatoresQuantitativos(3).map((f) => ({
      ...f,
      levels: [1, 2, 3],
    }));
    expect(contarEnsaios(cfg, fatores, 1)).toBe(27);
  });
});
