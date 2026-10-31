import { useState } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FactorForm } from "@/components/FactorForm";
import type { FactorInput } from "@/domain/design";

/**
 * Casca de teste que guarda a LISTA de fatores em estado próprio, como o
 * GuidedTour faz: o FactorForm é controlado e não duplica o estado.
 */
function ControlledHarness({ initial }: { initial: FactorInput[] }) {
  const [factors, setFactors] = useState(initial);
  return (
    <FactorForm
      factors={factors}
      onChange={(index, factor) =>
        setFactors((prev) => prev.map((f, i) => (i === index ? factor : f)))
      }
      onAdd={() => setFactors((prev) => [...prev, { name: "", factor_type: "quantitative" }])}
      onRemove={(index) => setFactors((prev) => prev.filter((_, i) => i !== index))}
    />
  );
}

function fatorQuantitativo(overrides: Partial<FactorInput> = {}): FactorInput {
  return {
    name: "Cimento",
    factor_type: "quantitative",
    low: 3,
    high: 9,
    ...overrides,
  };
}

describe("FactorForm — seletor de papel no experimento", () => {
  it("escolher Bloco revela a lista de categorias com duas entradas vazias", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initial={[fatorQuantitativo({ name: "Tipo de solo" })]} />);

    await user.selectOptions(
      screen.getByLabelText("Papel no experimento"),
      "bloco",
    );

    expect(screen.getByLabelText("Bloco 1")).toHaveValue("");
    expect(screen.getByLabelText("Bloco 2")).toHaveValue("");
  });

  it("acrescentar categoria aumenta a contagem de blocos", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initial={[fatorQuantitativo({ name: "Tipo de solo" })]} />);

    await user.selectOptions(
      screen.getByLabelText("Papel no experimento"),
      "bloco",
    );
    await user.click(screen.getByRole("button", { name: /acrescentar/i }));

    expect(screen.getByLabelText("Bloco 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Bloco 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Bloco 3")).toBeInTheDocument();
  });

  it("voltar de Bloco para Fator qualitativo limpa papel e categorias", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initial={[fatorQuantitativo({ name: "Tipo de solo" })]} />);

    const select = screen.getByLabelText("Papel no experimento");
    await user.selectOptions(select, "bloco");
    expect(screen.getByLabelText("Bloco 1")).toBeInTheDocument();

    await user.selectOptions(select, "qualitative");

    expect(screen.queryByLabelText("Bloco 1")).not.toBeInTheDocument();
    // ramo qualitativo normal reaparece (rótulos baixo/alto, sem categorias)
    expect(screen.getByLabelText(/rótulo baixo/i)).toBeInTheDocument();
  });

  it("categoria em branco invalida o bloco, com mensagem clara", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initial={[fatorQuantitativo({ name: "Tipo de solo" })]} />);

    await user.selectOptions(
      screen.getByLabelText("Papel no experimento"),
      "bloco",
    );
    await user.type(screen.getByLabelText("Bloco 1"), "Residual");
    // Bloco 2 fica em branco.

    expect(
      screen.getByText(/precisa de ao menos 2 categorias nomeadas/i),
    ).toBeInTheDocument();
  });

  it("o papel Bloco não oferece o segmentado de quantidade de níveis", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initial={[fatorQuantitativo({ name: "Tipo de solo" })]} />);

    await user.selectOptions(
      screen.getByLabelText("Papel no experimento"),
      "bloco",
    );

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });
});
