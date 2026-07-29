import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RunsGrid } from "@/components/RunsGrid";
import type { FactorRead, ResponseRead, RunRead } from "@/domain/design";

/** Fator quantitativo mínimo só pra popular as colunas de fator da grid. */
function fator(): FactorRead {
  return {
    id: 1,
    name: "Cimento",
    factor_type: "quantitative",
    unit: "%",
    position: 0,
    levels: [
      { coded_value: -1, natural_value: 3, label: null },
      { coded_value: 1, natural_value: 9, label: null },
    ],
  };
}

function resposta(): ResponseRead {
  return { id: 1, name: "MR", unit: "MPa", position: 0 };
}

function run(overrides: Partial<RunRead> = {}): RunRead {
  return {
    id: 1,
    run_order: 1,
    std_order: 1,
    point_type: 0,
    block: 3,
    replicate: 1,
    factors: { Cimento: { coded: -1, natural: 3, label: null } },
    response_values: {},
    ...overrides,
  };
}

const noop = vi.fn();

describe("RunsGrid — coluna de bloco", () => {
  it("sem block_labels mostra o número do bloco e o cabeçalho Blk (comportamento atual)", () => {
    render(
      <RunsGrid
        factors={[fator()]}
        responses={[resposta()]}
        runs={[run({ block: 3 })]}
        onSave={noop}
        isSaving={false}
        saveError={null}
        savedAt={null}
      />,
    );

    expect(screen.getByText("Blk")).toBeInTheDocument();
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.queryByText("Laterita")).not.toBeInTheDocument();
  });

  it("com block_labels mostra o nome do bloco em vez do número", () => {
    render(
      <RunsGrid
        factors={[fator()]}
        responses={[resposta()]}
        runs={[run({ block: 3 })]}
        onSave={noop}
        isSaving={false}
        saveError={null}
        savedAt={null}
        blockLabels={["Arenoso", "Argiloso", "Laterita"]}
        blockName="Tipo de solo"
      />,
    );

    expect(screen.getByText("Tipo de solo")).toBeInTheDocument();
    expect(screen.getByText("Laterita")).toBeInTheDocument();
    expect(screen.queryByText("Blk")).not.toBeInTheDocument();
  });
});
