import { useState } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NiveisFator } from "@/components/NiveisFator";
import type { FactorInput, FactorRead, RunRead } from "@/domain/design";
import { updateFactorsPreservingResponses, type FactorEdit } from "@/engine/store";

/** Fator quantitativo mínimo válido, pronto para receber overrides no teste. */
function fatorQuantitativo(overrides: Partial<FactorInput> = {}): FactorInput {
  return {
    name: "Cimento",
    factor_type: "quantitative",
    low: 3,
    high: 9,
    ...overrides,
  };
}

function fatorQualitativo(overrides: Partial<FactorInput> = {}): FactorInput {
  return {
    name: "Fibra",
    factor_type: "qualitative",
    low_label: "Tucum",
    high_label: "Piassava",
    ...overrides,
  };
}

/**
 * Casca de teste que guarda o fator em estado próprio, como o container real
 * (FactorForm/EditExperiment) faz: o NiveisFator em si é controlado e não
 * duplica o valor em estado — só a marca "editado à mão" fica local a ele.
 */
function ControlledHarness({
  initial,
  onChange,
  permitirEscolherQuantidade,
}: {
  initial: FactorInput;
  onChange?: (f: FactorInput) => void;
  permitirEscolherQuantidade?: boolean;
}) {
  const [factor, setFactor] = useState(initial);
  return (
    <NiveisFator
      factor={factor}
      onChange={(next) => {
        setFactor(next);
        onChange?.(next);
      }}
      permitirEscolherQuantidade={permitirEscolherQuantidade}
    />
  );
}

describe("NiveisFator — fator quantitativo", () => {
  it("escolher 3 níveis revela o campo de centro já preenchido com a média de low e high", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initial={fatorQuantitativo({ low: 3, high: 9 })} />);

    await user.click(screen.getByRole("radio", { name: "3" }));

    expect(screen.getByLabelText("Centro (0)")).toHaveValue(6);
  });

  it("alterar o máximo move o centro automaticamente", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initial={fatorQuantitativo({ low: 3, high: 9 })} />);

    await user.click(screen.getByRole("radio", { name: "3" }));
    fireEvent.change(screen.getByLabelText("Máximo (+1)"), {
      target: { value: "13" },
    });

    expect(screen.getByLabelText("Centro (0)")).toHaveValue(8);
  });

  it("alterar o centro à mão e depois alterar o máximo preserva o centro editado", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initial={fatorQuantitativo({ low: 3, high: 9 })} />);

    await user.click(screen.getByRole("radio", { name: "3" }));
    fireEvent.change(screen.getByLabelText("Centro (0)"), {
      target: { value: "7" },
    });
    expect(screen.getByLabelText("Centro (0)")).toHaveValue(7);

    fireEvent.change(screen.getByLabelText("Máximo (+1)"), {
      target: { value: "15" },
    });

    expect(screen.getByLabelText("Centro (0)")).toHaveValue(7);
    expect(screen.getByLabelText("Máximo (+1)")).toHaveValue(15);
    expect(screen.getByLabelText("Mínimo (−1)")).toHaveValue(3);
  });

  it("voltar para 2 níveis remove levels do fator, preservando low e high", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ControlledHarness
        initial={fatorQuantitativo({ low: 3, high: 9, levels: [3, 6, 9] })}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "2" }));

    const ultimo = onChange.mock.calls.at(-1)?.[0] as FactorInput;
    expect(ultimo.levels).toBeUndefined();
    expect(ultimo.low).toBe(3);
    expect(ultimo.high).toBe(9);
    expect(screen.queryByLabelText("Centro (0)")).not.toBeInTheDocument();
  });

  it("escolher 5 níveis produz cinco valores igualmente espaçados", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initial={fatorQuantitativo({ low: 0, high: 8 })} />);

    await user.click(screen.getByRole("radio", { name: "5" }));

    expect(screen.getByLabelText("Mínimo (−1)")).toHaveValue(0);
    expect(screen.getByLabelText("Nível 2")).toHaveValue(2);
    expect(screen.getByLabelText("Nível 3")).toHaveValue(4);
    expect(screen.getByLabelText("Nível 4")).toHaveValue(6);
    expect(screen.getByLabelText("Máximo (+1)")).toHaveValue(8);
  });

  it("a nota didática muda ao sair de 2 para 3+ níveis, sem negrito nem travessão", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initial={fatorQuantitativo({ low: 3, high: 9 })} />);

    expect(
      screen.getByText(/dois níveis medem apenas a tendência da resposta/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "3" }));

    const nota = screen.getByText(/box-behnken/i);
    expect(nota).toBeInTheDocument();
    expect(nota.innerHTML).not.toMatch(/<b>|<strong>/i);
    expect(nota.textContent).not.toMatch(/—/);
  });
});

