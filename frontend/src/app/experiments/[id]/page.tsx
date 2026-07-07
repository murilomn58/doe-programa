"use client";

import Link from "next/link";
import { use } from "react";

import { DataEntry } from "@/containers/DataEntry";

export default function ExperimentRunsPage({
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
          href="/"
          className="text-xs text-slate-400 transition hover:text-cyan-400"
        >
          ← Voltar ao dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-cyan-400">
            Entrada de dados
          </h1>
          {Number.isFinite(experimentId) && experimentId > 0 ? (
            <Link
              href={`/experiments/${experimentId}/analysis`}
              className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-400"
            >
              Analisar →
            </Link>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Experimento #{experimentId} — preencha as respostas medidas de cada
          ensaio.
        </p>
      </header>

      {Number.isFinite(experimentId) && experimentId > 0 ? (
        <DataEntry experimentId={experimentId} />
      ) : (
        <p className="text-sm text-red-400">Identificador de experimento inválido.</p>
      )}
    </main>
  );
}
