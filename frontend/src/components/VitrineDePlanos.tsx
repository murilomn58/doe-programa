"use client";

/**
 * Vitrine do passo 3 do tour guiado: os até 3 cartões de plano (recomendado,
 * mais econômico, mais completo) SEMPRE visíveis lado a lado — nunca
 * escondidos atrás de um botão fantasma —, o "porquê" do plano escolhido, e
 * dois pontos de entrada para o catálogo avançado (as 9 famílias + os
 * parâmetros finos de cada uma).
 *
 * Os "dois disclosures" do enunciado abrem o MESMO painel: o `DesignPicker`
 * já existente é um bloco único (seletor de família + parâmetros da família +
 * réplicas, tudo num só componente) e dividi-lo em dois exigiria reescrevê-lo,
 * que a tarefa proíbe. Por isso os dois links diferem só no texto/proposta —
 * "ver as 9 famílias" e "ajustar α, blocos, réplicas..." — e os dois revelam
 * o mesmo `DesignPicker` inteiro; uma vez aberto, um terceiro controle oculta
 * de volta. `catalogoAberto` é estado do container (GuidedTour), não daqui,
 * porque precisa sobreviver a ir e voltar entre os passos do tour — se
 * morasse aqui, o catálogo voltaria a se esconder a cada remontagem, o mesmo
 * bug que esta tarefa corrige.
 */

import { DesignPicker } from "@/components/DesignPicker";
import { PlanoCard } from "@/components/PlanoCard";
import { Button } from "@/components/ui/Button";
import type { FactorInput } from "@/domain/design";
import type { DesignConfig } from "@/domain/designConfig";
import type { PlanoSugerido } from "@/domain/recommend";

interface VitrineDePlanosProps {
  planos: PlanoSugerido[];
  selecionado: PlanoSugerido | null;
  onEscolher: (plano: PlanoSugerido) => void;
  catalogoAberto: boolean;
  onCatalogoAbertoChange: (aberto: boolean) => void;
  designConfig: DesignConfig;
  onDesignConfigChange: (config: DesignConfig) => void;
  replicates: number;
  onReplicatesChange: (replicates: number) => void;
  factors: FactorInput[];
}

/**
 * Verdadeiro quando não há um único plano geravel com o que foi declarado —
 * a vitrine então explica o que falta para destravar, em vez de mostrar uma
 * fileira de cartões mortos (nenhum com botão "Escolher").
 */
function nenhumPlanoGeravel(planos: PlanoSugerido[]): boolean {
  return planos.length === 0 || planos.every((p) => p.indisponivel !== undefined);
}

export function VitrineDePlanos({
  planos,
  selecionado,
  onEscolher,
  catalogoAberto,
  onCatalogoAbertoChange,
  designConfig,
  onDesignConfigChange,
  replicates,
  onReplicatesChange,
  factors,
}: VitrineDePlanosProps) {
  return (
    <div className="flex flex-col gap-6">
      {nenhumPlanoGeravel(planos) ? (
        <div className="rounded-xl border border-warning-border bg-warning-surface p-5 text-sm text-warning">
          <p className="font-medium">
            Nenhum plano é gerável com o que você declarou até aqui.
          </p>
          <p className="mt-1">
            {planos[0]?.indisponivel ??
              "Acrescente mais um fator, ou declare mais níveis, para liberar um plano de planejamento."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {planos.map((plano) => (
            <PlanoCard
              key={plano.rotulo}
              plano={plano}
              selecionado={selecionado?.rotulo === plano.rotulo}
              onEscolher={() => onEscolher(plano)}
              onEscolherRemedio={
                plano.remedio ? () => onEscolher(plano.remedio!.plano) : undefined
              }
            />
          ))}
        </div>
      )}

      {selecionado ? (
        <p className="text-sm leading-relaxed text-foreground-soft">
          <span className="font-medium text-foreground">Por que essa escolha? </span>
          {selecionado.porque}
        </p>
      ) : null}

      {catalogoAberto ? (
        <div className="flex flex-col gap-3">
          <DesignPicker
            config={designConfig}
            onConfigChange={onDesignConfigChange}
            replicates={replicates}
            onReplicatesChange={onReplicatesChange}
            factors={factors}
          />
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => onCatalogoAbertoChange(false)}
          >
            ▾ Ocultar o catálogo avançado
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCatalogoAbertoChange(true)}
          >
            ▸ Ver as 9 famílias (fracionado, Box-Behnken, Taguchi,
            Plackett-Burman, D-ótimo, DSD, 3^k)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCatalogoAbertoChange(true)}
          >
            ▸ Ajustar α, blocos, réplicas e pontos centrais
          </Button>
        </div>
      )}
    </div>
  );
}
