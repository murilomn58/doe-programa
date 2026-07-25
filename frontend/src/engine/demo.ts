/** Exemplo demo pré-carregado: CCD 2 fatores (superfície de resposta).
 *
 * Baseado no caso da aula (Fibra/Cimento → Resistência): CCD em 2 blocos com
 * réplicas centrais. Os valores foram construídos pra contar a história
 * didática completa: no modelo Linear a FALTA DE AJUSTE acusa (F ≈ 172,
 * p < 0,001) e o assistente sugere o quadrático; no Linear + Quadrático o
 * ajuste fecha (R² ≈ 0,99) com ponto ótimo DENTRO da região. */

import type { GeneratedDesign, RunRead } from "@/domain/design";
import { listExperiments, persistGeneratedDesign } from "@/engine/store";

export const DEMO_NAME = "Exemplo: superfície de resposta (CCD)";

const A = 1.41421356;

// (x1, x2, bloco, resistência) — semente fixa; ver docs/adp/auditoria-aulas-2026-07.md
const DEMO_ROWS: Array<[number, number, number, number]> = [
  [-1, -1, 1, 12.11],
  [1, -1, 1, 14.64],
  [-1, 1, 1, 14.26],
  [1, 1, 1, 19.33],
  [0, 0, 1, 19.32],
  [0, 0, 1, 19.54],
  [0, 0, 1, 20.04],
  [-A, 0, 2, 11.36],
  [A, 0, 2, 17.12],
  [0, -A, 2, 13.88],
  [0, A, 2, 18.73],
  [0, 0, 2, 20.57],
  [0, 0, 2, 20.32],
  [0, 0, 2, 20.69],
];

function toNatural(coded: number): number {
  return 3 + 2 * coded; // Fibra/Cimento: 1% a 5% (centro 3%)
}

function pointType(x1: number, x2: number): number {
  if (x1 === 0 && x2 === 0) return 0; // centro
  if (Math.abs(x1) === 1 && Math.abs(x2) === 1) return 1; // fatorial
  return -1; // axial
}

/** Cria o demo se ainda não existir; retorna o experiment_id. */
export async function seedDemoExperiment(): Promise<number> {
  const existing = (await listExperiments()).find((e) => e.name === DEMO_NAME);
  if (existing) return existing.id;

  const runs: RunRead[] = DEMO_ROWS.map(([x1, x2, block, y], i) => ({
    id: null,
    run_order: i + 1,
    std_order: i + 1,
    point_type: pointType(x1, x2),
    block,
    replicate: 1,
    factors: {
      "Fibra": { coded: x1, natural: toNatural(x1), label: null },
      "Cimento": { coded: x2, natural: toNatural(x2), label: null },
    },
    response_values: { "Resistência": y },
  }));

  const design: GeneratedDesign = {
    experiment_id: 0,
    design_type: "central_composite",
    n_runs: runs.length,
    factors: [
      {
        id: null, name: "Fibra", factor_type: "quantitative", unit: "%", position: 0,
        levels: [
          { coded_value: -1, natural_value: 1, label: null },
          { coded_value: 1, natural_value: 5, label: null },
        ],
      },
      {
        id: null, name: "Cimento", factor_type: "quantitative", unit: "%", position: 1,
        levels: [
          { coded_value: -1, natural_value: 1, label: null },
          { coded_value: 1, natural_value: 5, label: null },
        ],
      },
    ],
    responses: [{ id: null, name: "Resistência", unit: "MPa", position: 0 }],
    runs,
    resolution: null,
    aliasing: null,
    array_name: null,
    optimal_efficiency: null,
  };

  const persisted = await persistGeneratedDesign(design, {
    experimentId: null,
    name: DEMO_NAME,
  });
  return persisted.experiment_id;
}
