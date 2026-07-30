/**
 * Exemplo pronto: o experimento do Tanabe, solo-cimento-rejeito.
 *
 * Cimento e rejeito em TRÊS níveis cada, sete tipos de solo como BLOCO. O tipo
 * de solo não é objeto do estudo: é fonte de variação conhecida, e tratá-lo
 * como bloco tira a variação entre solos da estimativa de erro em vez de
 * deixá-la mascarar o efeito dos teores. Como fator qualitativo seria
 * impossível de declarar, porque a plataforma aceita duas categorias.
 *
 * Três níveis, e não dois, porque a pergunta é qual o teor ótimo. Com dois
 * níveis o experimento só diria se a resposta sobe ou desce; o termo
 * quadrático, que localiza um máximo interior, exige um nível intermediário.
 *
 * O experimento AINDA NÃO FOI RODADO: a matriz vem sem resposta medida, para
 * o pesquisador preencher. Nada aqui é resultado, e por isso não há gráfico
 * de análise: inventar número e exibir sob o nome de uma pessoa real seria
 * confundido com achado dela.
 *
 * Gerado por `exemplos_site/tanabe/gerar_planejamento.py` a partir do MESMO
 * motor que a plataforma usa, com semente fixa 20260729. Para regerar, rode o
 * script; não edite as linhas à mão.
 */

import type * as D from "@/domain/design";
import { listExperiments, persistGeneratedDesign } from "@/engine/store";

export const TANABE_NOME = "Exemplo: solo-cimento-rejeito em 7 blocos (Tanabe)";

/** Os sete solos, na ordem: o primeiro é o bloco 1. */
const SOLOS = [
  "Residual",
  "Laterítico",
  "Saprolítico",
  "Aluvionar",
  "Orgânico",
  "Arenoso",
  "Siltoso",
];

// [ordem de execução, ordem padrão, bloco, cimento codificado, rejeito
//  codificado, cimento %, rejeito %]
const LINHAS: Array<[number, number, number, number, number, number, number]> = [
  [1, 9, 1, 1, 1, 10, 40],
  [2, 44, 5, 0, 1, 5, 40],
  [3, 63, 7, 1, 1, 10, 40],
  [4, 45, 5, 1, 1, 10, 40],
  [5, 26, 3, 0, 1, 5, 40],
  [6, 46, 6, -1, -1, 0, 0],
  [7, 3, 1, 1, -1, 10, 0],
  [8, 30, 4, 1, -1, 10, 0],
  [9, 53, 6, 0, 1, 5, 40],
  [10, 15, 2, 1, 0, 10, 20],
  [11, 55, 7, -1, -1, 0, 0],
  [12, 17, 2, 0, 1, 5, 40],
  [13, 27, 3, 1, 1, 10, 40],
  [14, 40, 5, -1, 0, 0, 20],
  [15, 18, 2, 1, 1, 10, 40],
  [16, 51, 6, 1, 0, 10, 20],
  [17, 33, 4, 1, 0, 10, 20],
  [18, 52, 6, -1, 1, 0, 40],
  [19, 8, 1, 0, 1, 5, 40],
  [20, 14, 2, 0, 0, 5, 20],
  [21, 56, 7, 0, -1, 5, 0],
  [22, 21, 3, 1, -1, 10, 0],
  [23, 34, 4, -1, 1, 0, 40],
  [24, 41, 5, 0, 0, 5, 20],
  [25, 6, 1, 1, 0, 10, 20],
  [26, 7, 1, -1, 1, 0, 40],
  [27, 13, 2, -1, 0, 0, 20],
  [28, 19, 3, -1, -1, 0, 0],
  [29, 35, 4, 0, 1, 5, 40],
  [30, 16, 2, -1, 1, 0, 40],
  [31, 39, 5, 1, -1, 10, 0],
  [32, 31, 4, -1, 0, 0, 20],
  [33, 48, 6, 1, -1, 10, 0],
  [34, 10, 2, -1, -1, 0, 0],
  [35, 47, 6, 0, -1, 5, 0],
  [36, 2, 1, 0, -1, 5, 0],
  [37, 12, 2, 1, -1, 10, 0],
  [38, 42, 5, 1, 0, 10, 20],
  [39, 36, 4, 1, 1, 10, 40],
  [40, 54, 6, 1, 1, 10, 40],
  [41, 28, 4, -1, -1, 0, 0],
  [42, 24, 3, 1, 0, 10, 20],
  [43, 29, 4, 0, -1, 5, 0],
  [44, 1, 1, -1, -1, 0, 0],
  [45, 23, 3, 0, 0, 5, 20],
  [46, 60, 7, 1, 0, 10, 20],
  [47, 32, 4, 0, 0, 5, 20],
  [48, 11, 2, 0, -1, 5, 0],
  [49, 49, 6, -1, 0, 0, 20],
  [50, 59, 7, 0, 0, 5, 20],
  [51, 20, 3, 0, -1, 5, 0],
  [52, 38, 5, 0, -1, 5, 0],
  [53, 61, 7, -1, 1, 0, 40],
  [54, 50, 6, 0, 0, 5, 20],
  [55, 57, 7, 1, -1, 10, 0],
  [56, 25, 3, -1, 1, 0, 40],
  [57, 58, 7, -1, 0, 0, 20],
  [58, 43, 5, -1, 1, 0, 40],
  [59, 22, 3, -1, 0, 0, 20],
  [60, 37, 5, -1, -1, 0, 0],
  [61, 62, 7, 0, 1, 5, 40],
  [62, 4, 1, -1, 0, 0, 20],
  [63, 5, 1, 0, 0, 5, 20],
];

