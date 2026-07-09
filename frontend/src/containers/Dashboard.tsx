"use client";

import Link from "next/link";

import { ExperimentList } from "@/components/ExperimentList";
import { NewExperimentForm } from "@/components/NewExperimentForm";
import { useCreateExperiment, useExperiments } from "@/hooks/useExperiments";

export function Dashboard() {
  const { data: experiments, isLoading, isError, error } = useExperiments();
  const createExperiment = useCreateExperiment();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-cyan-400">
            DoE Programa
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Planejamento de Experimentos — Dashboard
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Link
            href="/retrospective"
            className="rounded-md border border-slate-600 px-4 py-2 text-center text-sm font-medium text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300"
          >
            Já tenho resultados → Análise retrospectiva
          </Link>
          <Link
            href="/setup"
            className="rounded-md bg-cyan-500 px-4 py-2 text-center text-sm font-medium text-slate-900 transition hover:bg-cyan-400"
          >
            + Novo planejamento fatorial
          </Link>
        </div>
      </header>

      <section className="mb-10">
        <NewExperimentForm
          onCreate={(input) => createExperiment.mutate(input)}
          isPending={createExperiment.isPending}
          errorMessage={
            createExperiment.error ? createExperiment.error.message : null
          }
        />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium text-slate-200">Experimentos</h2>
        <ExperimentList
          experiments={experiments ?? []}
          isLoading={isLoading}
          errorMessage={isError && error ? error.message : null}
        />
      </section>
    </main>
  );
}
