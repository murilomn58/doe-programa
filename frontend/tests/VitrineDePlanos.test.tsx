import { useState } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { VitrineDePlanos } from "@/components/VitrineDePlanos";
import type { FactorInput } from "@/domain/design";
import { defaultDesignConfig, type DesignConfig } from "@/domain/designConfig";
import {
  recommendPlans,
  type PlanoSugerido,
  type RotuloPlano,
} from "@/domain/recommend";

// O catálogo Taguchi é buscado via TanStack Query no componente real; aqui a
// vitrine só precisa que o DesignPicker monte, não da rede/motor científico
// (Pyodide) por trás dele — por isso o hook de domínio é substituído por um
// catálogo fixo, igual ao padrão já usado em outros testes deste projeto.
vi.mock("@/hooks/useTaguchiCatalog", () => ({
  useTaguchiCatalog: () => ({ data: { arrays: [] }, isLoading: false, isError: false }),
}));

const fatoresTeste: FactorInput[] = [
  { name: "Cimento", factor_type: "quantitative", low: 3, high: 9, unit: "%" },
  { name: "Fibra", factor_type: "quantitative", low: 1, high: 5, unit: "%" },
];

/** Fábrica de um `PlanoSugerido` mínimo, com overrides pontuais por teste. */
function planoFixture(overrides: Partial<PlanoSugerido> = {}): PlanoSugerido {
  return {
    rotulo: "recomendado",
    designType: "central_composite",
    configPatch: { designType: "central_composite", ccdVariant: "face_centered" },
    nEnsaios: 11,
    capacidades: {
      detectaCurvatura: true,
      curvaturaPorFator: true,
      interacoes: true,
      erroPuro: true,
      pontoOtimo: true,
    },
    porque: "Texto de teste explicando a escolha do plano recomendado.",
    ...overrides,
  };
}

const recomendado = planoFixture();
const economico = planoFixture({
  rotulo: "economico",
  designType: "full_factorial_2k",
  configPatch: { designType: "full_factorial_2k", centerPoints: 3 },
  nEnsaios: 7,
  capacidades: {
    detectaCurvatura: true,
    curvaturaPorFator: false,
    interacoes: true,
    erroPuro: true,
    pontoOtimo: false,
  },
  porque: "Texto de teste explicando a escolha do plano econômico.",
});
const completo = planoFixture({
  rotulo: "completo",
  replicates: 2,
  nEnsaios: 22,
  porque: "Texto de teste explicando a escolha do plano completo, com réplicas.",
});

const planosPadrao: PlanoSugerido[] = [recomendado, economico, completo];

/**
 * Casca de teste que reproduz, em miniatura, exatamente a fiação do
 * GuidedTour real: `onEscolher` aplica o `configPatch` sobre `designConfig` E
 * `plano.replicates` (quando presente) sobre o estado `replicates` — os dois,
 * nunca só um. `designConfig`/`replicates` saem para `<output>` só para o
 * teste conseguir ler o resultado.
 */
function Harness({ planos }: { planos: PlanoSugerido[] }) {
  const [designConfig, setDesignConfig] = useState<DesignConfig>(defaultDesignConfig());
  const [replicates, setReplicates] = useState(1);
  const [rotulo, setRotulo] = useState<RotuloPlano>("recomendado");
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const selecionado = planos.find((p) => p.rotulo === rotulo) ?? planos[0] ?? null;

  return (
    <div>
      <VitrineDePlanos
        planos={planos}
        selecionado={selecionado}
        onEscolher={(plano) => {
          setRotulo(plano.rotulo);
          setDesignConfig({ ...defaultDesignConfig(), ...plano.configPatch });
          setReplicates(plano.replicates ?? 1);
        }}
        catalogoAberto={catalogoAberto}
        onCatalogoAbertoChange={setCatalogoAberto}
        designConfig={designConfig}
        onDesignConfigChange={setDesignConfig}
        replicates={replicates}
        onReplicatesChange={setReplicates}
        factors={fatoresTeste}
      />
      <output data-testid="design-type">{designConfig.designType}</output>
      <output data-testid="replicates">{replicates}</output>
    </div>
  );
}

/** Encontra o `<article>` do cartão a partir de um texto que só aparece nele. */
function cartaoContendo(texto: string): HTMLElement {
  const el = screen.getByText(texto).closest("article");
  if (!el) throw new Error(`Cartão com "${texto}" não encontrado`);
  return el as HTMLElement;
}

describe("VitrineDePlanos — os três cartões sempre visíveis", () => {
  it("mostra recomendado, econômico e completo sem nenhum clique", () => {
    render(<Harness planos={planosPadrao} />);

    expect(screen.getByText("Recomendado")).toBeInTheDocument();
    expect(screen.getByText("Mais econômico")).toBeInTheDocument();
    expect(screen.getByText("Mais completo")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("22")).toBeInTheDocument();

    // O catálogo avançado (DesignPicker) NÃO está montado antes do clique.
    expect(screen.queryByText(/família de planejamento/i)).not.toBeInTheDocument();
  });
});

