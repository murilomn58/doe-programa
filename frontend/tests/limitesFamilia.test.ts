import { describe, expect, it } from "vitest";

import type { DesignType } from "@/domain/design";
import { MINIMO_DE_FATORES, motivoDeMinimo } from "@/domain/limitesFamilia";

/**
 * Espelha `backend/tests/test_minimos_por_familia.py`: as duas tabelas
 * precisam concordar. Este teste trava os valores do lado do frontend; o
 * teste Python trava os mesmos valores do lado do motor.
 */
const MINIMOS_ESPERADOS: Record<DesignType, number> = {
  full_factorial_2k: 1,
  full_factorial_general: 1,
  taguchi: 1,
  fractional_factorial_2kp: 2,
  central_composite: 2,
  plackett_burman: 2,
  optimal: 2,
  dsd: 2,
  box_behnken: 3,
};

describe("MINIMO_DE_FATORES", () => {
  it("bate com a tabela travada (espelho de test_minimos_por_familia.py)", () => {
    expect(MINIMO_DE_FATORES).toEqual(MINIMOS_ESPERADOS);
  });
});

describe("motivoDeMinimo", () => {
  it("undefined quando k atende o mínimo, para as 9 famílias", () => {
    for (const [designType, minimo] of Object.entries(MINIMOS_ESPERADOS) as [
      DesignType,
      number,
    ][]) {
      expect(motivoDeMinimo(designType, minimo)).toBeUndefined();
      expect(motivoDeMinimo(designType, minimo + 5)).toBeUndefined();
    }
  });

  it("devolve a frase EXATA que o motor Python emite quando k fica abaixo do mínimo", () => {
    expect(motivoDeMinimo("fractional_factorial_2kp", 1)).toBe(
      "Um planejamento fracionado precisa de pelo menos 2 fatores.",
    );
    expect(motivoDeMinimo("central_composite", 1)).toBe(
      "Um CCD precisa de pelo menos 2 fatores.",
    );
    expect(motivoDeMinimo("box_behnken", 2)).toBe(
      "Um Box-Behnken precisa de pelo menos 3 fatores.",
    );
    expect(motivoDeMinimo("plackett_burman", 1)).toBe(
      "Um Plackett-Burman precisa de pelo menos 2 fatores.",
    );
    expect(motivoDeMinimo("optimal", 1)).toBe(
      "Um planejamento ótimo precisa de pelo menos 2 fatores.",
    );
    expect(motivoDeMinimo("dsd", 1)).toBe("Um DSD precisa de pelo menos 2 fatores.");
  });

  it("as famílias de mínimo 1 (full_factorial_2k, full_factorial_general, taguchi) aceitam k=1", () => {
    expect(motivoDeMinimo("full_factorial_2k", 1)).toBeUndefined();
    expect(motivoDeMinimo("full_factorial_general", 1)).toBeUndefined();
    expect(motivoDeMinimo("taguchi", 1)).toBeUndefined();
  });
});
