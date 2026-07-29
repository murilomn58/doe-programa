"use client";

/**
 * Controle de "quantos níveis o fator ensaia", dentro do card do fator.
 *
 * Presentational puro: recebe o `FactorInput` inteiro e devolve, via
 * `onChange`, uma cópia atualizada. Sem chamada de rede, sem estado de
 * servidor. A única coisa que mora em estado LOCAL (não no `FactorInput`, para
 * não poluir o contrato com o motor) é a marca de "este nível intermediário
 * foi editado à mão" — ela decide se um nível acompanha `low`/`high`
 * automaticamente ou fica parado no valor que o usuário digitou.
 *
 * Regra de representação (travada por `frontend/src/domain/design.ts` e
 * validada por `factorIsValid`): `low`/`high` são sempre o mínimo e o máximo;
 * `levels` guarda a lista ordenada completa só quando há 3+ níveis.
 */

import { useRef, useState, type KeyboardEvent } from "react";

import { nNiveis, niveisEquiespacados, type FactorInput } from "@/domain/design";

interface NiveisFatorProps {
  factor: FactorInput;
  onChange: (factor: FactorInput) => void;
  /**
   * Permite escolher a QUANTIDADE de níveis (2, 3, 5 ou personalizado).
   * Desligue no fluxo de edição de um experimento já gerado: mudar a
   * quantidade de níveis é uma mudança estrutural (a matriz de ensaios
   * precisaria ser refeita), que pertence ao painel "Evoluir o planejamento",
   * não à edição dos níveis naturais. Default: true (fluxo de criação).
   */
  permitirEscolherQuantidade?: boolean;
}

/** U+2212 (sinal de menos tipográfico) — mesmo caractere usado no restante da UI. */
const MENOS = "−";

const CUSTOM_MIN = 2;
const CUSTOM_MAX = 5;
/** Valor inicial ao entrar em "personalizado" vindo de um preset (2, 3 ou 5). */
const CUSTOM_PADRAO = 4;

const inputClass =
  "rounded-md border border-border-strong bg-surface-0 px-3 py-2 text-foreground-strong outline-none transition focus:border-primary focus:ring-1 focus:ring-primary";

function numberOrUndefined(value: string): number | undefined {
  return value === "" ? undefined : Number(value);
}

function clampCustom(value: number): number {
  return Math.min(CUSTOM_MAX, Math.max(CUSTOM_MIN, Math.trunc(value) || CUSTOM_MIN));
}

/** Rótulo de um nível intermediário (nunca o mínimo/máximo, que são fixos). */
function rotuloIntermediario(indice: number, nReal: number): string {
  return nReal === 3 ? "Centro (0)" : `Nível ${indice + 1}`;
}

/** Nota didática de uma frase, sem negrito e sem travessão. */
function notaDidatica(n: number): string {
  if (n <= 2) {
    return "Dois níveis medem apenas a tendência da resposta. Para estimar curvatura, declare três ou mais.";
  }
  return `Com ${n} níveis é possível estimar curvatura neste fator. Habilita Box-Behnken e composto central de face centrada.`;
}

/** Um campo de nível a renderizar: sempre um mínimo, um máximo, e — só quando
 *  a quantidade é editável nesta tela — os intermediários reais do fator. */
type Slot =
  | { tipo: "low" }
  | { tipo: "high" }
  | { tipo: "meio"; indice: number };

function montarSlots(nReal: number, mostrarIntermediarios: boolean): Slot[] {
  if (!mostrarIntermediarios || nReal <= 2) {
    return [{ tipo: "low" }, { tipo: "high" }];
  }
  const meios: Slot[] = [];
  for (let indice = 1; indice <= nReal - 2; indice += 1) {
    meios.push({ tipo: "meio", indice });
  }
  return [{ tipo: "low" }, ...meios, { tipo: "high" }];
}

