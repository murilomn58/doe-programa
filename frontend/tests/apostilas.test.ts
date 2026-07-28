import { describe, expect, it } from "vitest";
import { APOSTILAS } from "@/domain/apostilas";

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
});
