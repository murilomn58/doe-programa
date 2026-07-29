"use client";

/**
 * Portal de duas portas: a home (`/`) não escolhe por quem chega — aprender
 * DoE ou planejar e analisar são intenções igualmente centrais, e cada uma
 * ganha uma rota inteira para crescer sem diluir a outra.
 *
 * Quem já tem experimentos salvos não perde o atalho: a faixa "Continuar de
 * onde parou" reaproveita o `ExperimentList` com a prop `limite`, e o rodapé
 * sempre linka para `/experiments`.
 */

import Link from "next/link";

import { ExperimentList } from "@/components/ExperimentList";
import { PortaCard } from "@/components/PortaCard";
import { Badge } from "@/components/ui/Badge";
import { LogoDoE } from "@/components/ui/LogoDoE";
import { PageHeader } from "@/components/ui/PageHeader";
import { RodapeApp } from "@/components/ui/RodapeApp";
import { useExperiments } from "@/hooks/useExperiments";

interface InicioProps {
  /** Vem do `HomeGate` (rota `/`): reabre a capa sem navegar. */
  onVoltarCapa?: () => void;
}

const RECENTES_LIMITE = 3;

export function Inicio({ onVoltarCapa }: InicioProps) {
  const { data: experiments, isLoading, isError } = useExperiments();
  const recentes = experiments ?? [];
  const mostrarRecentes = !isLoading && !isError && recentes.length > 0;

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
      />

      <div className="grid gap-4 md:grid-cols-2">
        <PortaCard
          titulo="Aprender DoE"
          subtitulo="Cinco cadernos, do porquê planejar à superfície de resposta."
          href="/conteudo"
          tom="accent"
        />
        <PortaCard
          titulo="Planejar e analisar"
          subtitulo="Monte a matriz, preencha os ensaios, leia a ANOVA e ache o ponto ótimo."
          href="/experiments"
          tom="primary"
        />
      </div>

      {mostrarRecentes ? (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium text-foreground">
              Continuar de onde parou
            </h2>
            <Link
              href="/experiments"
              className="text-sm text-accent transition hover:text-accent-strong"
            >
              ver todos →
            </Link>
          </div>
          <ExperimentList
            experiments={recentes}
            isLoading={false}
            errorMessage={null}
            limite={RECENTES_LIMITE}
          />
        </section>
      ) : null}

      <RodapeApp onVoltarCapa={onVoltarCapa} />
    </main>
  );
}
