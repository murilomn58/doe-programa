import { describe, expect, it } from "vitest";
import { APOSTILAS, totalDePaginas } from "@/domain/apostilas";

describe("catálogo de apostilas", () => {
  it("tem os cinco cadernos, numerados de 1 a 5", () => {
    expect(APOSTILAS).toHaveLength(5);
    expect(APOSTILAS.map((a) => a.numero)).toEqual([1, 2, 3, 4, 5]);
  });

  it("usa slugs únicos em kebab-case", () => {
    const slugs = APOSTILAS.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(5);
    slugs.forEach((s) => expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
  });

  it("descreve cada caderno e aponta o PDF", () => {
    APOSTILAS.forEach((a) => {
      expect(a.resumo.length).toBeGreaterThan(10);
      expect(a.topicos.length).toBeGreaterThanOrEqual(3);
      expect(a.pdf).toBe(`/conteudo/pdf/${a.slug}.pdf`);
    });
  });

  it("declara páginas plausíveis, vindas da compilação real", () => {
    // O campo é preenchido pela saída de apostilas/build.ps1. Um caderno com
    // zero páginas, fração ou uma centena delas indica valor estimado a olho,
    // que foi exatamente o defeito anterior: 102 declaradas contra 66 reais.
    APOSTILAS.forEach((a) => {
      expect(Number.isInteger(a.paginas)).toBe(true);
      expect(a.paginas).toBeGreaterThanOrEqual(8);
      expect(a.paginas).toBeLessThanOrEqual(40);
    });
  });

  it("deriva o total de páginas do catálogo, sem literal em tela", () => {
    const somaManual = APOSTILAS.reduce((soma, a) => soma + a.paginas, 0);
    expect(totalDePaginas()).toBe(somaManual);
  });
});
