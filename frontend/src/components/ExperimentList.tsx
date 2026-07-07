import Link from "next/link";

import type { Experiment } from "@/domain/experiment";

interface ExperimentListProps {
  experiments: Experiment[];
  isLoading: boolean;
  errorMessage: string | null;
}

export function ExperimentList({
  experiments,
  isLoading,
  errorMessage,
}: ExperimentListProps) {
  if (isLoading) {
    return <p className="text-sm text-slate-400">Carregando…</p>;
  }

  if (errorMessage) {
    return (
      <p className="text-sm text-red-400">
        Erro ao carregar experimentos: {errorMessage}
      </p>
    );
  }

  if (experiments.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Nenhum experimento ainda. Crie o primeiro acima.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {experiments.map((experiment) => (
        <li key={experiment.id}>
          <Link
            href={`/experiments/${experiment.id}`}
            className="block rounded-lg border border-slate-700 bg-slate-800 p-4 transition hover:border-cyan-500/60 hover:bg-slate-800/70"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-medium text-slate-100">{experiment.name}</h3>
              <span className="font-mono text-xs text-slate-500">
                #{experiment.id}
              </span>
            </div>
            {experiment.description ? (
              <p className="mt-1 text-sm text-slate-400">
                {experiment.description}
              </p>
            ) : null}
            <p className="mt-2 font-mono text-xs text-cyan-400/70">
              {new Date(experiment.created_at).toLocaleString("pt-BR")}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
