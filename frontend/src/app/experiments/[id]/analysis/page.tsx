"use client";

import Link from "next/link";
import { Suspense, use } from "react";

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
      <header className="mb-8">
        <Link
          href={`/experiments/${experimentId}`}
          className="text-xs text-slate-400 transition hover:text-cyan-400"
        >
          ← Voltar à entrada de dados
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-cyan-400">
          Análise estatística
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Experimento #{experimentId} — ANOVA, efeitos, coeficientes e
          estatísticas de ajuste por variável de resposta.
        </p>
      </header>

      {Number.isFinite(experimentId) && experimentId > 0 ? (
        <Suspense
          fallback={
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 text-sm text-slate-400">
              Carregando análise…
            </div>
          }
        >
          <Analysis experimentId={experimentId} />
        </Suspense>
      ) : (
        <p className="text-sm text-red-400">
          Identificador de experimento inválido.
        </p>
      )}
    </main>
  );
}
