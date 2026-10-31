"use client";

import { NiveisFator, type ContagemBloco } from "@/components/NiveisFator";
import type { FactorInput } from "@/domain/design";

interface FactorFormProps {
  factors: FactorInput[];
  onChange: (index: number, factor: FactorInput) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  /**
   * Contagem ao vivo (nº de blocos, ensaios por bloco, total) do bloco
   * atualmente declarado entre `factors`, repassada ao `NiveisFator` do fator
   * que estiver com `papel === "bloco"`. Quem monta os números é o wizard
   * (GuidedTour), que tem acesso ao `designConfig` e às réplicas; opcional,
   * pois quem monta este formulário fora do wizard não precisa exibir a
   * contagem.
   */
  contagemBlocos?: ContagemBloco;
}

const inputClass =
  "rounded-md border border-border-strong bg-surface-0 px-3 py-2 text-foreground-strong outline-none transition focus:border-primary focus:ring-1 focus:ring-primary";

const labelFor = (index: number) => String.fromCharCode(65 + index); // A, B, C…

/** As três opções do seletor "Papel no experimento". */
type PapelOpcao = "quantitative" | "qualitative" | "bloco";

function papelAtual(factor: FactorInput): PapelOpcao {
  if (factor.papel === "bloco") return "bloco";
  return factor.factor_type;
}

/**
 * Aplica a troca de papel. Escolher "Bloco" preserva categorias já digitadas
 * (se houver 2+) ou inicializa com duas entradas vazias. Voltar para fator
 * (quantitativo ou qualitativo) limpa `papel` e `categorias` — a entrada
 * volta a ser só um fator comum, sem resíduo do estado de bloco.
 */
function aplicarPapel(factor: FactorInput, opcao: PapelOpcao): FactorInput {
  if (opcao === "bloco") {
    const categoriasAtuais = factor.categorias;
    return {
      ...factor,
      papel: "bloco",
      categorias:
        categoriasAtuais && categoriasAtuais.length >= 2
          ? categoriasAtuais
          : ["", ""],
    };
  }
  return {
    ...factor,
    factor_type: opcao,
    papel: undefined,
    categorias: undefined,
  };
}

export function FactorForm({
  factors,
  onChange,
  onAdd,
  onRemove,
  contagemBlocos,
}: FactorFormProps) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-6 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-foreground">Fatores</h2>
        <span className="font-mono text-xs text-faint">
          {factors.length} fator(es)
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {factors.map((factor, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-surface-0/60 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-accent-mid">
                {labelFor(index)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="text-xs text-muted transition hover:text-danger"
              >
                Remover
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Nome</span>
                <input
                  type="text"
                  value={factor.name}
                  onChange={(e) =>
                    onChange(index, { ...factor, name: e.target.value })
                  }
                  placeholder="Ex.: % de fibra"
                  className={inputClass}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Papel no experimento</span>
                <select
                  value={papelAtual(factor)}
                  onChange={(e) =>
                    onChange(
                      index,
                      aplicarPapel(factor, e.target.value as PapelOpcao),
                    )
                  }
                  className={inputClass}
                >
                  <option value="quantitative">Fator quantitativo</option>
                  <option value="qualitative">
                    Fator qualitativo (2 categorias)
                  </option>
                  <option value="bloco">Bloco (2 ou mais)</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Unidade</span>
                <input
                  type="text"
                  value={factor.unit ?? ""}
                  onChange={(e) =>
                    onChange(index, {
                      ...factor,
                      unit: e.target.value || undefined,
                    })
                  }
                  placeholder="Ex.: %, MPa (opcional)"
                  className={inputClass}
                />
              </label>
            </div>

            <NiveisFator
              factor={factor}
              onChange={(next) => onChange(index, next)}
              contagemBloco={factor.papel === "bloco" ? contagemBlocos : undefined}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mt-4 rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary-soft"
      >
        + Adicionar fator
      </button>
    </div>
  );
}
