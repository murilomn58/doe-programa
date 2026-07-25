"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ExperimentList } from "@/components/ExperimentList";
import { Badge } from "@/components/ui/Badge";
import { Callout } from "@/components/ui/Callout";
import { LogoDoE } from "@/components/ui/LogoDoE";
import { PageHeader } from "@/components/ui/PageHeader";
import { seedDemoExperiment } from "@/engine/demo";
import { EXPERIMENTS_KEY, useExperiments } from "@/hooks/useExperiments";

export function Dashboard() {
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

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        title="Design of Experiments"
        subtitle="Planejamento de experimentos. Grátis na versão beta."
        logo={<LogoDoE size={34} cor="#1B4E79" corBorda="#042C53" />}
        badge={
          <Badge tone="accent" pill>
            beta
          </Badge>
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

      {/* O método em 4 estações — onboarding visual do pesquisador */}
      <section aria-label="Como funciona" className="mt-8 rounded-xl border border-border bg-surface-1 px-6 py-5">
        <svg viewBox="0 0 720 84" className="w-full" role="img" aria-label="Planejar, executar, analisar e otimizar">
          {[
            { x: 40, label: "Planejar", hint: "fatores e matriz" },
            { x: 240, label: "Executar", hint: "ensaios no lab" },
            { x: 440, label: "Analisar", hint: "ANOVA e efeitos" },
            { x: 640, label: "Otimizar", hint: "ponto ótimo" },
          ].map((s, i) => (
            <g key={s.label}>
              {i < 3 ? (
                <line x1={s.x + 44} y1={30} x2={s.x + 156} y2={30} stroke="var(--color-border-strong)" strokeWidth={1.5} strokeDasharray="5 4" />
              ) : null}
              <circle cx={s.x} cy={30} r={17} fill={i === 3 ? "var(--color-primary)" : "var(--color-surface-0)"} stroke={i === 3 ? "var(--color-primary)" : "var(--color-accent-mid)"} strokeWidth={1.6} />
              <text x={s.x} y={35} textAnchor="middle" fontSize={13} fontWeight={600} fill={i === 3 ? "#ffffff" : "var(--color-accent-strong)"}>{i + 1}</text>
              <text x={s.x} y={64} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--color-foreground)">{s.label}</text>
              <text x={s.x} y={79} textAnchor="middle" fontSize={11} fill="var(--color-muted)">{s.hint}</text>
            </g>
          ))}
        </svg>
      </section>

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
          Grátis na versão beta. Seus projetos ficam salvos neste navegador
          (nada sai do seu computador); se você deixou seu email, avisamos
          quando a sincronização entre dispositivos chegar.
        </p>
      </section>
    </main>
  );
}
