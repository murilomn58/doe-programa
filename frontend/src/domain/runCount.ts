/**
 * Contagem de ensaios (run count) de uma família de planejamento — pura, sem
 * UI. Extraído de components/DesignPicker.tsx: a vitrine de planos
 * (recommend.ts) e o picker avançado precisam exibir a MESMA contagem, e essa
 * lógica não pode morar acoplada à apresentação (o domínio nunca deve
 * importar de um componente React).
 *
 * O design em si (matriz, α exato, aliasing, arranjo Taguchi definitivo) é
 * SEMPRE gerado pelo backend; aqui só espelhamos a contagem combinatória para
 * a UX mostrar o nº de ensaios ao vivo, antes de gerar.
 */

import { nNiveis, type FactorInput, type TaguchiArray } from "@/domain/design";
import { TAGUCHI_AUTO, type DesignConfig } from "@/domain/designConfig";
import { MINIMO_DE_FATORES } from "@/domain/limitesFamilia";

function comb(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  let result = 1;
  for (let i = 0; i < r; i += 1) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

/**
 * Espelha `pyDOE3.fracfact_by_res`: menor nº de fatores-base que comporta
 * `k` fatores na resolução pedida. `null` = fração inexistente (o backend
 * devolveria 422).
 */
export function fractionalBaseFactors(
  k: number,
  resolution: number,
): number | null {
  for (let base = resolution - 1; base < k; base += 1) {
    let capacity = base;
    for (let r = resolution - 1; r <= base; r += 1) {
      capacity += comb(base, r);
    }
    if (capacity >= k) return base;
  }
  return null;
}

/**
 * Nº de fatores-base declarados numa string de geradores pyDOE3 ("a b ab"),
 * ou `null` quando a string não define um design válido para `k` fatores.
 */
export function generatorsBaseFactors(
  generators: string,
  k: number,
): number | null {
  const words = generators.trim().split(/\s+/).filter(Boolean);
  if (words.length !== k) return null;
  if (!words.every((word) => /^-?[a-zA-Z]+$/.test(word))) return null;

  const letters = words.map((word) => word.replace("-", "").toLowerCase());
  const baseLetters = letters.filter((word) => word.length === 1);
  const baseSet = new Set(baseLetters);
  if (baseSet.size === 0 || baseSet.size !== baseLetters.length) return null;
  const allComposedOfBase = letters.every((word) =>
    [...word].every((ch) => baseSet.has(ch)),
  );
  return allComposedOfBase ? baseSet.size : null;
}

/** Próximo múltiplo de 4 estritamente maior que `k` (construção de Hadamard). */
export function plackettBurmanRuns(k: number): number {
  if (k < 1) return 0;
  return Math.floor(k / 4) * 4 + 4;
}

/** Ensaios de um DSD: 2·(fatores) + 1 (+ 2 por corrida extra). */
export function dsdRuns(k: number, extraRuns: number): number {
  if (k < 1) return 0;
  return 2 * k + 1 + 2 * extraRuns;
}

/**
 * Menor arranjo Taguchi (do catálogo) que comporta `k` fatores no nº de
 * `levels` níveis pedido; `null` quando nenhum arranjo do catálogo cabe (ou o
 * catálogo ainda não carregou). Espelha `_auto_select_oa` do backend para o
 * par (níveis→demanda) uniforme usado na UI.
 */
export function resolveTaguchiArray(
  arrays: readonly TaguchiArray[] | undefined,
  k: number,
  levels: number,
): TaguchiArray | null {
  if (!arrays || k < 1) return null;
  const fitting = arrays.filter(
    (a) => (a.level_capacity[levels] ?? 0) >= k,
  );
  if (fitting.length === 0) return null;
  // catálogo já vem ordenado por runs; garante menor por segurança
  return fitting.reduce((best, a) => (a.runs < best.runs ? a : best));
}

/** Ensaios de UMA réplica (inclui pontos centrais); `null` = indeterminado. */
export function designBaseRuns(
  config: DesignConfig,
  factorCount: number,
  taguchiArrays?: readonly TaguchiArray[],
): number | null {
  const k = factorCount;
  if (k < 1) return null;
  switch (config.designType) {
    case "full_factorial_2k":
      return 2 ** k + config.centerPoints;
    case "full_factorial_general":
      // O total é o produto dos níveis declarados em cada fator, e esta
      // assinatura só recebe a contagem de fatores, não a lista de níveis.
      // Indeterminado aqui; `contarEnsaios` (abaixo) calcula o produto, pois
      // recebe os fatores inteiros.
      return null;
    case "fractional_factorial_2kp": {
      if (k < MINIMO_DE_FATORES.fractional_factorial_2kp) return null;
      const base =
        config.fractionalMode === "resolution"
          ? fractionalBaseFactors(k, config.fractionalResolution)
          : generatorsBaseFactors(config.fractionalGenerators, k);
      return base === null ? null : 2 ** base + config.centerPoints;
    }
    case "central_composite":
      return k >= MINIMO_DE_FATORES.central_composite
        ? 2 ** k + 2 * k + config.ccdCenterFactorial + config.ccdCenterAxial
        : null;
    case "box_behnken":
      return k >= MINIMO_DE_FATORES.box_behnken
        ? 2 * k * (k - 1) + config.bbdCenter
        : null;
    case "taguchi": {
      const array =
        config.taguchiArray === TAGUCHI_AUTO
          ? resolveTaguchiArray(taguchiArrays, k, config.taguchiLevels)
          : (taguchiArrays?.find((a) => a.name === config.taguchiArray) ??
            null);
      return array === null ? null : array.runs;
    }
    case "plackett_burman":
      return k >= MINIMO_DE_FATORES.plackett_burman ? plackettBurmanRuns(k) : null;
    case "optimal":
      return k >= MINIMO_DE_FATORES.optimal && config.optimalNRuns >= 1
        ? config.optimalNRuns
        : null;
    case "dsd":
      return k >= MINIMO_DE_FATORES.dsd ? dsdRuns(k, config.dsdExtraRuns) : null;
  }
}

/**
 * Ensaios de uma réplica, agora com acesso aos níveis declarados por fator.
 *
 * Semântica de `replicates` (a mesma já usada em GuidedTour.tsx e no backend
 * `design_service.py`, que faz `for replicate in range(1, replicates + 1)`):
 * o design inteiro — cubo, estrela, arranjo, o que for — é repetido
 * `replicates` vezes; `replicates = 1` é uma única execução, NÃO é "nenhuma
 * réplica". Ou seja, o total de ensaios é sempre `ensaiosDeUmaReplica *
 * replicates`, nunca "base + (replicates - 1) * base" nem outra variação.
 * Este arquivo segue essa mesma convenção.
 *
 * `config.blocks` entra na mesma multiplicação: total = base × blocks ×
 * replicates (espelha `expandir_blocos_e_replicas` do backend). Bloco é
 * repetição do arranjo inteiro sob uma condição conhecida diferente do que o
 * estudo investiga (lote de material, dia de moldagem, tipo de solo);
 * réplica é repetição sob a mesma condição. Esta função é a fonte única que
 * a vitrine de planos e o picker avançado consomem, então a contagem exibida
 * acompanha blocos e réplicas sozinha, sem duplicar a lógica em cada tela.
 */
export function contarEnsaios(
  config: DesignConfig,
  fatores: FactorInput[],
  replicates: number,
  taguchiArrays?: readonly TaguchiArray[],
): number | null {
  const blocks = config.blocks ?? 1;
  if (config.designType === "full_factorial_general") {
    if (fatores.length < MINIMO_DE_FATORES.full_factorial_general) return null;
    const produtoDeNiveis = fatores.reduce((acc, f) => acc * nNiveis(f), 1);
    return produtoDeNiveis * blocks * replicates;
  }
  const base = designBaseRuns(config, fatores.length, taguchiArrays);
  return base === null ? null : base * blocks * replicates;
}
