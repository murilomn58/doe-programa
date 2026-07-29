"use client";

/**
 * Cartão presentational puro de UM plano de planejamento (vitrine do passo 3
 * do tour guiado). Sem estado, sem rede: só recebe o `PlanoSugerido` já
 * calculado por `domain/recommend.ts` e devolve o clique via `onEscolher`.
 *
 * Acessibilidade (exigência explícita da tarefa): os símbolos ✓/✗ da lista de
 * capacidades NUNCA carregam significado sozinhos. Cada item traz a frase por
 * extenso (uma versão para quando o plano tem a capacidade, outra para quando
 * não tem); o símbolo é puramente decorativo (`aria-hidden`); e a distinção
 * nunca depende só da cor — o próprio texto muda, não só a cor dele.
 */

import { DESIGN_FAMILY_NOTE } from "@/components/DesignPicker";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { CCDVariant, DesignType } from "@/domain/design";
import type { PlanoSugerido, RotuloPlano } from "@/domain/recommend";

interface PlanoCardProps {
  plano: PlanoSugerido;
  selecionado: boolean;
  onEscolher: () => void;
}

const ROTULO_INFO: Record<RotuloPlano, { titulo: string; tone: BadgeTone }> = {
  recomendado: { titulo: "Recomendado", tone: "accent" },
  economico: { titulo: "Mais econômico", tone: "neutral" },
  completo: { titulo: "Mais completo", tone: "significant" },
};

/** Nome amigável por família — só as que a vitrine (recommendPlans) produz. */
const NOME_FAMILIA: Partial<Record<DesignType, string>> = {
  full_factorial_2k: "Fatorial completo 2ᵏ",
  fractional_factorial_2kp: "Fatorial fracionado 2ᵏ⁻ᵖ",
  central_composite: "Composto central",
  box_behnken: "Box-Behnken",
  full_factorial_general: "Fatorial completo (níveis múltiplos)",
  plackett_burman: "Plackett-Burman",
};

const NOME_VARIANTE_CCD: Record<CCDVariant, string> = {
  rotatable: "rotável",
  orthogonal: "ortogonal",
  face_centered: "face centrada",
};

/** Título de exibição: família + variante do CCD, quando o patch declarar uma. */
function tituloFamilia(plano: PlanoSugerido): string {
  const base = NOME_FAMILIA[plano.designType] ?? plano.designType;
  const variante = plano.configPatch.ccdVariant;
  return variante ? `${base} ${NOME_VARIANTE_CCD[variante]}` : base;
}

/** Uma linha da lista de capacidades: chave + frase por extenso nos dois sentidos. */
const ITENS_CAPACIDADE: ReadonlyArray<{
  chave: keyof PlanoSugerido["capacidades"];
  positivo: string;
  negativo: string;
}> = [
  {
    chave: "detectaCurvatura",
    positivo: "Acusa que há curvatura na resposta",
    negativo: "Não acusa curvatura na resposta",
  },
  {
    chave: "curvaturaPorFator",
    positivo: "Aponta de qual fator vem a curvatura",
    negativo: "Não aponta de qual fator vem a curvatura",
  },
  {
    chave: "interacoes",
    positivo: "Estima interações entre fatores",
    negativo: "Não estima interações entre fatores",
  },
  {
    chave: "erroPuro",
    positivo: "Estima o erro puro (repetibilidade)",
    negativo: "Não estima o erro puro",
  },
  {
    chave: "pontoOtimo",
    positivo: "Localiza o ponto ótimo",
    negativo: "Não localiza o ponto ótimo",
  },
];

export function PlanoCard({ plano, selecionado, onEscolher }: PlanoCardProps) {
  const indisponivel = plano.indisponivel;
  const marcado = selecionado && !indisponivel;
  const rotuloInfo = ROTULO_INFO[plano.rotulo];

  const borda = indisponivel
    ? "border-border bg-surface-2 opacity-60"
    : marcado
      ? "border-accent-strong bg-surface-1 ring-1 ring-accent-strong"
      : "border-border bg-surface-1";

  return (
    <article
      className={`flex flex-col gap-3 rounded-xl border p-5 shadow-lg transition ${borda}`}
    >
      <Badge tone={rotuloInfo.tone}>{rotuloInfo.titulo}</Badge>

      <div>
        <h3
          title={DESIGN_FAMILY_NOTE[plano.designType]}
          className="text-base font-semibold text-foreground-strong"
        >
          {tituloFamilia(plano)}
        </h3>
        {plano.replicates ? (
          <p className="text-xs text-faint">{plano.replicates} réplicas</p>
        ) : null}
      </div>

      <p className="text-2xl font-semibold text-foreground-strong">
        {plano.nEnsaios}{" "}
        <span className="text-sm font-normal text-foreground-soft">ensaios</span>
      </p>

      <ul className="flex flex-col gap-1.5 text-sm">
        {ITENS_CAPACIDADE.map(({ chave, positivo, negativo }) => {
          const tem = plano.capacidades[chave];
          return (
            <li
              key={chave}
              className={`flex items-start gap-2 ${tem ? "text-significant" : "text-muted"}`}
            >
              <span aria-hidden className="mt-0.5 shrink-0 font-semibold">
                {tem ? "✓" : "✗"}
              </span>
              <span>{tem ? positivo : negativo}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto pt-2">
        {indisponivel ? (
          <p className="rounded-md border border-warning-border bg-warning-surface px-3 py-2 text-xs text-warning">
            {indisponivel}
          </p>
        ) : (
          <Button
            variant={marcado ? "accent" : "outline"}
            className="w-full"
            aria-pressed={marcado}
            onClick={onEscolher}
          >
            {marcado ? "Selecionado" : "Escolher"}
          </Button>
        )}
      </div>
    </article>
  );
}