/** Cria o exemplo se ainda não existir; devolve o `experiment_id`. */
export async function seedExemploTanabe(): Promise<number> {
  const existente = (await listExperiments()).find((e) => e.name === TANABE_NOME);
  if (existente) return existente.id;

  const runs: D.RunRead[] = LINHAS.map(
    ([ordem, std, bloco, cimCod, rejCod, cim, rej]) => ({
      id: null,
      run_order: ordem,
      std_order: std,
      // Ponto central do 3² é o par (0, 0); os demais são fatoriais. Nunca
      // axial: um fatorial geral não tem braço axial, e classificá-lo assim
      // contaminaria o agrupamento de erro puro na ANOVA.
      point_type: cimCod === 0 && rejCod === 0 ? 0 : 1,
      block: bloco,
      replicate: 1,
      factors: {
        Cimento: { coded: cimCod, natural: cim, label: null },
        Rejeito: { coded: rejCod, natural: rej, label: null },
      },
      // Vazio de propósito: o experimento ainda não foi rodado.
      response_values: { "Módulo de resiliência": null },
    }),
  );

  const design: D.GeneratedDesign = {
    experiment_id: 0,
    design_type: "full_factorial_general",
    n_runs: runs.length,
    factors: [
      {
        id: null,
        name: "Cimento",
        factor_type: "quantitative",
        unit: "%",
        position: 0,
        levels: [
          { coded_value: -1, natural_value: 0, label: null },
          { coded_value: 0, natural_value: 5, label: null },
          { coded_value: 1, natural_value: 10, label: null },
        ],
      },
      {
        id: null,
        name: "Rejeito",
        factor_type: "quantitative",
        unit: "%",
        position: 1,
        levels: [
          { coded_value: -1, natural_value: 0, label: null },
          { coded_value: 0, natural_value: 20, label: null },
          { coded_value: 1, natural_value: 40, label: null },
        ],
      },
    ],
    responses: [
      { id: null, name: "Módulo de resiliência", unit: "MPa", position: 0 },
    ],
    runs,
    resolution: null,
    aliasing: null,
    block_labels: SOLOS,
    block_name: "Tipo de solo",
    array_name: null,
    optimal_efficiency: null,
  };

  const persistido = await persistGeneratedDesign(design, {
    experimentId: null,
    name: TANABE_NOME,
  });
  return persistido.experiment_id;
}
