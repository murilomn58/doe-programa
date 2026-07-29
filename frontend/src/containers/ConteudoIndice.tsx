/**
 * Índice do material didático: os cinco cadernos em PDF.
 *
 * Container: lê o catálogo do domínio e monta a lista de `ApostilaCard`.
 * Não há página por caderno — o caderno é o PDF, e uma tela intermediária só
 * acrescentaria um clique entre o aluno e o material.
 */

import { ApostilaCard } from "@/components/ApostilaCard";
import { Badge } from "@/components/ui/Badge";
import { Callout } from "@/components/ui/Callout";
import { PageHeader } from "@/components/ui/PageHeader";
import { RodapeApp } from "@/components/ui/RodapeApp";
import { APOSTILAS } from "@/domain/apostilas";

export function ConteudoIndice() {
  const totalPaginas = APOSTILAS.reduce((soma, a) => soma + a.paginas, 0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        title="Material didático"
        subtitle="Cinco cadernos de planejamento de experimentos, do porquê de planejar à superfície de resposta. Escritos para acompanhar a aula e servir de consulta depois dela."
        back={{ label: "Início", href: "/" }}
        badge={
          <Badge tone="accent" pill>
            {APOSTILAS.length} cadernos
          </Badge>
        }
      />

      <Callout label="Como ler">
        Os cadernos seguem a ordem da aula, mas cada um se sustenta sozinho e
        pode ser lido fora de ordem: quem já domina o fatorial 2ᵏ pode começar
        pela regressão. São {totalPaginas} páginas ao todo, em PDF, para ler na
        tela ou imprimir.
      </Callout>

      <h2 className="mt-10 font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
        os cadernos
      </h2>

      <div className="mt-4 flex flex-col gap-4">
        {APOSTILAS.map((apostila) => (
          <ApostilaCard key={apostila.slug} apostila={apostila} />
        ))}
      </div>

      <RodapeApp />
    </main>
  );
}
