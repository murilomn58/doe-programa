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
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-cyan-400">
          Entrada de dados
        </h1>
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
