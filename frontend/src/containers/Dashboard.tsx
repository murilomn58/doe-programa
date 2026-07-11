"use client";

import Link from "next/link";

import { ExperimentList } from "@/components/ExperimentList";
import { Callout } from "@/components/ui/Callout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useExperiments } from "@/hooks/useExperiments";

export function Dashboard() {
  const { data: experiments, isLoading, isError, error } = useExperiments();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        title="DoE Programa"
        subtitle="Planejamento de Experimentos"
      />

      <Callout label="Por onde começar">
        Vai <b>rodar</b> um experimento novo ou <b>já tem</b> os resultados? O
        assistente guiado leva você do começo ao fim — define fatores,
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

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-medium text-foreground">
          Experimentos
        </h2>
        <ExperimentList
          experiments={experiments ?? []}
          isLoading={isLoading}
          errorMessage={isError && error ? error.message : null}
        />
      </section>
    </main>
  );
}
