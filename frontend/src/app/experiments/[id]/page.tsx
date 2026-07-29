"use client";

import { use } from "react";

import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataEntry } from "@/containers/DataEntry";
import { useRouter } from "next/navigation";

export default function ExperimentRunsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const experimentId = Number(id);
  const router = useRouter();
  const valid = Number.isFinite(experimentId) && experimentId > 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <PageHeader
        title="Entrada de dados"
        subtitle={`Experimento #${experimentId} — preencha as respostas medidas de cada ensaio.`}
        back={{ label: "Voltar aos experimentos", href: "/experiments" }}
        right={
          valid ? (
            <span className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() =>
                  router.push(`/experiments/${experimentId}/edit`)
                }
              >
                Editar
              </Button>
              <Button
                variant="accent"
                onClick={() =>
                  router.push(`/experiments/${experimentId}/analysis`)
                }
              >
                Analisar →
              </Button>
            </span>
          ) : undefined
        }
      />

      {valid ? (
        <DataEntry experimentId={experimentId} />
      ) : (
        <p className="text-sm text-danger">
          Identificador de experimento inválido.
        </p>
      )}
    </main>
  );
}