describe("NiveisFator — fator qualitativo", () => {
  it("não mostra o segmentado de quantidade e mantém os dois rótulos", () => {
    render(<ControlledHarness initial={fatorQualitativo()} />);

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Rótulo baixo (−1)")).toHaveValue("Tucum");
    expect(screen.getByLabelText("Rótulo alto (+1)")).toHaveValue("Piassava");
    expect(screen.getByText(/aceitam duas categorias/i)).toBeInTheDocument();
  });
});

describe("NiveisFator — acessibilidade do segmentado", () => {
  it("expõe radiogroup/radio com aria-checked e é navegável por teclado", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initial={fatorQuantitativo({ low: 3, high: 9 })} />);

    const grupo = screen.getByRole("radiogroup", {
      name: /quantidade de níveis/i,
    });
    expect(grupo).toBeInTheDocument();

    const opcao2 = screen.getByRole("radio", { name: "2" });
    const opcao3 = screen.getByRole("radio", { name: "3" });
    expect(opcao2).toHaveAttribute("aria-checked", "true");
    expect(opcao3).toHaveAttribute("aria-checked", "false");
    expect(opcao2).toHaveAttribute("tabindex", "0");
    expect(opcao3).toHaveAttribute("tabindex", "-1");

    await user.tab();
    expect(opcao2).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    const opcao3Depois = screen.getByRole("radio", { name: "3" });
    expect(opcao3Depois).toHaveAttribute("aria-checked", "true");
    expect(opcao3Depois).toHaveFocus();
  });
});

describe("NiveisFator — modo restrito (usado em EditExperiment)", () => {
  it("com permitirEscolherQuantidade=false esconde o segmentado, mas ainda reescala um fator já com 3 níveis declarados", () => {
    const onChange = vi.fn();
    render(
      <ControlledHarness
        initial={fatorQuantitativo({ low: 3, high: 9, levels: [3, 6, 9] })}
        onChange={onChange}
        permitirEscolherQuantidade={false}
      />,
    );

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Centro (0)")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Mínimo (−1)")).toHaveValue(3);
    expect(screen.getByLabelText("Máximo (+1)")).toHaveValue(9);

    fireEvent.change(screen.getByLabelText("Máximo (+1)"), {
      target: { value: "15" },
    });

    const ultimo = onChange.mock.calls.at(-1)?.[0] as FactorInput;
    // O centro não tem campo visível aqui, mas continua acompanhando o
    // reescalonamento por niveisEquiespacados (mesma regra do modo completo).
    expect(ultimo.levels).toEqual([3, 9, 15]);
  });
});

// ---------------------------------------------------------------------------
// updateFactorsPreservingResponses (frontend/src/engine/store.ts) — a função
// que o EditExperiment chama ao salvar. Ela mora em outra camada (persistência
// local via IndexedDB) e não deve ser reescrita aqui; este teste só verifica,
// com um IndexedDB falso mínimo (sem depender de nenhuma lib nova), que ela
// já reescala corretamente um fator com 3+ níveis declarados — não só o par
// −1/+1 — e preserva as respostas medidas. Ver o retorno desta tarefa para a
// limitação que ISSO NÃO cobre: mudar a QUANTIDADE de níveis de um fator já
// gerado (FactorEdit não tem campo `levels`; por isso o EditExperiment usa
// NiveisFator com permitirEscolherQuantidade={false}).
// ---------------------------------------------------------------------------