describe("VitrineDePlanos — escolher um cartão", () => {
  it("clicar em Escolher no econômico aplica o configPatch dele", async () => {
    const user = userEvent.setup();
    render(<Harness planos={planosPadrao} />);

    const cartaoEconomico = cartaoContendo("Mais econômico");
    await user.click(within(cartaoEconomico).getByRole("button", { name: "Escolher" }));

    expect(screen.getByTestId("design-type")).toHaveTextContent("full_factorial_2k");
    // Nenhum replicates declarado no plano econômico → cai para 1.
    expect(screen.getByTestId("replicates")).toHaveTextContent("1");
  });

  it("clicar em Escolher no completo aplica o configPatch E replicates:2 (não só um dos dois)", async () => {
    const user = userEvent.setup();
    render(<Harness planos={planosPadrao} />);

    const cartaoCompleto = cartaoContendo("Mais completo");
    await user.click(within(cartaoCompleto).getByRole("button", { name: "Escolher" }));

    expect(screen.getByTestId("design-type")).toHaveTextContent("central_composite");
    expect(screen.getByTestId("replicates")).toHaveTextContent("2");
  });
});

describe("VitrineDePlanos — disclosure do catálogo avançado", () => {
  it("o disclosure revela o DesignPicker (seletor de família completo)", async () => {
    const user = userEvent.setup();
    render(<Harness planos={planosPadrao} />);

    expect(screen.queryByText(/família de planejamento/i)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /ver as 9 famílias/i }),
    );

    expect(screen.getByText(/família de planejamento/i)).toBeInTheDocument();
    // O DesignPicker inteiro está lá, não uma versão reescrita: o campo de
    // réplicas (que também pertence ao segundo disclosure) está presente.
    expect(screen.getByText("Réplicas")).toBeInTheDocument();
  });
});

describe("VitrineDePlanos — plano indisponível", () => {
  it("aparece desabilitado, com o motivo no lugar do botão Escolher", () => {
    const motivo = "Este arranjo não aceita fator qualitativo para os fatores atuais.";
    const planos: PlanoSugerido[] = [
      recomendado,
      { ...economico, indisponivel: motivo },
      completo,
    ];
    render(<Harness planos={planos} />);

    const cartao = cartaoContendo("Mais econômico");
    expect(within(cartao).getByText(motivo)).toBeInTheDocument();
    expect(within(cartao).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("VitrineDePlanos — acessibilidade da lista de capacidades", () => {
  it("cada símbolo ✓/✗ é aria-hidden e vem acompanhado do texto por extenso", () => {
    render(<Harness planos={planosPadrao} />);

    // Positivo: o recomendado tem pontoOtimo=true.
    const itemPositivo = screen.getAllByText("Localiza o ponto ótimo")[0];
    const liPositivo = itemPositivo.closest("li")!;
    const simboloPositivo = liPositivo.querySelector("[aria-hidden]");
    expect(simboloPositivo).not.toBeNull();
    expect(simboloPositivo?.textContent).toBe("✓");

    // Negativo: o econômico tem pontoOtimo=false.
    const itemNegativo = screen.getAllByText("Não localiza o ponto ótimo")[0];
    const liNegativo = itemNegativo.closest("li")!;
    const simboloNegativo = liNegativo.querySelector("[aria-hidden]");
    expect(simboloNegativo).not.toBeNull();
    expect(simboloNegativo?.textContent).toBe("✗");
  });
});

// ---------------------------------------------------------------------------
// Os testes acima usam `planoFixture`, fabricado à mão: útil para testar a
// casca da UI, mas incapaz de flagrar uma divergência de contagem (o próprio
// bug de produção — 3 ensaios no cartão contra 12 no botão — nunca teria
// aparecido aqui, porque o fixture nunca discorda de si mesmo). Os testes
// abaixo usam o `recommendPlans` DE VERDADE para o caso real relatado (1
// fator, 3 níveis, 4 blocos), então uma regressão na contagem quebra este
// arquivo por construção, não só recommend.test.ts.
// ---------------------------------------------------------------------------

describe("VitrineDePlanos — dados reais (não fixtures): 1 fator, 3 níveis, 4 blocos", () => {
  const fatorFibra: FactorInput[] = [
    { name: "Fibra", factor_type: "quantitative", low: 0, high: 4, levels: [0, 2, 4] },
  ];
  const planosReais = recommendPlans({
    goal: "optimization",
    factors: fatorFibra,
    blocks: 4,
  });

  it("mostra o total real (12 ensaios) e a decomposição 3 por bloco x 4 blocos", () => {
    render(<Harness planos={planosReais} />);

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3 por bloco x 4 blocos")).toBeInTheDocument();
  });

  it("nenhum cartão promete interações com 1 fator só", () => {
    render(<Harness planos={planosReais} />);
    expect(screen.queryByText("Estima interações entre fatores")).not.toBeInTheDocument();
    expect(screen.getByText("Não estima interações entre fatores")).toBeInTheDocument();
  });

  it("o remédio de erro puro aparece e, ao ser aplicado, leva o design a 2 réplicas", async () => {
    const user = userEvent.setup();
    render(<Harness planos={planosReais} />);

    expect(
      screen.getByText("Sem erro puro. Duas réplicas dariam isso, em 24 ensaios."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Aplicar réplicas" }));

    expect(screen.getByTestId("design-type")).toHaveTextContent("full_factorial_general");
    expect(screen.getByTestId("replicates")).toHaveTextContent("2");
  });
});