export function NiveisFator({
  factor,
  onChange,
  permitirEscolherQuantidade = true,
}: NiveisFatorProps) {
  // Índices (dentro de `levels`) que o usuário editou manualmente. Sobrevive
  // a re-renders deste card (útil pro caso "editei o centro, depois mudei o
  // máximo"), mas NUNCA vai para o FactorInput — é puramente de UI.
  const editadosRef = useRef<Set<number>>(new Set());
  const [personalizadoValor, setPersonalizadoValor] = useState(CUSTOM_PADRAO);
  const botoesRef = useRef<Array<HTMLButtonElement | null>>([]);

  if (factor.factor_type !== "quantitative") {
    return (
      <div className="mt-3 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foreground-soft">Rótulo baixo ({MENOS}1)</span>
            <input
              type="text"
              value={factor.low_label ?? ""}
              onChange={(e) =>
                onChange({ ...factor, low_label: e.target.value || undefined })
              }
              placeholder="Ex.: Tucum"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foreground-soft">Rótulo alto (+1)</span>
            <input
              type="text"
              value={factor.high_label ?? ""}
              onChange={(e) =>
                onChange({ ...factor, high_label: e.target.value || undefined })
              }
              placeholder="Ex.: Piassava"
              className={inputClass}
            />
          </label>
        </div>
        <p className="text-xs text-faint">
          Fatores qualitativos aceitam duas categorias por enquanto. Múltiplos
          níveis para qualitativos chegam numa fase futura.
        </p>
      </div>
    );
  }

  const n = nNiveis(factor);
  const low = factor.low;
  const high = factor.high;
  const selecionado: "2" | "3" | "5" | "custom" =
    n === 2 ? "2" : n === 3 ? "3" : n === 5 ? "5" : "custom";

  /** Muda a QUANTIDADE de níveis: sempre recalcula por igual espaçamento e
   *  esquece quais índices tinham sido editados à mão (o conjunto de
   *  posições intermediárias mudou junto). */
  function aplicarQuantidade(novoN: number) {
    editadosRef.current = new Set();
    if (novoN <= 2) {
      onChange({ ...factor, levels: undefined });
      return;
    }
    const novosNiveis = niveisEquiespacados(low ?? 0, high ?? 0, novoN);
    onChange({ ...factor, levels: novosNiveis });
  }

  /** Muda `low` ou `high`: níveis intermediários nunca editados acompanham
   *  via `niveisEquiespacados`; os editados à mão permanecem intactos. */
  function alterarExtremo(qual: "low" | "high", bruto: string) {
    const valor = numberOrUndefined(bruto);
    if (n <= 2 || factor.levels === undefined) {
      onChange({ ...factor, [qual]: valor });
      return;
    }
    const novoLow = qual === "low" ? valor : low;
    const novoHigh = qual === "high" ? valor : high;
    if (novoLow === undefined || novoHigh === undefined) {
      onChange({ ...factor, [qual]: valor });
      return;
    }
    const recalculado = niveisEquiespacados(novoLow, novoHigh, n);
    const niveisAtuais = factor.levels;
    const mesclado = recalculado.map((v, i) =>
      editadosRef.current.has(i) ? niveisAtuais[i] : v,
    );
    onChange({ ...factor, [qual]: valor, levels: mesclado });
  }

  /** Edição manual de um nível intermediário: marca o índice como editado e
   *  não mexe em mais nada. */
  function alterarIntermediario(index: number, bruto: string) {
    const valor = numberOrUndefined(bruto);
    if (valor === undefined || !factor.levels) return;
    editadosRef.current.add(index);
    const novosNiveis = factor.levels.map((v, i) => (i === index ? valor : v));
    onChange({ ...factor, levels: novosNiveis });
  }

  const opcoes = [
    { chave: "2" as const, rotulo: "2", n: 2 },
    { chave: "3" as const, rotulo: "3", n: 3 },
    { chave: "5" as const, rotulo: "5", n: 5 },
    { chave: "custom" as const, rotulo: "Personalizado", n: personalizadoValor },
  ];

  function selecionarIndice(idx: number) {
    const opcao = opcoes[idx];
    if (opcao.chave === "custom") {
      aplicarQuantidade(personalizadoValor);
    } else {
      aplicarQuantidade(opcao.n);
    }
    botoesRef.current[idx]?.focus();
  }

  function onKeyDownOpcao(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    const total = opcoes.length;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      selecionarIndice((idx + 1) % total);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      selecionarIndice((idx - 1 + total) % total);
    }
  }

  const slots = montarSlots(n, permitirEscolherQuantidade);

  return (
    <div className="mt-3 flex flex-col gap-3">
      {permitirEscolherQuantidade ? (
        <div>
          <span className="mb-1 block text-sm text-foreground-soft">
            Níveis a ensaiar
          </span>
          <div
            role="radiogroup"
            aria-label="Quantidade de níveis a ensaiar"
            className="flex flex-wrap gap-1.5"
          >
            {opcoes.map((opcao, idx) => {
              const marcado = selecionado === opcao.chave;
              return (
                <button
                  key={opcao.chave}
                  type="button"
                  role="radio"
                  aria-checked={marcado}
                  tabIndex={marcado ? 0 : -1}
                  ref={(el) => {
                    botoesRef.current[idx] = el;
                  }}
                  onClick={() => selecionarIndice(idx)}
                  onKeyDown={(e) => onKeyDownOpcao(e, idx)}
                  className={
                    marcado
                      ? "rounded-md border-2 border-accent-strong bg-accent-strong/10 px-3 py-1.5 text-sm font-semibold text-accent-strong transition"
                      : "rounded-md border border-border px-3 py-1.5 text-sm font-normal text-foreground-soft transition hover:border-primary"
                  }
                >
                  {opcao.rotulo}
                </button>
              );
            })}
          </div>
          {selecionado === "custom" ? (
            <label className="mt-2 flex w-44 flex-col gap-1 text-sm">
              <span className="text-foreground-soft">Quantidade (2 a 5)</span>
              <input
                type="number"
                min={CUSTOM_MIN}
                max={CUSTOM_MAX}
                value={n}
                onChange={(e) => {
                  const valor = clampCustom(Number(e.target.value));
                  setPersonalizadoValor(valor);
                  aplicarQuantidade(valor);
                }}
                className={inputClass}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {slots.map((slot) => {
          if (slot.tipo === "low") {
            return (
              <label key="low" className="flex flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Mínimo ({MENOS}1)</span>
                <input
                  type="number"
                  value={low ?? ""}
                  onChange={(e) => alterarExtremo("low", e.target.value)}
                  className={inputClass}
                />
              </label>
            );
          }
          if (slot.tipo === "high") {
            return (
              <label key="high" className="flex flex-col gap-1 text-sm">
                <span className="text-foreground-soft">Máximo (+1)</span>
                <input
                  type="number"
                  value={high ?? ""}
                  onChange={(e) => alterarExtremo("high", e.target.value)}
                  className={inputClass}
                />
              </label>
            );
          }
          return (
            <label key={slot.indice} className="flex flex-col gap-1 text-sm">
              <span className="text-foreground-soft">
                {rotuloIntermediario(slot.indice, n)}
              </span>
              <input
                type="number"
                value={factor.levels?.[slot.indice] ?? ""}
                onChange={(e) => alterarIntermediario(slot.indice, e.target.value)}
                className={inputClass}
              />
            </label>
          );
        })}
      </div>

      {permitirEscolherQuantidade ? (
        <p className="text-xs text-faint">{notaDidatica(n)}</p>
      ) : (
        <p className="text-xs text-faint">
          Aqui você ajusta os extremos; a quantidade de níveis é definida ao
          criar o planejamento.
        </p>
      )}
    </div>
  );
}