/** IndexedDB mínimo, só com o que `frontend/src/engine/store.ts` usa. */
function criarIndexedDBFalso() {
  const dados = new Map<string, Map<unknown, Record<string, unknown>>>();
  const keyPaths = new Map<string, string>();

  function garantirStore(nome: string, keyPath: string) {
    if (!dados.has(nome)) {
      dados.set(nome, new Map());
      keyPaths.set(nome, keyPath);
    }
  }

  class FakeRequest<T> {
    onsuccess: (() => void) | null = null;
    onerror: (() => void) | null = null;
    result: T | undefined = undefined;
    error: unknown = null;
  }

  function resolver<T>(resultado: T): FakeRequest<T> {
    const req = new FakeRequest<T>();
    req.result = resultado;
    queueMicrotask(() => req.onsuccess?.());
    return req;
  }

  class FakeObjectStore {
    constructor(private nome: string) {}
    get(chave: unknown) {
      return resolver(dados.get(this.nome)?.get(chave));
    }
    getAll() {
      return resolver(Array.from(dados.get(this.nome)?.values() ?? []));
    }
    put(valor: Record<string, unknown>) {
      const kp = keyPaths.get(this.nome)!;
      dados.get(this.nome)!.set(valor[kp], valor);
      return resolver(valor[kp]);
    }
    add(valor: Record<string, unknown>) {
      const kp = keyPaths.get(this.nome)!;
      const mapa = dados.get(this.nome)!;
      let chave = valor[kp];
      if (chave === undefined) {
        chave = mapa.size + 1;
        valor = { ...valor, [kp]: chave };
      }
      mapa.set(chave, valor);
      return resolver(chave);
    }
    delete(chave: unknown) {
      dados.get(this.nome)?.delete(chave);
      return resolver(undefined);
    }
  }

  class FakeTransaction {
    oncomplete: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    constructor() {
      // Duas voltas de microtask: dá tempo dos requests emitidos logo após a
      // criação da transação (get/put síncronos aqui) resolverem antes do
      // "complete", como no IndexedDB real.
      queueMicrotask(() => queueMicrotask(() => this.oncomplete?.()));
    }
    objectStore(nome: string) {
      return new FakeObjectStore(nome);
    }
  }

  class FakeDatabase {
    objectStoreNames = { contains: (nome: string) => dados.has(nome) };
    createObjectStore(nome: string, opcoes: { keyPath: string }) {
      garantirStore(nome, opcoes.keyPath);
    }
    transaction() {
      return new FakeTransaction();
    }
    close() {}
  }

  const indexedDBFalso = {
    open() {
      const req = new FakeRequest<FakeDatabase>() as FakeRequest<FakeDatabase> & {
        onupgradeneeded: (() => void) | null;
      };
      req.onupgradeneeded = null;
      req.result = new FakeDatabase();
      queueMicrotask(() => {
        req.onupgradeneeded?.();
        queueMicrotask(() => req.onsuccess?.());
      });
      return req;
    },
  };

  function semear(nome: string, keyPath: string, valor: Record<string, unknown>) {
    garantirStore(nome, keyPath);
    dados.get(nome)!.set(valor[keyPath], valor);
  }

  return { indexedDBFalso, semear };
}

describe("updateFactorsPreservingResponses — fator com 3 níveis declarados", () => {
  it("reescala TODOS os níveis do fator (não só −1/+1) e preserva as respostas medidas", async () => {
    const { indexedDBFalso, semear } = criarIndexedDBFalso();
    const original = (globalThis as { indexedDB?: unknown }).indexedDB;
    (globalThis as { indexedDB?: unknown }).indexedDB = indexedDBFalso;

    try {
      const factoresIniciais: FactorRead[] = [
        {
          id: 1,
          name: "Cimento",
          factor_type: "quantitative",
          unit: null,
          position: 0,
          levels: [
            { coded_value: -1, natural_value: 2, label: null },
            { coded_value: 0, natural_value: 5, label: null },
            { coded_value: 1, natural_value: 8, label: null },
          ],
        },
      ];
      const corridasIniciais: RunRead[] = [
        {
          id: 1,
          run_order: 1,
          std_order: 1,
          point_type: 1,
          block: 1,
          replicate: 1,
          factors: { Cimento: { coded: -1, natural: 2, label: null } },
          response_values: { Resistência: 12.5 },
        },
        {
          id: 2,
          run_order: 2,
          std_order: 2,
          point_type: 1,
          block: 1,
          replicate: 1,
          factors: { Cimento: { coded: 0, natural: 5, label: null } },
          response_values: { Resistência: 15 },
        },
        {
          id: 3,
          run_order: 3,
          std_order: 3,
          point_type: 1,
          block: 1,
          replicate: 1,
          factors: { Cimento: { coded: 1, natural: 8, label: null } },
          response_values: { Resistência: 18.2 },
        },
      ];
      semear("designs", "experiment_id", {
        experiment_id: 42,
        design_type: "taguchi",
        factors: factoresIniciais,
        responses: [{ id: 1, name: "Resistência", unit: null, position: 0 }],
        runs: corridasIniciais,
        resolution: null,
        aliasing: null,
        array_name: null,
        optimal_efficiency: null,
      });

      const edits: FactorEdit[] = [{ name: "Cimento", low: 0, high: 10 }];
      const resultado = await updateFactorsPreservingResponses(42, edits);

      const cimento = resultado.factors.find((f) => f.name === "Cimento");
      expect(cimento?.levels.map((l) => l.natural_value)).toEqual([0, 5, 10]);

      const naturaisNasCorridas = resultado.runs.map((r) => r.factors.Cimento.natural);
      expect(naturaisNasCorridas).toEqual([0, 5, 10]);

      const respostasPreservadas = resultado.runs.map(
        (r) => r.response_values["Resistência"],
      );
      expect(respostasPreservadas).toEqual([12.5, 15, 18.2]);
    } finally {
      (globalThis as { indexedDB?: unknown }).indexedDB = original;
    }
  });
});
