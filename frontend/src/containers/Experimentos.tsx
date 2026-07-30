"use client";

/**
 * O programa em si (rota `/experiments`): criar do zero, retomar um
 * planejamento antigo ou continuar um experimento salvo.
 *
 * Nasceu do antigo `Dashboard.tsx` (Task 1.5 o desmembra): a porta "Aprender
 * DoE" saiu para `/conteudo` e o portal de entrada virou `Inicio`, deixando
 * esta tela livre para crescer só do lado de quem já está trabalhando.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ExperimentList } from "@/components/ExperimentList";
import { MetodoQuatroEstacoes } from "@/components/MetodoQuatroEstacoes";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { LogoDoE } from "@/components/ui/LogoDoE";
import { PageHeader } from "@/components/ui/PageHeader";
import { RodapeApp } from "@/components/ui/RodapeApp";
import { seedDemoExperiment } from "@/engine/demo";
import { seedExemploClaudio } from "@/engine/exemploClaudio";
import { seedExemploTanabe } from "@/engine/exemploTanabe";
import { EXPERIMENTS_KEY, useExperiments } from "@/hooks/useExperiments";

export function Experimentos() {
  const { data: experiments, isLoading, isError, error } = useExperiments();
  const router = useRouter();
  const qc = useQueryClient();
  const [seeding, setSeeding] = useState(false);

  async function openDemo() {
    setSeeding(true);
    try {
      const id = await seedDemoExperiment();
      void qc.invalidateQueries({ queryKey: EXPERIMENTS_KEY });
      router.push(`/experiments/${id}/analysis?response=Resist%C3%AAncia&model=linear`);
    } finally {
      setSeeding(false);
    }
  }

  /** Abre o planejamento do Tanabe na MATRIZ, não na análise: sem resposta
   *  medida não há o que analisar, e cair numa tela de análise vazia daria a
   *  impressão de que o exemplo está quebrado. */
  async function abrirTanabe() {
    setSeeding(true);
    try {
      const id = await seedExemploTanabe();
      void qc.invalidateQueries({ queryKey: EXPERIMENTS_KEY });
      router.push(`/experiments/${id}`);
    } finally {
      setSeeding(false);
    }
  }

  /** Abre o exemplo do Cláudio direto na ANÁLISE: aqui há resposta medida,
   *  72 ensaios, e o interesse é justamente ver o ajuste e os gráficos. */
  async function abrirClaudio() {
    setSeeding(true);
    try {
      const id = await seedExemploClaudio();
      void qc.invalidateQueries({ queryKey: EXPERIMENTS_KEY });
      router.push(`/experiments/${id}/analysis?response=log%20MR&model=linear`);
    } finally {
      setSeeding(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        title="Design of Experiments"
        subtitle="Planejamento de experimentos. Grátis na versão beta."
        logo={<LogoDoE size={34} cor="#1793B5" corBorda="#084A5B" />}
        badge={
          <Badge tone="accent" pill>
            beta
          </Badge>
        }
        back={{ label: "Início", href: "/" }}
        right={
          <Button variant="accent" onClick={() => router.push("/setup")}>
            Novo experimento
          </Button>
        }
      />

      <Callout label="Por onde começar">
        Vai <b>rodar</b> um experimento novo ou <b>já tem</b> os resultados? O
        assistente guiado leva você do começo ao fim: define fatores,
        recomenda o planejamento, gera a matriz e mostra os gráficos.
      </Callout>

      <Link
        href="/setup"
        className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-accent-strong bg-accent-strong/10 px-6 py-5 transition hover:bg-accent-strong/15"
      >
        <span>
          <span className="block text-lg font-semibold text-foreground-strong">
            Criar experimento (passo a passo)
          </span>
          <span className="block text-sm text-foreground-soft">
            Assistente guiado para planejar do zero ou analisar dados que você já
            tem.
          </span>
        </span>
        <span className="shrink-0 text-2xl text-accent" aria-hidden>
          →
        </span>
      </Link>

      <Link
        href="/retrospective"
        className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-1 px-6 py-4 transition hover:border-accent-strong/60"
      >
        <span>
          <span className="block font-semibold text-foreground-strong">
            Já tenho os dados de um experimento antigo
          </span>
          <span className="block text-sm text-foreground-soft">
            Cole a tabela de ensaios e o programa descobre o planejamento por
            trás dos dados e analisa.
          </span>
        </span>
        <span className="shrink-0 text-xl text-accent" aria-hidden>
          →
        </span>
      </Link>

      {/* Demo pronto: CCD com a história didática completa */}
      <button
        type="button"
        disabled={seeding}
        onClick={() => void openDemo()}
        className="mt-3 flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-surface-1 px-6 py-4 text-left transition hover:border-accent-strong/60 disabled:opacity-60"
      >
        <span>
          <span className="block font-semibold text-foreground-strong">
            {seeding ? "Preparando o exemplo…" : "Explorar um exemplo pronto (superfície de resposta)"}
          </span>
          <span className="block text-sm text-foreground-soft">
            Um CCD real com falta de ajuste no modelo linear: veja o assistente
            sugerir o quadrático e ache o ponto ótimo no profiler.
          </span>
        </span>
        <span className="shrink-0 text-xl text-accent" aria-hidden>
          ⚗
        </span>
      </button>

      {/* Planejamento pronto, ainda SEM resultado: o experimento não foi
          rodado. Abre na matriz de ensaios, e não na análise, porque não há
          o que analisar. */}
      <button
        type="button"
        disabled={seeding}
        onClick={() => void abrirTanabe()}
        className="mt-3 flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-surface-1 px-6 py-4 text-left transition hover:border-accent-strong/60 disabled:opacity-60"
      >
        <span>
          <span className="block font-semibold text-foreground-strong">
            {seeding
              ? "Preparando o exemplo…"
              : "Ver um planejamento em blocos, pronto para a bancada"}
          </span>
          <span className="block text-sm text-foreground-soft">
            Sete tipos de solo entram como bloco, e não como fator, porque não
            são objeto do estudo. Cimento e rejeito em três níveis: 63 ensaios
            com a ordem sorteada, esperando as medidas.
          </span>
        </span>
        <span className="shrink-0 text-xl text-accent" aria-hidden>
          ▦
        </span>
      </button>

      {/* Dados MEDIDOS de uma tese do IME: 72 ensaios, quatro materiais. */}
      <button
        type="button"
        disabled={seeding}
        onClick={() => void abrirClaudio()}
        className="mt-3 flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-surface-1 px-6 py-4 text-left transition hover:border-accent-strong/60 disabled:opacity-60"
      >
        <span>
          <span className="block font-semibold text-foreground-strong">
            {seeding
              ? "Preparando o exemplo…"
              : "Analisar um ensaio real de módulo de resiliência"}
          </span>
          <span className="block text-sm text-foreground-soft">
            Setenta e dois ensaios triaxiais de misturas solo-brita, medidos
            numa tese do IME. Uma lei de potência linearizada em logaritmos,
            com o material entrando como bloco.
          </span>
        </span>
        <span className="shrink-0 text-xl text-accent" aria-hidden>
          ◲
        </span>
      </button>

      <MetodoQuatroEstacoes />

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-medium text-foreground">
          Experimentos
        </h2>
        <ExperimentList
          experiments={experiments ?? []}
          isLoading={isLoading}
          errorMessage={isError && error ? error.message : null}
        />
        <p className="mt-4 text-xs text-muted">
          Seus experimentos ficam salvos neste navegador (nada sai do seu
          computador); se você deixou seu email, avisamos quando a
          sincronização entre dispositivos chegar.
        </p>
      </section>

      <RodapeApp />
    </main>
  );
}
