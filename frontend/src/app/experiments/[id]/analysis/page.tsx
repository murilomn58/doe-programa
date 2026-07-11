"use client";

import { Suspense, use } from "react";

import { PageHeader } from "@/components/ui/PageHeader";
import { Analysis } from "@/containers/Analysis";

export default function ExperimentAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const experimentId = Number(id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <PageHeader
        title="Análise estatística"
        subtitle={`Experimento #${experimentId} — ANOVA, efeitos, coeficientes e estatísticas de ajuste por variável de resposta.`}
        back={{
          label: "Voltar à entrada de dados",
          href: `/experiments/${experimentId}`,
        }}
      />

      {Number.isFinite(experimentId) && experimentId > 0 ? (
        <Suspense
          fallback={
            <div className="rounded-xl border border-border bg-surface-1 p-6 text-sm text-muted">
              Carregando análise…
            </div>
          }
        >
          <Analysis experimentId={experimentId} />
        </Suspense>
      ) : (
        <p className="text-sm text-danger">
          Identificador de experimento inválido.
        </p>
      )}
    </main>
  );
}
